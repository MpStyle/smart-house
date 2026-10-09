import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { useSnapshotQuery } from '../../../api/api';
import { formatTime } from '../../../book/measurements';
import { useNow } from '../../../book/useNow';
import type { Home } from '../../../entity/Home';
import Failure from '../../common/Failure/Failure';
import Loading from '../../common/Loading/Loading';
import PageActions from '../../common/PageActions/PageActions';
import MeasurementCard from './MeasurementCard';

interface DashboardProps { home: Home; refreshHomes: () => Promise<unknown> }

export default function Dashboard({ home, refreshHomes }: DashboardProps) {
  const { t, i18n } = useTranslation();
  const query = useSnapshotQuery(home.id, { refetchOnMountOrArgChange: true });
  const now = useNow();
  const snapshot = query.currentData;
  return <Stack spacing={4}>
    <PageActions><Button variant="outlined" startIcon={<Refresh />} disabled={query.isFetching} onClick={async () => {
      await refreshHomes();
      await query.refetch();
    }}>{t('refresh')}</Button></PageActions>
    <Box>
      <Typography variant="overline" color="text.secondary">{home.name}</Typography>
      <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 600, letterSpacing: '-0.04em' }}>{t('overview')}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>{t('overviewHint')}</Typography>
    </Box>
    {query.isError && <Failure retry={() => void query.refetch()} />}
    {query.isFetching && !snapshot && <Loading />}
    {snapshot && <>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={t('roomCount', { count: snapshot.rooms.length })} variant="outlined" />
        <Chip label={t('measureCount', { count: snapshot.rooms.reduce<number>((count, room) => count + room.measurements.length, 0) })} variant="outlined" />
        <Chip label={t('updated', { time: formatTime(snapshot.fetchedAt, home.timezone, i18n.language) })} variant="outlined" />
      </Stack>
      {snapshot.warnings.length > 0 && <Alert severity="warning">{t('partial')}</Alert>}
      {snapshot.rooms.length === 0 && <Alert severity="info">{t('noMeasurements')}</Alert>}
      {snapshot.rooms.map(room => <Box key={room.id} component="section" aria-label={room.name}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>{room.name}</Typography>
        <Box data-testid="measurement-grid" sx={{
          display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, sm: 2 },
        }}>
          {room.measurements.map(measurement => <MeasurementCard key={measurement.id} measurement={measurement} home={home} now={now} />)}
        </Box>
      </Box>)}
    </>}
  </Stack>;
}
