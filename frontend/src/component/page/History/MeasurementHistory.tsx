import { lazy, Suspense } from 'react';
import { Alert, Box, CircularProgress, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useHistoryQuery } from '../../../api/api';
import type { Home } from '../../../entity/Home';
import type { Measurement } from '../../../entity/Measurement';
import Failure from '../../common/Failure/Failure';

const HistoryChart = lazy(() => import('./HistoryChart'));

export function HistoryRange({ hours, change }: { hours: number; change: (hours: number) => void }) {
  const { t } = useTranslation();
  return <ToggleButtonGroup exclusive value={hours} aria-label={t('range')}
    onChange={(_, value: number | null) => { if (value !== null) change(value); }}>
    {[6, 12, 24, 48].map(range => <ToggleButton key={range} value={range}>{t('hours', { count: range })}</ToggleButton>)}
  </ToggleButtonGroup>;
}

export default function MeasurementHistory({ home, measurement, hours }: { home: Home; measurement: Measurement; hours: number }) {
  const { t, i18n } = useTranslation();
  const query = useHistoryQuery({ homeId: home.id, measurementId: measurement.id, hours });
  return <Stack spacing={2}>
    <Paper component="section" aria-label={`${t(measurement.kind)} · ${measurement.deviceName}`} elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: { xs: 1, md: 3 }, minHeight: 400, minWidth: 0 }}>
      <Typography variant="h6" component="h2" sx={{ px: 2 }}>{t(measurement.kind)} · {measurement.deviceName}</Typography>
      {query.isFetching && <Box sx={{ height: 350, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label={t('loading')} /></Box>}
      {query.isError && <Failure retry={() => void query.refetch()} />}
      {!query.isFetching && query.currentData && (query.currentData.points.some(point => point.value !== null)
        ? <Suspense fallback={<CircularProgress aria-label={t('loading')} />}>
          <HistoryChart history={query.currentData} label={t(measurement.kind)} language={i18n.language} timezone={home.timezone} hours={hours} />
        </Suspense> : <Alert severity="info">{t('noData')}</Alert>)}
      <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>{t('resolution', { timezone: home.timezone })}</Typography>
    </Paper>
    {measurement.kind === 'rain' && <Alert severity="info">{t('rainHistory')}</Alert>}
  </Stack>;
}
