import { useState } from 'react';
import { Alert, Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { builtInIcons, type DisplayIcon as IconValue } from '../../../entity/DashboardCustomization';
import { readIcon } from '../../../book/dashboardCustomization';
import DisplayIcon from '../../common/DisplayIcon/DisplayIcon';

export default function IconPicker({ label, icon, change }: { label: string; icon?: IconValue; change: (icon?: IconValue) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  return <Stack spacing={1}>
    <Stack direction="row" spacing={1} alignItems="center">
      <DisplayIcon icon={icon} />
      <Typography>{label}</Typography>
    </Stack>
    <ToggleButtonGroup exclusive value={icon?.kind === 'builtIn' ? icon.name : null}
      aria-label={label} size="small" sx={{ flexWrap: 'wrap' }}
      onChange={(_, name: string | null) => {
        const value = builtInIcons.find(item => item === name);
        if (value) { setError(false); change({ kind: 'builtIn', name: value }); }
      }}>
      {builtInIcons.map(name => <ToggleButton key={name} value={name} aria-label={t(`icon_${name}`)} title={t(`icon_${name}`)}>
        <DisplayIcon icon={{ kind: 'builtIn', name }} />
      </ToggleButton>)}
    </ToggleButtonGroup>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Button component="label" disabled={loading}>
        {t('uploadIcon')}
        <input type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label={t('uploadIconFor', { name: label })}
          onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setLoading(true);
            setError(false);
            try { change(await readIcon(file)); }
            catch (error) { console.error('Icon upload failed.', error); setError(true); }
            finally { setLoading(false); }
          }} />
      </Button>
      <Button disabled={!icon || loading} onClick={() => { setError(false); change(undefined); }}>{t('resetIcon')}</Button>
    </Box>
    <Typography variant="caption" color="text.secondary">{t('iconLimits')}</Typography>
    {error && <Alert severity="error">{t('iconUploadError')}</Alert>}
  </Stack>;
}
