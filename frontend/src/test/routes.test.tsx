import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useMatch, useParams } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createHistoryRoute, DASHBOARD_ROUTE, FALLBACK_ROUTE, HISTORY_ROUTE, SETTINGS_ROUTE } from '../book/routes';
import MeasurementCard from '../component/page/Dashboard/MeasurementCard';
import type { Measurement } from '../entity/Measurement';

afterEach(cleanup);

function HistoryParameters() {
  const params = useParams();
  const match = useMatch(HISTORY_ROUTE);
  return <output data-testid="history-parameters">{JSON.stringify({ params, matched: match !== null })}</output>;
}

describe('frontend routes', () => {
  it('preserves the existing dashboard, history and catch-all paths', () => {
    expect(DASHBOARD_ROUTE).toBe('/');
    expect(HISTORY_ROUTE).toBe('/homes/:homeId/measurements/:measurementId');
    expect(FALLBACK_ROUTE).toBe('*');
    expect(SETTINGS_ROUTE).toBe('/settings');
    expect(createHistoryRoute('demo-home', 'thermostat:Temperature'))
      .toBe('/homes/demo-home/measurements/thermostat%3ATemperature');
  });

  it('encodes each ID as one segment and resolves it through the shared route pattern', () => {
    const homeId = 'Casa /?#[%] è';
    const measurementId = 'sensore:/temperatura ?#%';
    const path = createHistoryRoute(homeId, measurementId);
    expect(path).toBe(`/homes/${encodeURIComponent(homeId)}/measurements/${encodeURIComponent(measurementId)}`);
    render(<MemoryRouter initialEntries={[path]}>
      <Routes><Route path={HISTORY_ROUTE} element={<HistoryParameters />} /></Routes>
    </MemoryRouter>);
    expect(screen.getByTestId('history-parameters')).toHaveTextContent(JSON.stringify({
      params: { homeId, measurementId }, matched: true,
    }));
  });

  it('uses the shared link builder for MeasurementCard', () => {
    const now = Date.now();
    const home = { id: 'home /?', name: 'Home', timezone: 'UTC' };
    const measurement: Measurement = {
      id: 'device:Temperature', kind: 'temperature', deviceName: 'Thermostat',
      value: 21, unit: '°C', measuredAt: new Date(now).toISOString(),
      hasHistory: true, updateFailed: false, status: 'fresh',
    };
    render(<MemoryRouter><MeasurementCard home={home} measurement={measurement} now={now} /></MemoryRouter>);
    expect(screen.getByRole('link')).toHaveAttribute('href', createHistoryRoute(home.id, measurement.id));
  });

  it('keeps unknown routes redirecting to the dashboard', () => {
    render(<MemoryRouter initialEntries={['/not-a-page']}>
      <Routes>
        <Route path={DASHBOARD_ROUTE} element={<p>Dashboard</p>} />
        <Route path={FALLBACK_ROUTE} element={<Navigate to={DASHBOARD_ROUTE} replace />} />
      </Routes>
    </MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
