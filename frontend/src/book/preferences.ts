import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { languages, type Language } from '../entity/Language';
import type { PreferencesState } from '../entity/PreferencesState';
import type { ThemePreference } from '../entity/ThemePreference';
export function readPreference(key: string): string | null {
  try { return localStorage.getItem(`smart-house.${key}`); }
  catch (error) { console.warn('Browser preferences are unavailable.', error); return null; }
}
export function writePreference(key: string, value: string): void {
  try { localStorage.setItem(`smart-house.${key}`, value); }
  catch (error) { console.warn('Browser preference could not be saved.', error); }
}
export function isLanguage(value: string | null): value is Language {
  return languages.some(language => language === value);
}
export function detectLanguage(browserLanguages: readonly string[]): Language {
  for (const locale of browserLanguages) {
    const language = locale.split('-')[0].toLowerCase();
    if (isLanguage(language)) return language;
  }
  return 'en';
}
const savedLanguage = readPreference('language');
const savedTheme = readPreference('theme');
export const initialLanguage = isLanguage(savedLanguage) ? savedLanguage : detectLanguage(navigator.languages);
const initialState: PreferencesState = {
  language: initialLanguage,
  theme: savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system',
  homeId: readPreference('home') ?? '',
  expired: false,
};
export const preferences = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setLanguage(state, action: PayloadAction<Language>) { state.language = action.payload; },
    setTheme(state, action: PayloadAction<ThemePreference>) { state.theme = action.payload; },
    setHome(state, action: PayloadAction<string>) { state.homeId = action.payload; },
    setExpired(state, action: PayloadAction<boolean>) { state.expired = action.payload; },
  },
});
