import { lazy, Suspense, useState } from 'react';
import { Alert, Box, CircularProgress, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHistoryQuery, useSnapshotQuery } from '../../../api/api';
import { DASHBOARD_ROUTE } from '../../../book/routes';
import type { Home } from '../../../entity/Home';
import Failure from '../../common/Failure/Failure';
import Loading from '../../common/Loading/Loading';

const HistoryChart = lazy(() => import('./HistoryChart'));
interface HistoryProps { homes: Home[] }

export default function History({ homes }: HistoryProps) {
  const { homeId, measurementId } = useParams();
  const { t, i18n } = useTranslation();
  const home = homes.find(item => item.id === homeId);
  const [hours, setHours] = useState(6);
  const snapshot = useSnapshotQuery(homeId ?? '', { skip: !home });
  const measurement = snapshot.currentData?.rooms.flatMap(room => room.measurements).find(item => item.id === measurementId);
  const query = useHistoryQuery({ homeId: homeId ?? '', measurementId: measurementId ?? '', hours }, { skip: !home || !measurement?.hasHistory });
  
  if (!home) return <Navigate to={DASHBOARD_ROUTE} replace />;

  return <Stack spacing={3}>
    {snapshot.isError && <Failure retry={() => void snapshot.refetch()} />}

    {snapshot.isLoading && <Loading />}

    {measurement && <>
      <Typography variant="h3" sx={{ fontSize: { xs: 32, md: 44 }, fontWeight: 600 }}>{t(measurement.kind)}</Typography>
      <Typography color="text.secondary">{measurement.deviceName} · {measurement.unit}</Typography>

      {!measurement.hasHistory ? <Alert severity="info">{t('historyMissing')}</Alert> : <>
        <ToggleButtonGroup exclusive value={hours} aria-label={t('range')} onChange={(_, value: number | null) => { if (value !== null) setHours(value); }}>
          {[6, 12, 24, 48].map(range => <ToggleButton key={range} value={range}>{t('hours', { count: range })}</ToggleButton>)}
        </ToggleButtonGroup>
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: { xs: 1, md: 3 }, minHeight: 400 }}>
          {query.isFetching && <Box sx={{ height: 350, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label={t('loading')} /></Box>}
          {query.isError && <Failure retry={() => void query.refetch()} />}
          {!query.isFetching && query.currentData && (query.currentData.points.some(point => point.value !== null)
            ? <Suspense fallback={<CircularProgress aria-label={t('loading')} />}>
              <HistoryChart history={query.currentData} label={t(measurement.kind)} language={i18n.language} timezone={home.timezone} hours={hours} />
            </Suspense> : <Alert severity="info">{t('noData')}</Alert>)}
          <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>{t('resolution', { timezone: home.timezone })}</Typography>
        </Paper>
        {measurement.kind === 'rain' && <Alert severity="info">{t('rainHistory')}</Alert>}
      </>}
    </>}
    {snapshot.isSuccess && !measurement && <Alert severity="info">{t('notFound')}</Alert>}
  </Stack>;
}
