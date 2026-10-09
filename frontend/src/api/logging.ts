import type { FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta } from '@reduxjs/toolkit/query';

const sensitiveKey = /token|cookie|authorization|secret|password|csrf|accountName|email|mail/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
      [key, sensitiveKey.test(key) ? '[REDACTED]' : redact(entry)]));
  return value;
}

export function logApiRequest(args: string | FetchArgs): void {
  if (!import.meta.env.DEV) return;
  const request = typeof args === 'string' ? { url: args } : args;
  console.log('API request', { method: request.method ?? 'GET', url: request.url, body: redact(request.body) });
}

export function logApiResponse(args: string | FetchArgs, response: {
  data?: unknown; error?: FetchBaseQueryError; meta?: FetchBaseQueryMeta;
}): void {
  if (!import.meta.env.DEV) return;
  console.log('API response', {
    url: typeof args === 'string' ? args : args.url,
    status: response.meta?.response?.status ?? response.error?.status,
    body: redact(response.data ?? response.error),
  });
}
