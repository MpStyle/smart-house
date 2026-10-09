import type { Home } from '../entity/Home';
import type { Measurement } from '../entity/Measurement';
import type { MeasurementStatus } from '../entity/MeasurementStatus';
import type { HistoryPoint } from '../entity/HistoryPoint';
import type { HistorySeriesPoint } from '../entity/HistorySeriesPoint';

export const retentionMilliseconds = 48 * 60 * 60_000;

export function selectHome(homes: readonly Home[], savedId: string): Home | undefined {
  return homes.find(home => home.id === savedId)
    ?? [...homes].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))[0];
}
export function measurementStatus(measurement: Measurement, now: number): MeasurementStatus {
  if (measurement.value === null || !Number.isFinite(measurement.value) || !measurement.measuredAt) return 'unavailable';
  const time = Date.parse(measurement.measuredAt);
  if (!Number.isFinite(time) || time > now + 5 * 60_000 || now - time > retentionMilliseconds) return 'unavailable';
  return measurement.updateFailed || now - time > 30 * 60_000 ? 'stale' : 'fresh';
}
export function isAvailable(measurement: Measurement, now: number): boolean {
  return measurementStatus(measurement, now) !== 'unavailable';
}
export function formatTime(time: string, timezone: string, language: string, date = false): string {
  return new Intl.DateTimeFormat(language, {
    timeZone: timezone, hour: '2-digit', minute: '2-digit',
    ...(date ? { day: '2-digit', month: 'short' } : {}),
  }).format(new Date(time));
}
export function historySeries(points: HistoryPoint[]) {
  const result: HistorySeriesPoint[] = [];
  for (const point of points) {
    const time = new Date(point.time);
    const previous = result.at(-1);
    if (previous && time.getTime() - previous.time.getTime() > 30 * 60_000)
      result.push({ time: new Date(previous.time.getTime() + 30 * 60_000), value: null });
    result.push({ time, value: point.value });
  }
  return result;
}
