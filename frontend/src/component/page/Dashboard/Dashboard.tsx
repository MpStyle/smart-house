import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useSnapshotQuery } from '../../../api/api';
import { formatTime } from '../../../book/measurements';
import { useNow } from '../../../book/useNow';
import { orderRooms } from '../../../book/dashboardOrder';
import type { Home } from '../../../entity/Home';
import type { RootState } from '../../../entity/RootState';
import Failure from '../../common/Failure/Failure';
import Loading from '../../common/Loading/Loading';
import PageActions from '../../common/PageActions/PageActions';
import MeasurementCard from './MeasurementCard';
import IconButton from '@mui/material/IconButton';

interface DashboardProps { home: Home; refreshHomes: () => Promise<unknown> }

export default function Dashboard({ home, refreshHomes }: DashboardProps) {
  const { t, i18n } = useTranslation();
  const query = useSnapshotQuery(home.id, { refetchOnMountOrArgChange: true });
  const now = useNow();
  const snapshot = query.currentData;
  const order = useSelector((state: RootState) => state.preferences.dashboardOrders[home.id]);
  const rooms = orderRooms(snapshot?.rooms ?? [], order);

  return <Stack spacing={4}>
    <PageActions>
      <IconButton disabled={query.isFetching} 
                  title={t("refresh")}
                  onClick={async () => {
                    await refreshHomes();
                    await query.refetch();
                  }}>
        <Refresh />
      </IconButton>
    </PageActions>

    {query.isError && <Failure retry={() => void query.refetch()} />}

    {query.isFetching && !snapshot && <Loading />}

    {snapshot && <>

      {snapshot.rooms.length === 0 && <Alert severity="info">{t('noMeasurements')}</Alert>}

      {rooms.map(room => <Box key={room.id} component="section" aria-label={room.name}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          {room.name}
        </Typography>

        <Box data-testid="measurement-grid" sx={{
          display: 'grid', 
          gridTemplateColumns: { 
            xs: 'repeat(2, minmax(0, 1fr))', 
            md: 'repeat(3, minmax(0, 1fr))', 
            lg: 'repeat(4, minmax(0, 1fr))'
          }, 
          gap: { 
            xs: 1, 
            sm: 2 
          },
        }}>
          {room.measurements.map(measurement => <MeasurementCard key={measurement.id} 
                                                                 measurement={measurement} 
                                                                 home={home} 
                                                                 now={now} />)}
        </Box>
        
      </Box>)}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={t('roomCount', { count: snapshot.rooms.length })} variant="outlined" />
        <Chip label={t('measureCount', { count: snapshot.rooms.reduce<number>((count, room) => count + room.measurements.length, 0) })} variant="outlined" />
        <Chip label={t('updated', { time: formatTime(snapshot.fetchedAt, home.timezone, i18n.language) })} variant="outlined" />
      </Stack>
    </>}
  </Stack>;
}
