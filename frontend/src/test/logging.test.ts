import { afterEach, expect, it, vi } from 'vitest';
import { logApiRequest, logApiResponse, redact } from '../api/logging';

afterEach(() => vi.unstubAllEnvs());

it('redacts nested credentials and never logs request headers', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubEnv('DEV', true);
  logApiRequest({ url: '/auth/demo', headers: { 'X-CSRF-TOKEN': 'private-header' }, body: { csrfToken: 'private-body', name: 'demo' } });
  logApiResponse('/auth/session', { data: { csrfToken: 'private-response', authenticated: true, accountName: 'private-identity', email: 'private-email' } });
  expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  expect(JSON.stringify(log.mock.calls)).toContain('REDACTED');
  expect(redact([{ authorization: 'secret', nested: { refreshToken: 'secret', value: 21 } }]))
    .toEqual([{ authorization: '[REDACTED]', nested: { refreshToken: '[REDACTED]', value: 21 } }]);
});

it('does not log request or response payloads in production', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubEnv('DEV', false);
  logApiRequest('/homes/');
  logApiResponse('/homes/', { data: { homes: [] } });
  expect(log).not.toHaveBeenCalled();
});
