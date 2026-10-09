import { useState } from 'react';
import { Alert, Button, Container, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { Navigate, Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { api, useHomesQuery, useLogoutMutation } from '../../../api/api';
import { useSelectedHome } from '../../../book/useSelectedHome';
import { PageActionsContext } from '../../../book/pageActions';
import { preferences } from '../../../book/preferences';
import type { AppDispatch } from '../../../entity/AppDispatch';
import type { Session } from '../../../entity/Session';
import AppBar from '../AppBar/AppBar';
import Failure from '../Failure/Failure';
import Loading from '../Loading/Loading';
import Dashboard from '../../page/Dashboard/Dashboard';
import History from '../../page/History/History';

interface AuthenticatedProps { session: Session }

export default function Authenticated({ session }: AuthenticatedProps) {
  const { t } = useTranslation();
  const query = useHomesQuery();
  const [logout, logoutState] = useLogoutMutation();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const historyRoute = useMatch('/homes/:homeId/measurements/:measurementId');
  const homes = query.data?.homes ?? [];
  const home = useSelectedHome(homes, historyRoute?.params.homeId);
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  return <PageActionsContext.Provider value={actionsTarget}>
    <AppBar actionsRef={setActionsTarget}>
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
    </AppBar>
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      {logoutState.isError && <Alert severity="error">{t('error')}</Alert>}
      {session.demo && <Alert severity="info" sx={{ mb: 3 }}>{t('demoNotice')}</Alert>}
      {query.isLoading && <Loading />}
      {query.isError && <Failure retry={() => void query.refetch()} />}
      {query.data?.warnings.length ? <Alert severity="warning" sx={{ mb: 3 }}>{t('partial')}</Alert> : null}
      {query.isSuccess && homes.length === 0 && <Alert severity="info">{t('noHomes')}</Alert>}
      {home && <Routes>
        <Route path="/" element={<Dashboard key={home.id} home={home} refreshHomes={async () => { await query.refetch(); }} />} />
        <Route path="/homes/:homeId/measurements/:measurementId" element={<History key={window.location.hash} homes={homes} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>}
    </Container>
  </PageActionsContext.Provider>;
}
