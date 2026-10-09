import type { DashboardOrder } from '../entity/DashboardOrder';
import type { Room } from '../entity/Room';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === 'string');
}

function isDashboardOrders(value: unknown): value is Record<string, DashboardOrder> {
  return isRecord(value) && Object.values(value).every(order =>
    isRecord(order) && isIds(order.roomIds) && isRecord(order.measurementIds)
    && Object.values(order.measurementIds).every(isIds));
}

export function parseDashboardOrders(saved: string | null): Record<string, DashboardOrder> {
  if (saved === null) return {};
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!isDashboardOrders(parsed))
      throw new Error('Invalid dashboard order preferences.');
    return parsed;
  } catch (error) {
    console.warn('Saved dashboard ordering could not be read.', error);
    return {};
  }
}

export function orderItems<T extends { id: string }>(items: readonly T[], ids: readonly string[] = []): T[] {
  const positions = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort((a, b) =>
    (positions.get(a.id) ?? ids.length) - (positions.get(b.id) ?? ids.length));
}

export function orderRooms(rooms: readonly Room[], order?: DashboardOrder): Room[] {
  return orderItems(rooms, order?.roomIds).map(room => ({
    ...room, measurements: orderItems(room.measurements, order?.measurementIds[room.id]),
  }));
}
