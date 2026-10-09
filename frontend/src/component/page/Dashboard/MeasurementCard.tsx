import { Box, Paper, Stack, Typography } from '@mui/material';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Measurement } from '../../../entity/Measurement';
import type { Home } from '../../../entity/Home';
import { formatTime, measurementStatus } from '../../../book/measurements';
import MetricIcon from './MetricIcon';

interface MeasurementCardProps { measurement: Measurement; home: Home; now: number }

export default function MeasurementCard({ measurement, home, now }: MeasurementCardProps) {
  const { t, i18n } = useTranslation();
  const status = measurementStatus(measurement, now);
  const available = status !== 'unavailable';
  const content = <>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Box sx={{ color: 'primary.main', bgcolor: 'action.hover', p: 1, borderRadius: 2, display: 'flex' }}><MetricIcon kind={measurement.kind} /></Box>
      {measurement.hasHistory && <ArrowForward sx={{ fontSize: 18, color: 'text.secondary' }} />}
    </Stack>
    <Typography sx={{ mt: 2, fontWeight: 500, overflowWrap: 'anywhere' }}>{t(measurement.kind)}</Typography>
    <Typography component="div" sx={{
      fontSize: available ? { xs: 28, sm: 36 } : { xs: 18, sm: 22 },
      fontWeight: 600, letterSpacing: '-0.04em', mt: 1, minHeight: 54, overflowWrap: 'anywhere',
    }}>
      {available ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: ['co2', 'noise', 'humidity'].includes(measurement.kind) ? 0 : 1 }).format(measurement.value!) : t('unavailable')}
      {available && <Typography component="span" sx={{ color: 'text.secondary', ml: 0.5, fontSize: { xs: 13, sm: 16 } }}>{measurement.unit}</Typography>}
    </Typography>
    <Typography data-testid="measurement-device" variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, overflowWrap: 'anywhere' }}>
      {measurement.deviceName}
    </Typography>
    {available && measurement.measuredAt && <Typography data-testid="measurement-time" variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, mt: 1 }}>
      {t('measured', { time: formatTime(measurement.measuredAt, home.timezone, i18n.language, true) })}
    </Typography>}
    {status === 'stale' && <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 600 }}>{t('stale')}</Typography>}
    {measurement.updateFailed && <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>{t('updateFailed')}</Typography>}
    {!measurement.hasHistory && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('noHistory')}</Typography>}
    {measurement.sampleMinutes === 30 && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('sample')}</Typography>}
  </>;
  const sx = {
    p: { xs: 1.5, sm: 2.5 }, border: '1px solid', borderColor: 'divider', borderRadius: 3, minWidth: 0,
    height: '100%', textDecoration: 'none', color: 'text.primary', display: 'block',
    transition: 'border-color 150ms, transform 150ms',
    ...(measurement.hasHistory ? { '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
      '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' } } : {}),
  };
  return measurement.hasHistory
    ? <Paper elevation={0} component={Link} aria-label={`${t(measurement.kind)} · ${measurement.deviceName}`} to={`/homes/${encodeURIComponent(home.id)}/measurements/${encodeURIComponent(measurement.id)}`} sx={sx}>{content}</Paper>
    : <Paper elevation={0} sx={sx}>{content}</Paper>;
}
