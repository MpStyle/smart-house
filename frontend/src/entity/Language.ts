export const languages = ['en', 'it', 'fr', 'de', 'es', 'pt'] as const;
export type Language = typeof languages[number];
