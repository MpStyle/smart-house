import { builtInIcons, type DashboardCustomizations, type DisplayIcon, type HomeCustomization } from '../entity/DashboardCustomization';
import type { Room } from '../entity/Room';

export const MAX_ICON_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ICON_BYTES = 64 * 1024;
export const MAX_ICON_SIZE = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIcon(value: unknown): value is DisplayIcon {
  if (!isRecord(value)) return false;
  if (value.kind === 'builtIn') return builtInIcons.some(name => name === value.name);
  if (value.kind !== 'image' || typeof value.data !== 'string'
    || !/^data:image\/(?:png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data)) return false;
  const payload = value.data.slice(value.data.indexOf(',') + 1);
  const bytes = payload.length * 3 / 4 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
  return bytes > 0 && bytes <= MAX_ICON_BYTES;
}

function isCustomizations(value: unknown): value is DashboardCustomizations {
  return isRecord(value) && Object.values(value).every(home =>
      isRecord(home) && (home.icon === undefined || isIcon(home.icon)) && isRecord(home.rooms)
      && Object.values(home.rooms).every(room => isRecord(room)
        && (room.hidden === undefined || typeof room.hidden === 'boolean')
        && (room.icon === undefined || isIcon(room.icon))
        && (room.hiddenMeasurementIds === undefined || (Array.isArray(room.hiddenMeasurementIds)
          && room.hiddenMeasurementIds.every(id => typeof id === 'string')))));
}

export function parseCustomizations(saved: string | null): DashboardCustomizations {
  if (saved === null) return {};
  try {
    const value: unknown = JSON.parse(saved);
    if (!isCustomizations(value)) throw new Error('Invalid dashboard customization preferences.');
    return value;
  } catch (error) {
    console.warn('Saved dashboard customization could not be read.', error);
    return {};
  }
}

export function persistCustomizations(value: DashboardCustomizations): void {
  // Save before updating Redux so a quota failure cannot discard the last durable preferences.
  localStorage.setItem('smart-house.dashboardCustomizations', JSON.stringify(value));
}

export function visibleRooms(rooms: readonly Room[], home?: HomeCustomization): Room[] {
  return rooms.filter(room => !home?.rooms[room.id]?.hidden).map(room => ({
    ...room,
    measurements: room.measurements.filter(item => !home?.rooms[room.id]?.hiddenMeasurementIds?.includes(item.id)),
  })).filter(room => room.measurements.length > 0);
}

export function validateIconFile(file: File): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > MAX_ICON_FILE_BYTES)
    throw new Error('Unsupported icon format or file size.');
}

export function iconDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > 16_000_000)
    throw new Error('Invalid or excessively large icon dimensions.');
  const scale = Math.min(1, MAX_ICON_SIZE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function readIcon(file: File): Promise<DisplayIcon> {
  validateIconFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const dimensions = iconDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/webp', 0.85);
    if (!isIcon({ kind: 'image', data })) throw new Error('Optimized icon exceeds the storage limit.');
    return { kind: 'image', data };
  } finally {
    URL.revokeObjectURL(url);
  }
}
