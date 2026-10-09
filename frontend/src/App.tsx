import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, Route, Routes, useMatch, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert, AppBar, Box, Button, Chip, CircularProgress, Container, CssBaseline, FormControl, InputLabel,
  MenuItem, Paper, Select, Skeleton, Stack, ThemeProvider, ToggleButton, ToggleButtonGroup, Toolbar,
  Typography, createTheme, useMediaQuery,
} from '@mui/material';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Refresh from '@mui/icons-material/Refresh';
import ThermostatOutlined from '@mui/icons-material/ThermostatOutlined';
import WaterDropOutlined from '@mui/icons-material/WaterDropOutlined';
import Air from '@mui/icons-material/Air';
import WbSunnyOutlined from '@mui/icons-material/WbSunnyOutlined';
import GraphicEq from '@mui/icons-material/GraphicEq';
import Co2 from '@mui/icons-material/Co2';
import { api, useDemoMutation, useHistoryQuery, useHomesQuery, useLogoutMutation, useSessionQuery, useSnapshotQuery } from './api';
import { isLanguage, languages, preferences } from './preferences';
import type { AppDispatch, RootState } from './store';
import type { Home, Measurement, Session } from './types';
import { formatTime, isAvailable, selectHome } from './measurements';

const HistoryChart = lazy(() => import('./HistoryChart'));

const languageNames = { en: 'English', it: 'Italiano', fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português' };
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}
function Failure({ retry }: { retry: () => void }) {
  const { t } = useTranslation();
  return <Alert severity="error" action={<Button color="inherit" onClick={retry}>{t('retry')}</Button>}>{t('error')}</Alert>;
}
function Loading() {
  const { t } = useTranslation();
  return <Box role="status" aria-label={t('loading')} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
    {[1, 2, 3, 4].map(index => <Skeleton key={index} variant="rounded" height={190} />)}
  </Box>;
}
function Preferences() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const selected = useSelector((state: RootState) => state.preferences);
  return <Stack direction="row" spacing={1}>
    <FormControl size="small" sx={{ minWidth: 108 }}>
      <InputLabel id="language-label">{t('language')}</InputLabel>
      <Select labelId="language-label" label={t('language')} value={selected.language}
        onChange={event => { if (isLanguage(event.target.value)) dispatch(preferences.actions.setLanguage(event.target.value)); }}>
        {languages.map(language => <MenuItem key={language} value={language}>{languageNames[language]}</MenuItem>)}
      </Select>
    </FormControl>
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <InputLabel id="theme-label">{t('theme')}</InputLabel>
      <Select labelId="theme-label" label={t('theme')} value={selected.theme}
        onChange={event => {
          const value = event.target.value;
          if (value === 'system' || value === 'light' || value === 'dark') dispatch(preferences.actions.setTheme(value));
        }}>
        {['system', 'light', 'dark'].map(theme => <MenuItem value={theme} key={theme}>{t(theme)}</MenuItem>)}
      </Select>
    </FormControl>
  </Stack>;
}
function Header({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return <AppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
    <Toolbar sx={{ gap: 2, py: 2, flexWrap: 'wrap', justifyContent: 'space-between', maxWidth: 1248, width: '100%', mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <HomeOutlined color="primary" sx={{ fontSize: 32 }} />
        <Box><Typography sx={{ fontWeight: 700, letterSpacing: '-0.04em', fontSize: 22 }}>smart house</Typography>
          <Typography variant="caption" color="text.secondary">{t('tagline')}</Typography></Box>
      </Stack>
      {children}
      <Preferences />
    </Toolbar>
  </AppBar>;
}
function Login({ session, reload }: { session: Session; reload: () => Promise<unknown> }) {
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
function MetricIcon({ kind }: { kind: string }) {
  if (kind.toLowerCase().includes('temperature')) return <ThermostatOutlined />;
  if (kind === 'co2') return <Co2 />;
  if (kind === 'noise') return <GraphicEq />;
  if (kind === 'humidity' || kind.startsWith('rain')) return <WaterDropOutlined />;
  if (kind.toLowerCase().includes('wind') || kind.startsWith('gust')) return <Air />;
  return <WbSunnyOutlined />;
}
export function MeasurementCard({ measurement, home, now }: { measurement: Measurement; home: Home; now: number }) {
  const { t, i18n } = useTranslation();
  const available = isAvailable(measurement, now);
  const content = <>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Box sx={{ color: 'primary.main', bgcolor: 'action.hover', p: 1, borderRadius: 2, display: 'flex' }}><MetricIcon kind={measurement.kind} /></Box>
      {measurement.hasHistory && <ArrowForward sx={{ fontSize: 18, color: 'text.secondary' }} />}
    </Stack>
    <Typography sx={{ mt: 2, fontWeight: 500 }}>{t(measurement.kind)}</Typography>
    <Typography component="div" sx={{ fontSize: available ? 36 : 22, fontWeight: 600, letterSpacing: '-0.04em', mt: 1, minHeight: 54 }}>
      {available ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: ['co2', 'noise', 'humidity'].includes(measurement.kind) ? 0 : 1 }).format(measurement.value!) : t('unavailable')}
      {available && <Typography component="span" sx={{ color: 'text.secondary', ml: 1, fontSize: 16 }}>{measurement.unit}</Typography>}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{measurement.deviceName}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
      {measurement.measuredAt ? t('measured', { time: formatTime(measurement.measuredAt, home.timezone, i18n.language, true) }) : t('unavailable')}
    </Typography>
    {!measurement.hasHistory && <Typography variant="caption" color="text.secondary">{t('noHistory')}</Typography>}
    {measurement.sampleMinutes === 30 && <Typography variant="caption" color="text.secondary">{t('sample')}</Typography>}
  </>;
  const sx = {
    p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3,
    height: '100%', textDecoration: 'none', color: 'text.primary', display: 'block',
    transition: 'border-color 150ms, transform 150ms',
    ...(measurement.hasHistory ? { '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
      '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' } } : {}),
  };
  return measurement.hasHistory
    ? <Paper elevation={0} component={Link} to={`/homes/${encodeURIComponent(home.id)}/measurements/${encodeURIComponent(measurement.id)}`} sx={sx}>{content}</Paper>
    : <Paper elevation={0} sx={sx}>{content}</Paper>;
}
function Dashboard({ home, refreshHomes }: { home: Home; refreshHomes: () => Promise<unknown> }) {
  const { t, i18n } = useTranslation();
  const query = useSnapshotQuery(home.id, { refetchOnMountOrArgChange: true });
  const now = useNow();
  const snapshot = query.currentData;
  return <Stack spacing={4}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ sm: 'flex-end' }}>
      <Box>
        <Typography variant="overline" color="text.secondary">{home.name}</Typography>
        <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 600, letterSpacing: '-0.04em' }}>{t('overview')}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{t('overviewHint')}</Typography>
      </Box>
      <Button variant="outlined" startIcon={<Refresh />} disabled={query.isFetching} onClick={async () => {
        await refreshHomes();
        await query.refetch();
      }}>{t('refresh')}</Button>
    </Stack>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          {room.measurements.map(measurement => <MeasurementCard key={measurement.id} measurement={measurement} home={home} now={now} />)}
        </Box>
      </Box>)}
    </>}
  </Stack>;
}
function HistoryPage({ homes }: { homes: Home[] }) {
  const { homeId, measurementId } = useParams();
  const { t, i18n } = useTranslation();
  const home = homes.find(item => item.id === homeId);
  const [hours, setHours] = useState(6);
  const snapshot = useSnapshotQuery(homeId ?? '', { skip: !home });
  const measurement = snapshot.currentData?.rooms.flatMap(room => room.measurements).find(item => item.id === measurementId);
  const query = useHistoryQuery({ homeId: homeId ?? '', measurementId: measurementId ?? '', hours }, { skip: !home || !measurement?.hasHistory });
  if (!home) return <Navigate to="/" replace />;
  return <Stack spacing={3}>
    <Button component={Link} to="/" startIcon={<ArrowBack />} sx={{ alignSelf: 'flex-start' }}>{t('back')}</Button>
    {snapshot.isError && <Failure retry={() => void snapshot.refetch()} />}
    {snapshot.isLoading && <Loading />}
    {measurement && <>
      <Typography variant="overline" color="text.secondary">{t('history')} · {home.name}</Typography>
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
function Authenticated({ session }: { session: Session }) {
  const { t } = useTranslation();
  const query = useHomesQuery();
  const [logout, logoutState] = useLogoutMutation();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const historyRoute = useMatch('/homes/:homeId/measurements/:measurementId');
  const selected = useSelector((state: RootState) => state.preferences.homeId);
  const homes = query.data?.homes ?? [];
  const home = homes.find(item => item.id === historyRoute?.params.homeId) ?? selectHome(homes, selected);
  useEffect(() => { if (home && home.id !== selected) dispatch(preferences.actions.setHome(home.id)); }, [home, selected, dispatch]);
  return <>
    <Header>
        {home && <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="home-label">{t('home')}</InputLabel>
          <Select labelId="home-label" label={t('home')} value={home.id} onChange={event => {
            dispatch(preferences.actions.setHome(event.target.value)); navigate('/');
          }}>
            {homes.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </Select>
        </FormControl>}
        <Button disabled={logoutState.isLoading} onClick={async () => {
          try { await logout(session.csrfToken).unwrap(); dispatch(api.util.resetApiState()); }
          catch (error) { console.error('Sign-out failed.', error); }
        }}>{t('logout')}</Button>
    </Header>
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {logoutState.isError && <Alert severity="error">{t('error')}</Alert>}
      {session.demo && <Alert severity="info" sx={{ mb: 3 }}>{t('demoNotice')}</Alert>}
      {query.isLoading && <Loading />}
      {query.isError && <Failure retry={() => void query.refetch()} />}
      {query.data?.warnings.length ? <Alert severity="warning" sx={{ mb: 3 }}>{t('partial')}</Alert> : null}
      {query.isSuccess && homes.length === 0 && <Alert severity="info">{t('noHomes')}</Alert>}
      {home && <Routes>
        <Route path="/" element={<Dashboard key={home.id} home={home} refreshHomes={async () => { await query.refetch(); }} />} />
        <Route path="/homes/:homeId/measurements/:measurementId" element={<HistoryPage key={window.location.hash} homes={homes} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>}
    </Container>
  </>;
}
export default function App() {
  const dispatch = useDispatch<AppDispatch>();
  const pref = useSelector((state: RootState) => state.preferences);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode = pref.theme === 'system' ? (systemDark ? 'dark' : 'light') : pref.theme;
  const theme = useMemo(() => createTheme({
    palette: { mode, primary: { main: mode === 'light' ? '#246d68' : '#82cbc0' },
      background: { default: mode === 'light' ? '#f4f6f3' : '#101b1d', paper: mode === 'light' ? '#ffffff' : '#19292b' } },
    shape: { borderRadius: 12 },
    typography: { fontFamily: '"Avenir Next", "Segoe UI", sans-serif', button: { textTransform: 'none', fontWeight: 600 } },
    components: { MuiButton: { styleOverrides: { root: { boxShadow: 'none', padding: '10px 20px' } } } },
  }), [mode]);
  const session = useSessionQuery();
  useEffect(() => { document.documentElement.lang = pref.language; }, [pref.language]);
  useEffect(() => {
    if (!session.data?.authenticated || !session.data.expiresAt) return;
    const expires = Date.parse(session.data.expiresAt);
    const check = () => { if (Date.now() >= expires) dispatch(preferences.actions.setExpired(true)); };
    const timer = window.setTimeout(check, Math.max(0, expires - Date.now()));
    document.addEventListener('visibilitychange', check);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
  }, [session.data, dispatch]);
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    {(!session.data?.authenticated || pref.expired) && <Header />}
    {session.isLoading && <Container sx={{ py: 6 }}><Loading /></Container>}
    {session.isError && <Container sx={{ py: 6 }}><Failure retry={() => void session.refetch()} /></Container>}
    {session.data && (session.data.authenticated && !pref.expired
      ? <Authenticated session={session.data} />
      : <Login session={session.data} reload={async () => { await session.refetch(); }} />)}
  </ThemeProvider>;
}
