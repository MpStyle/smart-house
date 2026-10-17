import type { Language } from './Language';
import type { ThemePreference } from './ThemePreference';
import type { DashboardOrder } from './DashboardOrder';
import type { DashboardCustomizations } from './DashboardCustomization';

export interface PreferencesState {
  language: Language;
  theme: ThemePreference;
  homeId: string;
  expired: boolean;
  dashboardOrders: Record<string, DashboardOrder>;
  dashboardCustomizations: DashboardCustomizations;
}
