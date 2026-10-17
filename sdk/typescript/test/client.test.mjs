import assert from 'node:assert/strict';
import test from 'node:test';
import { SmartHouseClient, ApiException } from '../dist/client.js';

test('uses versioned paths, encoded identifiers, and exact history ranges', async () => {
  const requests = [];
  const client = new SmartHouseClient('https://house.example', {
    fetch: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ measurementId: 'device:Temperature', points: [{ value: null }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const history = await client.history('home /?#', 'device:Temperature', 12);
  assert.equal(requests[0].url, 'https://house.example/api/v1/homes/home%20%2F%3F%23/history/device%3ATemperature?hours=12');
  assert.equal(history.points[0].value, null);
});

test('passes CSRF tokens and cancellation signals to Fetch', async () => {
  const signal = new AbortController().signal;
  const client = new SmartHouseClient('', {
    fetch: async (url, options) => {
      assert.equal(url, '/api/v1/auth/logout');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['X-CSRF-TOKEN'], 'csrf');
      assert.equal(options.signal, signal);
      return new Response(null, { status: 204 });
    },
  });
  await client.logout('csrf', signal);
});

test('surfaces authentication and typed provider errors instead of returning empty data', async () => {
  const unauthorized = new SmartHouseClient('', {
    fetch: async () => new Response(null, { status: 401 }),
  });
  await assert.rejects(unauthorized.homes(), error => error instanceof ApiException && error.status === 401);
  const unavailable = new SmartHouseClient('', {
    fetch: async () => new Response('{"code":"provider_unavailable"}', { status: 502 }),
  });
  await assert.rejects(unavailable.homes(), error => error.code === 'provider_unavailable');
});
