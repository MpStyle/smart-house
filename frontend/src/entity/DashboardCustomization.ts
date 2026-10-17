export const builtInIcons = ['home', 'apartment', 'living', 'bedroom', 'kitchen', 'bathroom', 'garden', 'office'] as const;
export type BuiltInIcon = typeof builtInIcons[number];
export type DisplayIcon = { kind: 'builtIn'; name: BuiltInIcon } | { kind: 'image'; data: string };

export interface RoomCustomization {
  hidden?: boolean;
  icon?: DisplayIcon;
  hiddenMeasurementIds?: string[];
}

export interface HomeCustomization {
  icon?: DisplayIcon;
  rooms: Record<string, RoomCustomization>;
}

export type DashboardCustomizations = Record<string, HomeCustomization>;
