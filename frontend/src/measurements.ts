import type { Home, Measurement } from './types';

export function selectHome(homes: readonly Home[], savedId: string): Home | undefined {
  return homes.find(home => home.id === savedId)
    ?? [...homes].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))[0];
}
export function isAvailable(measurement: Measurement, now: number): boolean {
  if (measurement.value === null || !Number.isFinite(measurement.value) || !measurement.measuredAt) return false;
  const time = Date.parse(measurement.measuredAt);
  return Number.isFinite(time) && time <= now + 5 * 60_000 && now - time <= 30 * 60_000;
}
export function formatTime(time: string, timezone: string, language: string, date = false): string {
  return new Intl.DateTimeFormat(language, {
    timeZone: timezone, hour: '2-digit', minute: '2-digit',
    ...(date ? { day: '2-digit', month: 'short' } : {}),
  }).format(new Date(time));
}
export function historySeries(points: { time: string; value: number | null }[]) {
  const result: { time: Date; value: number | null }[] = [];
  for (const point of points) {
    const time = new Date(point.time);
    const previous = result.at(-1);
    if (previous && time.getTime() - previous.time.getTime() > 30 * 60_000)
      result.push({ time: new Date(previous.time.getTime() + 30 * 60_000), value: null });
    result.push({ time, value: point.value });
  }
  return result;
}
