import type { Language } from './Language';
import type { ThemePreference } from './ThemePreference';
import type { DashboardOrder } from './DashboardOrder';

export interface PreferencesState {
  language: Language;
  theme: ThemePreference;
  homeId: string;
  expired: boolean;
  dashboardOrders: Record<string, DashboardOrder>;
}
