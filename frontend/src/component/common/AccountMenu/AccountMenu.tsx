import { useState } from 'react';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Logout from '@mui/icons-material/Logout';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SETTINGS_ROUTE } from '../../../book/routes';

interface AccountMenuProps { name: string; loggingOut: boolean; logout: () => void }

export default function AccountMenu({ name, loggingOut, logout }: AccountMenuProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  return <>
    <Button id="account-menu-button" aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? 'account-menu' : undefined} endIcon={<ExpandMore />}
      onClick={event => setAnchor(event.currentTarget)} sx={{ maxWidth: '100%', minWidth: 0 }}>
      <Typography component="span" noWrap>{name}</Typography>
    </Button>
    <Menu id="account-menu" anchorEl={anchor} open={open} onClose={() => setAnchor(null)}
      slotProps={{ list: { 'aria-labelledby': 'account-menu-button' } }}>
      <MenuItem component={Link} to={SETTINGS_ROUTE} onClick={() => setAnchor(null)}>
        <ListItemIcon><SettingsOutlined fontSize="small" /></ListItemIcon>
        <ListItemText>{t('settings')}</ListItemText>
      </MenuItem>
      <MenuItem disabled={loggingOut} onClick={() => { setAnchor(null); logout(); }}>
        <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
        <ListItemText>{t('logout')}</ListItemText>
      </MenuItem>
    </Menu>
  </>;
}
