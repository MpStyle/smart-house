import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Home } from '../../../entity/Home';
import DashboardOrdering from './DashboardOrdering';
import Preferences from './Preferences';
import DashboardCustomization from './DashboardCustomization';

export default function Settings({ home }: { home?: Home }) {
  const { t } = useTranslation();
  return <Stack spacing={4}>
    <Typography variant="h4" component="h1">{t('settings')}</Typography>
    <Preferences />
    {home && <DashboardCustomization key={`custom-${home.id}`} home={home} />}
    {home && <DashboardOrdering key={home.id} home={home} />}
  </Stack>;
}
