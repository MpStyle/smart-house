import { useMemo } from 'react';
import { createTheme, useMediaQuery } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../entity/RootState';

export function useAppTheme() {
  const preference = useSelector((state: RootState) => state.preferences.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  return useMemo(() => createTheme({
    palette: { 
      mode, 
      primary: { 
        main: mode === 'light' ? '#1979ce' : '#6084a7' 
      },
      background: { 
        default: mode === 'light' ? '#f4f6f3' : '#10131d', 
        paper: mode === 'light' ? '#ffffff' : '#19202b' 
      } 
    },
    shape: { 
      borderRadius: 12 
    },
    typography: { 
      fontFamily: '"Avenir Next", "Segoe UI", sans-serif', 
      button: { 
        textTransform: 'none', 
        fontWeight: 600 
      } 
    },
    components: { 
      MuiButton: { 
        styleOverrides: { 
          root: { 
            boxShadow: 'none', 
            padding: '10px 20px' 
          } 
        } 
      } 
    },
  }), [mode]);
}
