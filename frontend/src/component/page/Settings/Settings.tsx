import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Home } from '../../../entity/Home';
import DashboardOrdering from './DashboardOrdering';
import Preferences from './Preferences';

export default function Settings({ home }: { home?: Home }) {
  const { t } = useTranslation();
  return <Stack spacing={4}>
    <Typography variant="h4" component="h1">{t('settings')}</Typography>
    <Preferences />
    {home && <DashboardOrdering key={home.id} home={home} />}
  </Stack>;
}
