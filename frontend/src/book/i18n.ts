import i18n from 'i18next';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';
import { initialLanguage, isLanguage } from './preferences';
import { languages, type Language } from '../entity/Language';
import enUrl from '../locales/en.json?url';
import itUrl from '../locales/it.json?url';
import frUrl from '../locales/fr.json?url';
import deUrl from '../locales/de.json?url';
import esUrl from '../locales/es.json?url';
import ptUrl from '../locales/pt.json?url';

const urls = { en: enUrl, it: itUrl, fr: frUrl, de: deUrl, es: esUrl, pt: ptUrl };
const backend = new HttpBackend();
const initialized = i18n.use(backend).use(initReactI18next).init({
  resources: {},
  lng: initialLanguage,
  supportedLngs: [...languages],
  load: 'languageOnly',
  fallbackLng: false,
  backend: { loadPath: (requested: string[]) => {
    const language = requested[0];
    if (!isLanguage(language)) throw new Error(`Unsupported translation language: ${language}`);
    return urls[language];
  } },
  maxRetries: 0,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

async function load(language: Language): Promise<void> {
  await initialized;
  if (i18n.hasResourceBundle(language, 'translation')) return;
  await new Promise<void>((resolve, reject) => {
    backend.read(language, 'translation', (error: unknown, data: unknown) => {
      if (error) { reject(new Error(`Could not load ${language} translations.`, { cause: error })); return; }
      if (data === null || typeof data !== 'object' || Array.isArray(data)
        || Object.keys(data).length === 0 || Object.values(data).some(value => typeof value !== 'string')) {
        reject(new Error(`Invalid ${language} translations.`));
        return;
      }
      i18n.addResourceBundle(language, 'translation', data);
      resolve();
    });
  });
}

export async function selectLanguage(language: Language): Promise<Language> {
  let chosen = language;
  try { await load(language); }
  catch (error) {
    console.error('Translation loading failed.', error);
    if (language === 'en') throw error;
    chosen = 'en';
    await load('en');
  }
  await i18n.changeLanguage(chosen);
  return chosen;
}

export default i18n;
