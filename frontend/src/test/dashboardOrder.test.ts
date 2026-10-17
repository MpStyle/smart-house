import { afterEach, describe, expect, it, vi } from 'vitest';
import { orderItems, orderRooms, parseDashboardOrders } from '../book/dashboardOrder';
import { preferences } from '../book/preferences';
import { store } from '../book/store';
import type { Room } from '../entity/Room';

afterEach(() => localStorage.clear());

describe('dashboard ordering', () => {
  it('preserves provider order by default without mutating data', () => {
    const items = [{ id: 'b' }, { id: 'a' }];
    expect(orderItems(items)).toEqual(items);
    expect(orderItems(items)).not.toBe(items);
    expect(orderItems(items, ['a', 'b'])).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(items).toEqual([{ id: 'b' }, { id: 'a' }]);
  });

  it('ignores removed IDs and appends new items in provider order', () => {
    const items = [{ id: 'new-2' }, { id: 'b' }, { id: 'new-1' }, { id: 'a' }];
    expect(orderItems(items, ['missing', 'a', 'b']).map(item => item.id)).toEqual(['a', 'b', 'new-2', 'new-1']);
  });

  it('orders rooms and each room independently without moving measurements between rooms', () => {
    const rooms: Room[] = [
      { id: 'first', name: 'First', measurements: [] },
      { id: 'second', name: 'Second', measurements: [
        { id: 'a', kind: 'temperature', deviceName: 'Device', value: 1, unit: 'C', measuredAt: null, hasHistory: false, updateFailed: false, status: 'unavailable', sampleMinutes: null },
        { id: 'b', kind: 'humidity', deviceName: 'Device', value: 2, unit: '%', measuredAt: null, hasHistory: false, updateFailed: false, status: 'unavailable', sampleMinutes: null },
      ] },
    ];
    const sorted = orderRooms(rooms, { roomIds: ['second', 'first'], measurementIds: { second: ['b', 'a'], first: ['a'] } });
    expect(sorted.map(room => room.id)).toEqual(['second', 'first']);
    expect(sorted[0].measurements.map(item => item.id)).toEqual(['b', 'a']);
    expect(sorted[1].measurements).toEqual([]);
    expect(rooms[1].measurements.map(item => item.id)).toEqual(['a', 'b']);
  });

  it('validates persisted preferences and reports malformed data', () => {
    const orders = { home: { roomIds: ['room'], measurementIds: { room: ['measurement'] } } };
    expect(parseDashboardOrders(JSON.stringify(orders))).toEqual(orders);
    expect(parseDashboardOrders(null)).toEqual({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const invalid of ['{', 'null', '[]', '{"home":{}}', '{"home":{"roomIds":[1],"measurementIds":{}}}', '{"home":{"roomIds":[],"measurementIds":{"room":"id"}}}'])
      expect(parseDashboardOrders(invalid)).toEqual({});
    expect(warn).toHaveBeenCalledTimes(6);
  });

  it('keeps homes separate and persists complete ordering automatically', () => {
    store.dispatch(preferences.actions.setRoomOrder({ homeId: 'home-1', ids: ['b', 'a'] }));
    store.dispatch(preferences.actions.setMeasurementOrder({ homeId: 'home-1', roomId: 'b', ids: ['y', 'x'] }));
    store.dispatch(preferences.actions.setRoomOrder({ homeId: 'home-2', ids: ['other'] }));
    expect(store.getState().preferences.dashboardOrders['home-1']).toEqual({
      roomIds: ['b', 'a'], measurementIds: { b: ['y', 'x'] },
    });
    expect(store.getState().preferences.dashboardOrders['home-2']).toEqual({ roomIds: ['other'], measurementIds: {} });
    expect(parseDashboardOrders(localStorage.getItem('smart-house.dashboardOrders'))).toEqual(store.getState().preferences.dashboardOrders);
  });
});
