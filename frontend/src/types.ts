export interface Session {
  authenticated: boolean;
  csrfToken: string;
  authAvailable: boolean;
  demoAvailable: boolean;
  demo: boolean;
  expiresAt: string | null;
}
export interface Home { id: string; name: string; timezone: string }
export interface Measurement {
  id: string;
  kind: string;
  deviceName: string;
  value: number | null;
  unit: string;
  measuredAt: string | null;
  hasHistory: boolean;
  sampleMinutes?: number | null;
}
export interface Room { id: string; name: string; measurements: Measurement[] }
export interface Snapshot {
  homeId: string;
  timezone: string;
  fetchedAt: string;
  rooms: Room[];
  warnings: string[];
}
export interface History {
  measurementId: string;
  unit: string;
  from: string;
  to: string;
  points: { time: string; value: number | null }[];
}
