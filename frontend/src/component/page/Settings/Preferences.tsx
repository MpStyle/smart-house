import { FormControl, FormControlLabel, Paper, Radio, RadioGroup, Stack, Typography } from '@mui/material';
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
  return <Stack spacing={4}>
    <Typography variant="h5" component="h2">{t('language')}</Typography>

    <Paper component="section" aria-labelledby="language-heading" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <FormControl fullWidth disabled={loading}>
        <RadioGroup name="language" aria-labelledby="language-heading" value={selected.language}
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}
          onChange={(_, value) => { if (isLanguage(value)) void dispatch(changeLanguage(value)); }}>
          {languages.map(language => <FormControlLabel key={language} value={language} control={<Radio />}
            label={languageNames[language]} sx={{ m: 0 }} />)}
        </RadioGroup>
      </FormControl>
    </Paper>

  <Typography variant="h5" component="h2">{t('theme')}</Typography>

    <Paper component="section" aria-labelledby="theme-heading" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <FormControl fullWidth>
        <RadioGroup name="theme" aria-labelledby="theme-heading" value={selected.theme}
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}
          onChange={(_, value) => {
            if (value === 'system' || value === 'light' || value === 'dark') dispatch(preferences.actions.setTheme(value));
          }}>
          {['system', 'light', 'dark'].map(theme => <FormControlLabel key={theme} value={theme} control={<Radio />}
            label={t(theme)} sx={{ m: 0 }} />)}
        </RadioGroup>
      </FormControl>
    </Paper>
  </Stack>;
}
