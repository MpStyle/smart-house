import type { ReactNode } from 'react';
import { useTranslations } from '../../../book/useTranslations';

interface TranslationBootstrapProps { children: ReactNode }

export default function TranslationBootstrap({ children }: TranslationBootstrapProps) {
  const { ready, error, retry } = useTranslations();
  if (error) return <main role="alert">
    <p>Impossibile caricare le traduzioni / Unable to load translations.</p>
    <button type="button" onClick={retry}>Riprova / Retry</button>
  </main>;
  if (!ready) return <main role="status" aria-label="Loading translations">…</main>;
  return children;
}
