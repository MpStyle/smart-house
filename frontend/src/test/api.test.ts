import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/api';
import { preferences } from '../book/preferences';

const store = () => configureStore({
  reducer: { [api.reducerPath]: api.reducer, preferences: preferences.reducer },
  middleware: getDefault => getDefault().concat(api.middleware),
});

beforeEach(() => {
  const NativeRequest = Request;
  vi.stubGlobal('Request', class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === 'string' ? new URL(input, 'http://localhost') : input, init);
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('generated API integration', () => {
  it('encodes identifiers and forwards CSRF tokens with same-origin cookies', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      requests.push(request);
      return new Response(null, { status: 204 });
    }));
    const app = store();
    const snapshot = app.dispatch(api.endpoints.snapshot.initiate('home /?#'));
    await snapshot;
    await app.dispatch(api.endpoints.logout.initiate('csrf-token'));
    expect(new URL(requests[0].url).pathname).toBe('/api/v1/homes/home%20%2F%3F%23/measurements');
    expect(requests[0].credentials).toBe('same-origin');
    expect(requests[1].headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    expect(new URL(requests[1].url).pathname).toBe('/api/v1/auth/logout');
    snapshot.unsubscribe();
    app.dispatch(api.util.resetApiState());
  });

  it('marks the session expired on unauthorized generated requests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })));
    const app = store();
    const request = app.dispatch(api.endpoints.homes.initiate());
    await request;
    expect(app.getState().preferences.expired).toBe(true);
    request.unsubscribe();
    app.dispatch(api.util.resetApiState());
  });
});
