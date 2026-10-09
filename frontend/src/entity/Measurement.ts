import type { MeasurementStatus } from './MeasurementStatus';

export interface Measurement {
  id: string;
  kind: string;
  deviceName: string;
  value: number | null;
  unit: string;
  measuredAt: string | null;
  hasHistory: boolean;
  sampleMinutes?: number | null;
  updateFailed: boolean;
  status: MeasurementStatus;
}
