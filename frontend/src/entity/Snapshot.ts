import type { Room } from './Room';

export interface Snapshot {
  homeId: string;
  timezone: string;
  fetchedAt: string;
  rooms: Room[];
  warnings: string[];
}
