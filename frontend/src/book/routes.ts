import { generatePath } from 'react-router-dom';

export const DASHBOARD_ROUTE = '/';
export const SETTINGS_ROUTE = '/settings';
export const HISTORY_ROUTE = '/homes/:homeId/measurements/:measurementId';
export const FALLBACK_ROUTE = '*';

export function createHistoryRoute(homeId: string, measurementId: string): string {
  return generatePath(HISTORY_ROUTE, { homeId, measurementId });
}
