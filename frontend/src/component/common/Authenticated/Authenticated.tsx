import { useState } from 'react';
import { Alert, Container, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { Navigate, Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { api, useHomesQuery, useLogoutMutation } from '../../../api/api';
import { useSelectedHome } from '../../../book/useSelectedHome';
import { PageActionsContext } from '../../../book/pageActions';
import { preferences } from '../../../book/preferences';
import { DASHBOARD_ROUTE, FALLBACK_ROUTE, HISTORY_ROUTE, SETTINGS_ROUTE } from '../../../book/routes';
import type { AppDispatch } from '../../../entity/AppDispatch';
import type { Session } from '../../../entity/Session';
import AppBar from '../AppBar/AppBar';
import Failure from '../Failure/Failure';
import Loading from '../Loading/Loading';
import Dashboard from '../../page/Dashboard/Dashboard';
import History from '../../page/History/History';
import Settings from '../../page/Settings/Settings';
import AccountMenu from '../AccountMenu/AccountMenu';

interface AuthenticatedProps { session: Session }

export default function Authenticated({ session }: AuthenticatedProps) {
  const { t } = useTranslation();
  const query = useHomesQuery();
  const [logout, logoutState] = useLogoutMutation();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const historyRoute = useMatch(HISTORY_ROUTE);
  const settingsRoute = useMatch(SETTINGS_ROUTE);
  const homes = query.data?.homes ?? [];
  const home = useSelectedHome(homes, historyRoute?.params.homeId);
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  
  return <PageActionsContext.Provider value={actionsTarget}>
    <AppBar actionsRef={setActionsTarget} showBack={historyRoute !== null || settingsRoute !== null}
      account={<AccountMenu name={session.demo ? t('demoAccount') : query.data?.accountName || t('account')}
        loggingOut={logoutState.isLoading} logout={async () => {
          try { await logout(session.csrfToken).unwrap(); dispatch(api.util.resetApiState()); }
          catch (error) { console.error('Sign-out failed.', error); }
        }} />}>
          
      {home && <FormControl size="small" sx={{ minWidth: 220 }}>
        <InputLabel id="home-label">{t('home')}</InputLabel>

        <Select labelId="home-label" label={t('home')} value={home.id} onChange={event => {
          dispatch(preferences.actions.setHome(event.target.value));
          if (!settingsRoute) navigate(DASHBOARD_ROUTE);
        }}>
          {homes.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
        </Select>
      </FormControl>}
    </AppBar>

    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {logoutState.isError && <Alert severity="error">{t('error')}</Alert>}

      {session.demo && <Alert severity="info" sx={{ mb: 3 }}>{t('demoNotice')}</Alert>}

      {query.isLoading && <Loading />}

      {query.isError && <Failure retry={() => void query.refetch()} />}

      {query.isSuccess && homes.length === 0 && <Alert severity="info">{t('noHomes')}</Alert>}
      
      <Routes>
        <Route path={DASHBOARD_ROUTE} element={home ? <Dashboard key={home.id} home={home} refreshHomes={async () => { await query.refetch(); }} /> : null} />
        <Route path={HISTORY_ROUTE} element={home ? <History key={window.location.hash} homes={homes} /> : null} />
        <Route path={SETTINGS_ROUTE} element={<Settings home={home} />} />
        <Route path={FALLBACK_ROUTE} element={<Navigate to={DASHBOARD_ROUTE} replace />} />
      </Routes>
    </Container>
  </PageActionsContext.Provider>;
}
