import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { changeLanguage } from './store';
import type { AppDispatch } from '../entity/AppDispatch';
import type { RootState } from '../entity/RootState';
import { initialLanguage } from './preferences';

export function useTranslations() {
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((root: RootState) => root.translations);
  useEffect(() => { void dispatch(changeLanguage(initialLanguage)); }, [dispatch]);
  return { ...state, retry: () => { void dispatch(changeLanguage(initialLanguage)); } };
}
