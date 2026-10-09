import { Alert, Button, Chip, Container, Stack, Typography } from '@mui/material';
import WbSunnyOutlined from '@mui/icons-material/WbSunnyOutlined';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useDemoMutation } from '../../../api/api';
import { preferences } from '../../../book/preferences';
import type { AppDispatch } from '../../../entity/AppDispatch';
import type { RootState } from '../../../entity/RootState';
import type { Session } from '../../../entity/Session';

interface LoginProps { session: Session; reload: () => Promise<unknown> }

export default function Login({ session, reload }: LoginProps) {
  const { t } = useTranslation();
  const [demo, demoState] = useDemoMutation();
  const dispatch = useDispatch<AppDispatch>();
  const expired = useSelector((state: RootState) => state.preferences.expired);
  return <Container maxWidth="lg" sx={{ py: { xs: 5, md: 12 } }}>
    <Stack spacing={4} sx={{ maxWidth: 770 }}>
      <Chip icon={<WbSunnyOutlined />} label="NETATMO · SMART HOUSE" sx={{ alignSelf: 'flex-start', letterSpacing: 2 }} />
      <Typography variant="h1" sx={{ fontSize: { xs: 44, md: 76 }, lineHeight: 1.06, fontWeight: 700, letterSpacing: '-0.055em' }}>{t('welcome')}</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 20, maxWidth: 620, lineHeight: 1.7 }}>{t('intro')}</Typography>
      {expired && <Alert severity="info">{t('expired')}</Alert>}
      {new URLSearchParams(window.location.search).has('authError') && <Alert severity="error">{t('authError')}</Alert>}
      {!session.authAvailable && <Alert severity="info">{t('configuration')}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignSelf: 'flex-start' }}>
        <Button variant="contained" size="large" href="/api/auth/login" disabled={!session.authAvailable} endIcon={<ArrowForward />}>{t('login')}</Button>
        {session.demoAvailable && <Button variant="outlined" size="large" disabled={demoState.isLoading} onClick={async () => {
          try { await demo(session.csrfToken).unwrap(); dispatch(preferences.actions.setExpired(false)); await reload(); }
          catch (error) { console.error('Demo sign-in failed.', error); }
        }}>{t('demo')}</Button>}
      </Stack>
      {demoState.isError && <Alert severity="error">{t('error')}</Alert>}
      <Typography variant="body2" color="text.secondary">{t('privacy')}</Typography>
    </Stack>
  </Container>;
}
