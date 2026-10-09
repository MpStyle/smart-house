import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { preferences } from './preferences';
import type { History, Home, Session, Snapshot } from './types';

const fetch = fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' });
export const api = createApi({
  reducerPath: 'netatmo',
  baseQuery: async (args, context, options) => {
    const response = await fetch(args, context, options);
    if (response.error?.status === 401) context.dispatch(preferences.actions.setExpired(true));
    return response;
  },
  keepUnusedDataFor: 60,
  endpoints: builder => ({
    session: builder.query<Session, void>({ query: () => '/auth/session' }),
    homes: builder.query<{ homes: Home[]; warnings: string[] }, void>({ query: () => '/homes/' }),
    snapshot: builder.query<Snapshot, string>({
      query: homeId => `/homes/${encodeURIComponent(homeId)}/measurements`,
    }),
    history: builder.query<History, { homeId: string; measurementId: string; hours: number }>({
      query: ({ homeId, measurementId, hours }) =>
        `/homes/${encodeURIComponent(homeId)}/history/${encodeURIComponent(measurementId)}?hours=${hours}`,
    }),
    logout: builder.mutation<void, string>({
      query: csrfToken => ({ url: '/auth/logout', method: 'POST', headers: { 'X-CSRF-TOKEN': csrfToken } }),
    }),
    demo: builder.mutation<void, string>({
      query: csrfToken => ({ url: '/auth/demo', method: 'POST', headers: { 'X-CSRF-TOKEN': csrfToken } }),
    }),
  }),
});
export const {
  useSessionQuery, useHomesQuery, useSnapshotQuery, useHistoryQuery,
  useLogoutMutation, useDemoMutation,
} = api;
