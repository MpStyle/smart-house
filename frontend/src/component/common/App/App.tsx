import { useEffect } from 'react';
import { Container, CssBaseline, ThemeProvider } from '@mui/material';
import { useSelector } from 'react-redux';
import { useSessionQuery } from '../../../api/api';
import { useAppTheme } from '../../../book/useAppTheme';
import { useSessionExpiration } from '../../../book/useSessionExpiration';
import type { RootState } from '../../../entity/RootState';
import AppBar from '../AppBar/AppBar';
import Authenticated from '../Authenticated/Authenticated';
import Failure from '../Failure/Failure';
import Loading from '../Loading/Loading';
import Login from '../../page/Login/Login';

export default function App() {
  const pref = useSelector((state: RootState) => state.preferences);
  const theme = useAppTheme();
  const session = useSessionQuery();
  useSessionExpiration(session.data);
  useEffect(() => { document.documentElement.lang = pref.language; }, [pref.language]);
  return <ThemeProvider theme={theme}>
    <CssBaseline />
    {(!session.data?.authenticated || pref.expired) && <AppBar />}
    {session.isLoading && <Container sx={{ py: 6 }}><Loading /></Container>}
    {session.isError && <Container sx={{ py: 6 }}><Failure retry={() => void session.refetch()} /></Container>}
    {session.data && (session.data.authenticated && !pref.expired
      ? <Authenticated session={session.data} />
      : <Login session={session.data} reload={async () => { await session.refetch(); }} />)}
  </ThemeProvider>;
}
