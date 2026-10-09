import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { preferences } from './preferences';
import type { AppDispatch } from '../entity/AppDispatch';
import type { Session } from '../entity/Session';

export function useSessionExpiration(session?: Session) {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    if (!session?.authenticated || !session.expiresAt) return;
    const expires = Date.parse(session.expiresAt);
    const check = () => { if (Date.now() >= expires) dispatch(preferences.actions.setExpired(true)); };
    const timer = window.setTimeout(check, Math.max(0, expires - Date.now()));
    document.addEventListener('visibilitychange', check);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
  }, [session, dispatch]);
}
