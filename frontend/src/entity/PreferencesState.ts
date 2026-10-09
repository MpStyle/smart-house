import type { Language } from './Language';
import type { ThemePreference } from './ThemePreference';

export interface PreferencesState {
  language: Language;
  theme: ThemePreference;
  homeId: string;
  expired: boolean;
}
