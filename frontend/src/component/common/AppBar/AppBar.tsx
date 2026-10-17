import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { useLocation } from 'react-router-dom';
import { AppBar as MuiAppBar, Box, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useBackNavigation } from '../../../book/useBackNavigation';

interface AppBarProps { children?: ReactNode; account?: ReactNode; actionsRef?: Ref<HTMLDivElement>; showBack?: boolean }

export default function AppBar({ children, account, actionsRef, showBack = false }: AppBarProps) {
  const { t } = useTranslation();
  const goBack = useBackNavigation();
  const { key } = useLocation();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    let previous = window.scrollY;
    const scroll = () => {
      const current = Math.max(0, window.scrollY);
      if (current <= 80) setHidden(false);
      else if (Math.abs(current - previous) >= 6) setHidden(current > previous);
      if (Math.abs(current - previous) >= 6 || current <= 80) previous = current;
    };
    window.addEventListener('scroll', scroll, { passive: true });
    return () => window.removeEventListener('scroll', scroll);
  }, [key]);
  return <MuiAppBar position="sticky" elevation={0} color="transparent" data-hidden={hidden}
    onFocusCapture={() => setHidden(false)}
    sx={{ top: 0, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider',
      transform: hidden ? 'translateY(-110%)' : 'none', transition: 'transform 180ms ease',
      '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
    <Toolbar sx={{ gap: { xs: 0.5, sm: 1, md: 2 }, py: 1, flexWrap: 'nowrap', justifyContent: 'space-between',
      maxWidth: 1248, width: '100%', mx: 'auto', px: { xs: 1, sm: 2 } }}>
      <Stack direction="row" alignItems="center" spacing={1} data-testid="app-navigation"
        sx={{ flexShrink: 0, display: showBack || !children ? 'flex' : { xs: 'none', md: 'flex' } }}>
        {showBack
          ? <IconButton color="primary" aria-label={t('back')} onClick={goBack}>
            <ArrowBack sx={{ fontSize: 32 }} />
          </IconButton>
          : <HomeOutlined color="primary" sx={{ fontSize: 32 }} />}

        <Box sx={{ display: children ? { xs: 'none', md: 'block' } : 'block' }}>
          <Typography sx={{ fontWeight: 700, letterSpacing: '-0.04em', fontSize: 22 }}>smart house</Typography>
        </Box>
      </Stack>

      {children}

      {(actionsRef || account) && <Stack direction="row" alignItems="center" spacing={{ xs: 0, sm: 0.5 }}
        sx={{ ml: 'auto', minWidth: 0, flexShrink: 0, maxWidth: { xs: 96, md: 280 } }}>
        {actionsRef && <Box ref={actionsRef} sx={{ display: 'flex', flexWrap: 'nowrap', gap: 0.5, flexShrink: 0 }} />}
        
        {account && <Box sx={{ display: 'flex', minWidth: 0 }}>{account}</Box>}
      </Stack>}
    </Toolbar>
  </MuiAppBar>;
}
