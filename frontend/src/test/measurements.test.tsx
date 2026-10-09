import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { MeasurementCard } from '../App';
import { detectLanguage } from '../preferences';
import { formatTime, historySeries, isAvailable, selectHome } from '../measurements';
import { translations } from '../i18n';
import type { Measurement } from '../types';

afterEach(cleanup);
const home = { id: 'home', name: 'Casa', timezone: 'Europe/Rome' };
const now = Date.parse('2026-10-02T10:00:00Z');
const measurement: Measurement = {
  id: 'temperature', kind: 'temperature', deviceName: 'Station', value: 21.2,
  unit: '°C', measuredAt: new Date(now).toISOString(), hasHistory: true,
};

describe('dashboard behavior', () => {
  it('expires at the exact 30-minute boundary without fetching', () => {
    expect(isAvailable(measurement, now + 30 * 60_000)).toBe(true);
    expect(isAvailable(measurement, now + 30 * 60_000 + 1)).toBe(false);
    const view = render(<MemoryRouter><MeasurementCard measurement={measurement} home={home} now={now} /></MemoryRouter>);
    expect(screen.getByText('21.2')).toBeInTheDocument();
    view.rerender(<MemoryRouter><MeasurementCard measurement={measurement} home={home} now={now + 30 * 60_000 + 1} /></MemoryRouter>);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByText('21.2')).not.toBeInTheDocument();
  });
  it('never links a measurement without history', () => {
    render(<MemoryRouter><MeasurementCard measurement={{ ...measurement, hasHistory: false }} home={home} now={now} /></MemoryRouter>);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('History unavailable')).toBeInTheDocument();
  });
  it('restores an authorized home or selects the first alphabetically', () => {
    const homes = [{ ...home, id: 'z', name: 'Zurich' }, { ...home, id: 'a', name: 'Amsterdam' }];
    expect(selectHome(homes, 'z')?.id).toBe('z');
    expect(selectHome(homes, 'deleted')?.id).toBe('a');
    expect(selectHome([], 'deleted')).toBeUndefined();
  });
  it('detects all supported languages and falls back to English', () => {
    expect(detectLanguage(['nl-NL', 'it-IT'])).toBe('it');
    expect(detectLanguage(['pt-BR'])).toBe('pt');
    expect(detectLanguage(['zh-CN'])).toBe('en');
  });
  it('has complete translations in all six languages', () => {
    const expected = Object.keys(translations.en).sort();
    for (const dictionary of Object.values(translations)) expect(Object.keys(dictionary).sort()).toEqual(expected);
  });
  it('formats using the home timezone, including daylight saving', () => {
    expect(formatTime('2026-07-01T10:00:00Z', 'Europe/Rome', 'it')).toBe('12:00');
    expect(formatTime('2026-12-01T10:00:00Z', 'Europe/Rome', 'it')).toBe('11:00');
  });
  it('preserves missing history rather than interpolating over outages', () => {
    const result = historySeries([{ time: '2026-10-02T08:00:00Z', value: 21 }, { time: '2026-10-02T10:00:00Z', value: 22 }]);
    expect(result.map(point => point.value)).toEqual([21, null, 22]);
  });
});
