import { useState } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { Navigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSnapshotQuery } from '../../../api/api';
import { visibleRooms } from '../../../book/dashboardCustomization';
import { orderRooms } from '../../../book/dashboardOrder';
import { DASHBOARD_ROUTE } from '../../../book/routes';
import { useNow } from '../../../book/useNow';
import type { Home } from '../../../entity/Home';
import type { RootState } from '../../../entity/RootState';
import DisplayIcon from '../../common/DisplayIcon/DisplayIcon';
import Failure from '../../common/Failure/Failure';
import Loading from '../../common/Loading/Loading';
import MeasurementCard from '../Dashboard/MeasurementCard';
import MeasurementHistory, { HistoryRange } from '../History/MeasurementHistory';

export default function Room({ homes }: { homes: Home[] }) {
  const { homeId, roomId } = useParams();
  const { t } = useTranslation();
  const home = homes.find(item => item.id === homeId);
  const [hours, setHours] = useState(6);
  const now = useNow();
  const query = useSnapshotQuery(homeId ?? '', { skip: !home });
  const order = useSelector((state: RootState) => state.preferences.dashboardOrders[homeId ?? '']);
  const customization = useSelector((state: RootState) => state.preferences.dashboardCustomizations[homeId ?? '']);
  const room = visibleRooms(orderRooms(query.currentData?.rooms ?? [], order), customization).find(item => item.id === roomId);
  if (!home) return <Navigate to={DASHBOARD_ROUTE} replace />;
  const cards = room?.measurements.filter(item => !item.hasHistory) ?? [];
  const charts = room?.measurements.filter(item => item.hasHistory) ?? [];
  return <Stack spacing={3}>
    {query.isError && <Failure retry={() => void query.refetch()} />}
    {query.isFetching && !query.currentData && <Loading />}
    {room && <>
      <Stack direction="row" alignItems="center" spacing={1}>
        <DisplayIcon icon={customization?.rooms[room.id]?.icon} />
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>{room.name}</Typography>
      </Stack>
      {cards.length > 0 && <Box data-testid="room-readings" sx={{
        display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 1, sm: 2 },
      }}>
        {cards.map(item => <MeasurementCard key={item.id} measurement={item} home={home} now={now} />)}
      </Box>}
      {charts.length > 0 && <>
        <HistoryRange hours={hours} change={setHours} />
        {charts.map(item => <MeasurementHistory key={item.id} measurement={item} home={home} hours={hours} />)}
      </>}
    </>}
    {query.isSuccess && !room && <Alert severity="info">{t('roomNotFound')}</Alert>}
  </Stack>;
}
