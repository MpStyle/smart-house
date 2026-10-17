import { generatePath } from 'react-router-dom';

export const DASHBOARD_ROUTE = '/';
export const SETTINGS_ROUTE = '/settings';
export const HISTORY_ROUTE = '/homes/:homeId/measurements/:measurementId';
export const ROOM_ROUTE = '/homes/:homeId/rooms/:roomId';
export const FALLBACK_ROUTE = '*';

export function createHistoryRoute(homeId: string, measurementId: string): string {
  return generatePath(HISTORY_ROUTE, { homeId, measurementId });
}

export function createRoomRoute(homeId: string, roomId: string): string {
  return generatePath(ROOM_ROUTE, { homeId, roomId });
}
