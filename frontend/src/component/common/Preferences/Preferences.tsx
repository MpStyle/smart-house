import { FormControl, InputLabel, MenuItem, Select, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { isLanguage, preferences } from '../../../book/preferences';
import { languages } from '../../../entity/Language';
import { changeLanguage } from '../../../book/store';
import type { AppDispatch } from '../../../entity/AppDispatch';
import type { RootState } from '../../../entity/RootState';

const languageNames = { en: 'English', it: 'Italiano', fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português' };

export default function Preferences() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const selected = useSelector((state: RootState) => state.preferences);
  const loading = useSelector((state: RootState) => state.translations.loading);
  return <Stack direction="row" spacing={1}>
    <FormControl size="small" sx={{ minWidth: 108 }}>
      <InputLabel id="language-label">{t('language')}</InputLabel>
      <Select labelId="language-label" label={t('language')} value={selected.language} disabled={loading}
        onChange={event => { if (isLanguage(event.target.value)) void dispatch(changeLanguage(event.target.value)); }}>
        {languages.map(language => <MenuItem key={language} value={language}>{languageNames[language]}</MenuItem>)}
      </Select>
    </FormControl>
    <FormControl size="small" sx={{ minWidth: 100 }}>
      <InputLabel id="theme-label">{t('theme')}</InputLabel>
      <Select labelId="theme-label" label={t('theme')} value={selected.theme}
        onChange={event => {
          const value = event.target.value;
          if (value === 'system' || value === 'light' || value === 'dark') dispatch(preferences.actions.setTheme(value));
        }}>
        {['system', 'light', 'dark'].map(theme => <MenuItem value={theme} key={theme}>{t(theme)}</MenuItem>)}
      </Select>
    </FormControl>
  </Stack>;
}
