import type { HistoryPoint } from './HistoryPoint';

export interface History {
  measurementId: string;
  unit: string;
  from: string;
  to: string;
  points: HistoryPoint[];
}
