import type { ReactNode, Ref } from 'react';
import { AppBar as MuiAppBar, Box, Stack, Toolbar, Typography } from '@mui/material';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import { useTranslation } from 'react-i18next';
import Preferences from '../Preferences/Preferences';

interface AppBarProps { children?: ReactNode; actionsRef?: Ref<HTMLDivElement> }

export default function AppBar({ children, actionsRef }: AppBarProps) {
  const { t } = useTranslation();
  return <MuiAppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
    <Toolbar sx={{ gap: 2, py: 2, flexWrap: 'wrap', justifyContent: 'space-between', maxWidth: 1248, width: '100%', mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <HomeOutlined color="primary" sx={{ fontSize: 32 }} />
        <Box><Typography sx={{ fontWeight: 700, letterSpacing: '-0.04em', fontSize: 22 }}>smart house</Typography>
          <Typography variant="caption" color="text.secondary">{t('tagline')}</Typography></Box>
      </Stack>
      {children}
      {actionsRef && <Box ref={actionsRef} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }} />}
      <Preferences />
    </Toolbar>
  </MuiAppBar>;
}
