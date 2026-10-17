import { baseApi as api } from "./baseApi";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    health: build.query<HealthApiResponse, HealthApiArg>({
      query: () => ({ url: `/api/v1/health` }),
    }),
    session: build.query<SessionApiResponse, SessionApiArg>({
      query: () => ({ url: `/api/v1/auth/session` }),
    }),
    login: build.query<LoginApiResponse, LoginApiArg>({
      query: () => ({ url: `/api/v1/auth/login` }),
    }),
    logout: build.mutation<LogoutApiResponse, LogoutApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/auth/logout`,
        method: "POST",
        headers: {
          "X-CSRF-TOKEN": queryArg,
        },
      }),
    }),
    demo: build.mutation<DemoApiResponse, DemoApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/auth/demo`,
        method: "POST",
        headers: {
          "X-CSRF-TOKEN": queryArg,
        },
      }),
    }),
    homes: build.query<HomesApiResponse, HomesApiArg>({
      query: () => ({ url: `/api/v1/homes` }),
    }),
    snapshot: build.query<SnapshotApiResponse, SnapshotApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/homes/${encodeURIComponent(String(queryArg))}/measurements`,
      }),
    }),
    history: build.query<HistoryApiResponse, HistoryApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/homes/${encodeURIComponent(String(queryArg.homeId))}/history/${encodeURIComponent(String(queryArg.measurementId))}`,
        params: {
          hours: queryArg.hours,
        },
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as generatedApi };
export type HealthApiResponse = /** status 200 OK */ HealthResponse;
export type HealthApiArg = void;
export type SessionApiResponse = /** status 200 OK */ SessionResponse;
export type SessionApiArg = void;
export type LoginApiResponse = unknown;
export type LoginApiArg = void;
export type LogoutApiResponse = unknown;
export type LogoutApiArg = string;
export type DemoApiResponse = unknown;
export type DemoApiArg = string;
export type HomesApiResponse = /** status 200 OK */ HomesResponse;
export type HomesApiArg = void;
export type SnapshotApiResponse = /** status 200 OK */ SnapshotResponse;
export type SnapshotApiArg = string;
export type HistoryApiResponse = /** status 200 OK */ History;
export type HistoryApiArg = {
  homeId: string;
  measurementId: string;
  hours?: number;
};
export type HealthResponse = {
  status: string;
};
export type SessionResponse = {
  authenticated: boolean;
  csrfToken: string;
  authAvailable: boolean;
  demoAvailable: boolean;
  demo: boolean;
  expiresAt: string | null;
};
export type ApiError = {
  code: string;
};
export type HomeResponse = {
  id: string;
  name: string;
  timezone: string;
};
export type HomesResponse = {
  homes: HomeResponse[];
  warnings: string[];
  accountName: string | null;
};
export type MeasurementStatus = "fresh" | "stale" | "unavailable";
export type MeasurementResponse = {
  id: string;
  kind: string;
  deviceName: string;
  value: number | null;
  unit: string;
  measuredAt: string | null;
  hasHistory: boolean;
  updateFailed: boolean;
  status: MeasurementStatus;
  sampleMinutes: number | null;
};
export type RoomResponse = {
  id: string;
  name: string;
  measurements: MeasurementResponse[];
};
export type SnapshotResponse = {
  homeId: string;
  timezone: string;
  fetchedAt: string;
  rooms: RoomResponse[];
  warnings: string[];
};
export type HistoryPoint = {
  time: string;
  value: number | null;
};
export type History = {
  measurementId: string;
  unit: string;
  from: string;
  to: string;
  points: HistoryPoint[];
};
export const {
  useHealthQuery,
  useSessionQuery,
  useLoginQuery,
  useLogoutMutation,
  useDemoMutation,
  useHomesQuery,
  useSnapshotQuery,
  useHistoryQuery,
} = injectedRtkApi;
