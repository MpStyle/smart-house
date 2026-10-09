import { useNavigate } from 'react-router-dom';
import { DASHBOARD_ROUTE } from './routes';

export function hasPreviousAppEntry(state: unknown): boolean {
  return state !== null && typeof state === 'object' && 'idx' in state
    && typeof state.idx === 'number' && Number.isInteger(state.idx) && state.idx > 0;
}

export function useBackNavigation() {
  const navigate = useNavigate();
  return () => {
    if (hasPreviousAppEntry(window.history.state)) navigate(-1);
    else navigate(DASHBOARD_ROUTE, { replace: true });
  };
}
