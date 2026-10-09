import { Alert, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface FailureProps { retry: () => void }

export default function Failure({ retry }: FailureProps) {
  const { t } = useTranslation();
  return <Alert severity="error" action={<Button color="inherit" onClick={retry}>{t('retry')}</Button>}>{t('error')}</Alert>;
}
