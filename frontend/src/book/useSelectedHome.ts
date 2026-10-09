import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { preferences } from './preferences';
import { selectHome } from './measurements';
import type { AppDispatch } from '../entity/AppDispatch';
import type { RootState } from '../entity/RootState';
import type { Home } from '../entity/Home';

export function useSelectedHome(homes: Home[], routeHomeId?: string) {
  const dispatch = useDispatch<AppDispatch>();
  const selected = useSelector((state: RootState) => state.preferences.homeId);
  const home = homes.find(item => item.id === routeHomeId) ?? selectHome(homes, selected);
  useEffect(() => { if (home && home.id !== selected) dispatch(preferences.actions.setHome(home.id)); }, [home, selected, dispatch]);
  return home;
}
