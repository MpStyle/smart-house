import { Box, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function Loading() {
  const { t } = useTranslation();
  return <Box role="status" aria-label={t('loading')} sx={{
    display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fit, minmax(240px, 1fr))' }, gap: 2,
  }}>
    {[1, 2, 3, 4].map(index => <Skeleton key={index} variant="rounded" height={190} />)}
  </Box>;
}
