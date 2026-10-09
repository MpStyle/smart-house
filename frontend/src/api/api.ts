import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { preferences } from '../book/preferences';
import type { History } from '../entity/History';
import type { Homes } from '../entity/Homes';
import type { HistoryRequest } from '../entity/HistoryRequest';
import type { Session } from '../entity/Session';
import type { Snapshot } from '../entity/Snapshot';
import { logApiRequest, logApiResponse } from './logging';

const fetch = fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' });
export const api = createApi({
  reducerPath: 'netatmo',
  baseQuery: async (args, context, options) => {
    logApiRequest(args);
    const response = await fetch(args, context, options);
    logApiResponse(args, response);
    if (response.error?.status === 401) context.dispatch(preferences.actions.setExpired(true));
    return response;
  },
  keepUnusedDataFor: 60,
  endpoints: builder => ({
    session: builder.query<Session, void>({ query: () => '/auth/session' }),
    homes: builder.query<Homes, void>({ query: () => '/homes/' }),
    snapshot: builder.query<Snapshot, string>({
      query: homeId => `/homes/${encodeURIComponent(homeId)}/measurements`,
    }),
    history: builder.query<History, HistoryRequest>({
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
