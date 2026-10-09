import type { ReactNode, Ref } from 'react';
import { AppBar as MuiAppBar, Box, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useBackNavigation } from '../../../book/useBackNavigation';

interface AppBarProps { children?: ReactNode; account?: ReactNode; actionsRef?: Ref<HTMLDivElement>; showBack?: boolean }

export default function AppBar({ children, account, actionsRef, showBack = false }: AppBarProps) {
  const { t } = useTranslation();
  const goBack = useBackNavigation();
  return <MuiAppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
    <Toolbar sx={{ gap: 2, py: 2, flexWrap: 'wrap', justifyContent: 'space-between', maxWidth: 1248, width: '100%', mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{display: { xs: 'none', sm: 'flex' }}}>
        {showBack
          ? <IconButton color="primary" aria-label={t('back')} onClick={goBack}>
            <ArrowBack sx={{ fontSize: 32 }} />
          </IconButton>
          : <HomeOutlined color="primary" sx={{ fontSize: 32 }} />}

        <Box>
          <Typography sx={{ fontWeight: 700, letterSpacing: '-0.04em', fontSize: 22 }}>smart house</Typography>
          <Typography variant="caption" color="text.secondary">{t('tagline')}</Typography>
        </Box>
      </Stack>

      {children}

      {(actionsRef || account) && <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: 'auto', minWidth: 0, maxWidth: '100%' }}>
        {actionsRef && <Box ref={actionsRef} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flexShrink: 0 }} />}
        
        {account && <Box sx={{ display: 'flex', minWidth: 0 }}>{account}</Box>}
      </Stack>}
    </Toolbar>
  </MuiAppBar>;
}
