import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  iconDimensions, MAX_ICON_BYTES, MAX_ICON_FILE_BYTES, parseCustomizations,
  persistCustomizations, readIcon, validateIconFile, visibleRooms,
} from '../book/dashboardCustomization';
import type { DashboardCustomizations } from '../entity/DashboardCustomization';
import type { Room } from '../entity/Room';
import en from '../locales/en.json';
import itTranslations from '../locales/it.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import pt from '../locales/pt.json';

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

describe('local dashboard customizations', () => {
  it('round-trips home and room choices independently, accepting only supported icons', () => {
    const value: DashboardCustomizations = {
      first: { icon: { kind: 'builtIn', name: 'home' }, rooms: { living: { hidden: true, hiddenMeasurementIds: ['a'] } } },
      second: { rooms: { living: { icon: { kind: 'image', data: 'data:image/webp;base64,YQ==' } } } },
    };
    persistCustomizations(value);
    expect(parseCustomizations(localStorage.getItem('smart-house.dashboardCustomizations'))).toEqual(value);
    expect(parseCustomizations(null)).toEqual({});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const raw of ['{', '[]', 'null', '{"home":{}}',
      '{"home":{"rooms":{"room":{"hidden":"yes"}}}}',
      '{"home":{"rooms":{"room":{"hiddenMeasurementIds":[1]}}}}',
      '{"home":{"rooms":{},"icon":{"kind":"builtIn","name":"unknown"}}}',
      '{"home":{"rooms":{},"icon":{"kind":"image","data":"data:image/svg+xml;base64,YQ=="}}}'])
      expect(parseCustomizations(raw)).toEqual({});
    expect(warn).toHaveBeenCalledTimes(8);
  });

  it('enforces the exact optimized image byte limit including base64 padding', () => {
    const value = (bytes: number) => JSON.stringify({ home: {
      rooms: {}, icon: { kind: 'image', data: `data:image/png;base64,${btoa('a'.repeat(bytes))}` },
    } });
    expect(Object.keys(parseCustomizations(value(MAX_ICON_BYTES)))).toEqual(['home']);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseCustomizations(value(MAX_ICON_BYTES + 1))).toEqual({});
  });

  it('propagates storage failures and keeps the previous durable settings', () => {
    const previous = { home: { rooms: {} } };
    persistCustomizations(previous);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(() => persistCustomizations({})).toThrow('Full');
    expect(parseCustomizations(localStorage.getItem('smart-house.dashboardCustomizations'))).toEqual(previous);
  });

  it('filters without mutating provider data, retaining order and ignoring obsolete saved IDs', () => {
    const measurement = { id: 'a', kind: 'temperature', deviceName: 'Device', value: 21, unit: '°C',
      measuredAt: null, hasHistory: true, updateFailed: false, status: 'unavailable' as const, sampleMinutes: null };
    const rooms: Room[] = [
      { id: 'hidden', name: 'Hidden', measurements: [measurement] },
      { id: 'empty', name: 'Empty', measurements: [] },
      { id: 'living', name: 'Living', measurements: [measurement, { ...measurement, id: 'b' }] },
    ];
    expect(visibleRooms(rooms, { rooms: {
      hidden: { hidden: true }, living: { hiddenMeasurementIds: ['a', 'removed'] },
    } }).map(room => [room.id, room.measurements.map(item => item.id)])).toEqual([['living', ['b']]]);
    expect(rooms[2].measurements).toHaveLength(2);
    expect(visibleRooms(rooms).map(room => room.id)).toEqual(['hidden', 'living']);
    expect(visibleRooms(rooms, { rooms: { hidden: { hidden: true }, living: { hidden: true } } })).toEqual([]);
  });

  it('provides all new interface translations in each supported language', () => {
    const keys = Object.keys(en).filter(key => key.startsWith('icon_') || [
      'customizeDashboard', 'customizationHint', 'showRoom', 'showMeasurement', 'customizeRoom', 'homeIcon',
      'roomIcon', 'uploadIcon', 'uploadIconFor', 'resetIcon', 'iconLimits', 'iconUploadError',
      'preferenceSaveError', 'noVisibleMeasurements', 'roomNotFound',
    ].includes(key));
    for (const locale of [itTranslations, fr, de, es, pt])
      for (const key of keys) expect(locale).toHaveProperty(key, expect.any(String));
  });
});

describe('icon uploads', () => {
  it('accepts only raster files within the exact input byte limit', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp'])
      expect(() => validateIconFile(new File(['a'], 'icon', { type }))).not.toThrow();
    expect(() => validateIconFile(new File([new Uint8Array(MAX_ICON_FILE_BYTES)], 'icon', { type: 'image/png' }))).not.toThrow();
    for (const file of [
      new File(['svg'], 'icon.svg', { type: 'image/svg+xml' }),
      new File(['gif'], 'icon.gif', { type: 'image/gif' }),
      new File([], 'empty.png', { type: 'image/png' }),
      new File([new Uint8Array(MAX_ICON_FILE_BYTES + 1)], 'large.png', { type: 'image/png' }),
    ]) expect(() => validateIconFile(file)).toThrow();
  });

  it('preserves aspect ratio, never upscales, and limits decoded pixels', () => {
    expect(iconDimensions(512, 256)).toEqual({ width: 128, height: 64 });
    expect(iconDimensions(64, 128)).toEqual({ width: 64, height: 128 });
    expect(iconDimensions(1, 1000)).toEqual({ width: 1, height: 128 });
    for (const [width, height] of [[0, 1], [1, -1], [Infinity, 1], [NaN, 1], [4001, 4000]])
      expect(() => iconDimensions(width, height)).toThrow();
  });

  it('rejects corrupt images and revokes their temporary object URLs', async () => {
    const decode = vi.fn().mockRejectedValue(new Error('Invalid image'));
    vi.stubGlobal('Image', class { src = ''; naturalWidth = 512; naturalHeight = 256; decode = decode; });
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:icon', revokeObjectURL: revoke });
    await expect(readIcon(new File(['broken'], 'icon.png', { type: 'image/png' }))).rejects.toThrow('Invalid image');
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:icon');
  });
});
