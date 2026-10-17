import { useState } from 'react';
import { Alert, FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useSnapshotQuery } from '../../../api/api';
import { persistCustomizations } from '../../../book/dashboardCustomization';
import { orderRooms } from '../../../book/dashboardOrder';
import { preferences } from '../../../book/preferences';
import type { HomeCustomization, RoomCustomization } from '../../../entity/DashboardCustomization';
import type { Home } from '../../../entity/Home';
import type { RootState } from '../../../entity/RootState';
import Failure from '../../common/Failure/Failure';
import Loading from '../../common/Loading/Loading';
import IconPicker from './IconPicker';

export default function DashboardCustomization({ home }: { home: Home }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const customizations = useSelector((state: RootState) => state.preferences.dashboardCustomizations);
  const order = useSelector((state: RootState) => state.preferences.dashboardOrders[home.id]);
  const saved = customizations[home.id] ?? { rooms: {} };
  const query = useSnapshotQuery(home.id);
  const [error, setError] = useState(false);
  function save(update: (current: HomeCustomization) => HomeCustomization) {
    const current = store.getState().preferences.dashboardCustomizations;
    const next = { ...current, [home.id]: update(current[home.id] ?? { rooms: {} }) };
    try {
      persistCustomizations(next);
      dispatch(preferences.actions.setCustomizations(next));
      setError(false);
    } catch (error) {
      console.error('Dashboard customization could not be saved.', error);
      setError(true);
    }
  }
  function saveRoom(id: string, value: Partial<RoomCustomization>) {
    save(current => ({ ...current, rooms: { ...current.rooms, [id]: { ...current.rooms[id], ...value } } }));
  }
  return <Stack spacing={3} component="section" aria-label={t('customizeDashboard')}>
    <Typography variant="h5" component="h2">{t('customizeDashboard')}</Typography>
    <Typography color="text.secondary">{t('customizationHint')}</Typography>
    {error && <Alert severity="error">{t('preferenceSaveError')}</Alert>}
    <Paper variant="outlined" sx={{ p: 2 }}>
      <IconPicker label={t('homeIcon', { name: home.name })} icon={saved.icon}
        change={icon => save(current => ({ ...current, icon }))} />
    </Paper>
    {query.isError && <Failure retry={() => void query.refetch()} />}
    {query.isFetching && !query.currentData && <Loading />}
    {orderRooms(query.currentData?.rooms ?? [], order).map(room => {
      const value = saved.rooms[room.id] ?? {};
      return <Paper key={room.id} component="section" aria-label={t('customizeRoom', { name: room.name })} variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6" component="h3">{room.name}</Typography>
          <FormControlLabel label={t('showRoom', { name: room.name })} control={<Switch checked={!value.hidden}
            onChange={(_, checked) => saveRoom(room.id, { hidden: !checked })} />} />
          <IconPicker label={t('roomIcon', { name: room.name })} icon={value.icon}
            change={icon => saveRoom(room.id, { icon })} />
          {room.measurements.map(item => <FormControlLabel key={item.id}
            label={t('showMeasurement', { name: `${t(item.kind)} · ${item.deviceName}` })}
            control={<Switch checked={!value.hiddenMeasurementIds?.includes(item.id)}
              onChange={(_, checked) => saveRoom(room.id, {
                hiddenMeasurementIds: checked ? (value.hiddenMeasurementIds ?? []).filter(id => id !== item.id)
                  : [...(value.hiddenMeasurementIds ?? []), item.id],
              })} />} />)}
        </Stack>
      </Paper>;
    })}
  </Stack>;
}
