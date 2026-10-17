import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHistoryQuery, useSnapshotQuery } from '../api/api';
import { preferences } from '../book/preferences';
import { createRoomRoute, ROOM_ROUTE } from '../book/routes';
import { store } from '../book/store';
import Room from '../component/page/Room/Room';
import DashboardCustomization from '../component/page/Settings/DashboardCustomization';

vi.mock('../api/api', async importOriginal => ({
  ...await importOriginal<typeof import('../api/api')>(),
  useSnapshotQuery: vi.fn(),
  useHistoryQuery: vi.fn(),
}));
vi.mock('../component/page/History/HistoryChart', () => ({ default: () => <p>Chart loaded</p> }));
vi.mock('../book/i18n', () => ({ selectLanguage: vi.fn() }));

const home = { id: 'test-home', name: 'Test home', timezone: 'UTC' };
const measurement = { id: 'chart-a', kind: 'temperature', deviceName: 'Sensor A', value: 21, unit: '°C',
  measuredAt: new Date().toISOString(), hasHistory: true, updateFailed: false, status: 'fresh' as const, sampleMinutes: null };
const rooms = [{ id: 'room/?', name: 'Living', measurements: [
  measurement, { ...measurement, id: 'card', kind: 'absolutePressure', hasHistory: false },
  { ...measurement, id: 'chart-b', deviceName: 'Sensor B' },
] }];

beforeEach(() => {
  store.dispatch(preferences.actions.setCustomizations({}));
  store.dispatch(preferences.actions.setMeasurementOrder({ homeId: home.id, roomId: rooms[0].id, ids: ['chart-b', 'chart-a', 'card'] }));
  localStorage.clear();
  vi.mocked(useSnapshotQuery).mockReturnValue({
    currentData: { homeId: home.id, timezone: 'UTC', fetchedAt: measurement.measuredAt, rooms, warnings: [] },
    isSuccess: true, isError: false, isFetching: false, refetch: vi.fn(),
  } as ReturnType<typeof useSnapshotQuery>);
  vi.mocked(useHistoryQuery).mockReturnValue({
    isFetching: false, isError: false, currentData: undefined, refetch: vi.fn(),
  } as ReturnType<typeof useHistoryQuery>);
  vi.mocked(useHistoryQuery).mockClear();
});
afterEach(() => { cleanup(); localStorage.clear(); });

function renderRoom() {
  return render(<Provider store={store}><MemoryRouter initialEntries={[createRoomRoute(home.id, rooms[0].id)]}>
    <Routes><Route path={ROOM_ROUTE} element={<Room homes={[home]} />} /></Routes>
  </MemoryRouter></Provider>);
}

describe('room details', () => {
  it('renders non-history cards before charts, using the configured chart order and shared range', () => {
    renderRoom();
    expect(screen.getByRole('heading', { level: 1, name: 'Living' })).toBeInTheDocument();
    const charts = screen.getAllByRole('region');
    expect(charts.map(item => item.getAttribute('aria-label'))).toEqual(['Temperature · Sensor B', 'Temperature · Sensor A']);
    expect(screen.getByTestId('room-readings').compareDocumentPosition(charts[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(useHistoryQuery).toHaveBeenCalledWith({ homeId: home.id, measurementId: 'chart-b', hours: 6 });
    fireEvent.click(screen.getByRole('button', { name: '24 h' }));
    expect(useHistoryQuery).toHaveBeenCalledWith({ homeId: home.id, measurementId: 'chart-a', hours: 24 });
    expect(useHistoryQuery).not.toHaveBeenCalledWith(expect.objectContaining({ measurementId: 'card' }));
  });

  it('omits hidden readings and displays rooms with only non-history cards without history requests', () => {
    store.dispatch(preferences.actions.setCustomizations({ [home.id]: { rooms: {
      [rooms[0].id]: { hiddenMeasurementIds: ['chart-a', 'chart-b'] },
    } } }));
    renderRoom();
    expect(screen.getByText('Absolute pressure')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Time range' })).not.toBeInTheDocument();
    expect(useHistoryQuery).not.toHaveBeenCalled();
  });

  it('does not fetch histories for hidden rooms', () => {
    store.dispatch(preferences.actions.setCustomizations({ [home.id]: { rooms: { [rooms[0].id]: { hidden: true } } } }));
    renderRoom();
    expect(screen.getByRole('alert')).toHaveTextContent('no visible readings');
    expect(useHistoryQuery).not.toHaveBeenCalled();
  });
});

describe('customization settings', () => {
  it('keeps hidden entries editable and saves visibility, icons and reset immediately', () => {
    render(<Provider store={store}><DashboardCustomization home={home} /></Provider>);
    const region = within(screen.getByRole('region', { name: 'Customize Living' }));
    fireEvent.click(region.getByRole('switch', { name: 'Show room: Living' }));
    expect(region.getByRole('switch', { name: 'Show room: Living' })).not.toBeChecked();
    fireEvent.click(within(region.getByRole('group', { name: 'Icon for room: Living' })).getByRole('button', { name: 'Garden' }));
    const saved = JSON.parse(localStorage.getItem('smart-house.dashboardCustomizations')!);
    expect(saved[home.id].rooms[rooms[0].id]).toMatchObject({ hidden: true, icon: { kind: 'builtIn', name: 'garden' } });
    fireEvent.click(region.getByRole('button', { name: 'Reset icon' }));
    expect(store.getState().preferences.dashboardCustomizations[home.id].rooms[rooms[0].id].icon).toBeUndefined();
  });

  it('reports quota errors without changing current or persisted preferences', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    render(<Provider store={store}><DashboardCustomization home={home} /></Provider>);
    fireEvent.click(screen.getByRole('switch', { name: 'Show room: Living' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Your previous settings have been kept');
    expect(screen.getByRole('switch', { name: 'Show room: Living' })).toBeChecked();
    expect(store.getState().preferences.dashboardCustomizations).toEqual({});
  });
});
