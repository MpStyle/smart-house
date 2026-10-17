import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { preferences } from '../book/preferences';
import { logApiRequest, logApiResponse } from './logging';

const fetch = fetchBaseQuery({ baseUrl: '/', credentials: 'same-origin' });

export const baseApi = createApi({
  reducerPath: 'netatmo',
  baseQuery: async (args, context, options) => {
    logApiRequest(args);
    const response = await fetch(args, context, options);
    logApiResponse(args, response);
    if (response.error?.status === 401) context.dispatch(preferences.actions.setExpired(true));
    return response;
  },
  keepUnusedDataFor: 60,
  endpoints: () => ({}),
});
