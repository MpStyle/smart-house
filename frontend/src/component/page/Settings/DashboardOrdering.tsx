import { Alert, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useSnapshotQuery } from '../../../api/api';
import { orderRooms } from '../../../book/dashboardOrder';
import { preferences } from '../../../book/preferences';
import type { Home } from '../../../entity/Home';
import type { AppDispatch } from '../../../entity/AppDispatch';
import type { RootState } from '../../../entity/RootState';
import Failure from '../../common/Failure/Failure';
import Loading from '../../common/Loading/Loading';
import SortableList from './SortableList';

export default function DashboardOrdering({ home }: { home: Home }) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const query = useSnapshotQuery(home.id, { refetchOnMountOrArgChange: true });
  const order = useSelector((state: RootState) => state.preferences.dashboardOrders[home.id]);
  const rooms = orderRooms(query.currentData?.rooms ?? [], order);
  return <Stack spacing={3}>
    <Typography variant="h5" component="h2">{t('dashboardOrder')}</Typography>
    <Typography color="text.secondary">{t('orderHint')}</Typography>
    <Typography variant="body2" color="text.secondary">{t('sortKeyboard')}</Typography>
    {query.isError && <Failure retry={() => void query.refetch()} />}
    {query.isFetching && !query.currentData && <Loading />}
    {query.currentData && rooms.length === 0 && <Alert severity="info">{t('noMeasurements')}</Alert>}
    {rooms.length > 0 && <>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" component="h3" sx={{ mb: 2 }}>{t('roomOrder')}</Typography>
        <SortableList label={t('roomOrder')} items={rooms.map(room => ({ id: room.id, label: room.name }))}
          reorder={ids => dispatch(preferences.actions.setRoomOrder({ homeId: home.id, ids }))} />
      </Paper>
      {rooms.map(room => <Paper key={room.id} component="section" aria-label={t('measurementOrder', { room: room.name })}
        variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" component="h3" sx={{ mb: 2 }}>{t('measurementOrder', { room: room.name })}</Typography>
        <SortableList label={t('measurementOrder', { room: room.name })}
          items={room.measurements.map(measurement => ({
            id: measurement.id, label: t(measurement.kind), detail: measurement.deviceName,
          }))}
          reorder={ids => dispatch(preferences.actions.setMeasurementOrder({ homeId: home.id, roomId: room.id, ids }))} />
      </Paper>)}
    </>}
  </Stack>;
}
