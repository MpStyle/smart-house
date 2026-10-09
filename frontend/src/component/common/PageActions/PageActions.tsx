import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PageActionsContext } from '../../../book/pageActions';

interface PageActionsProps { children: ReactNode }

export default function PageActions({ children }: PageActionsProps) {
  const target = useContext(PageActionsContext);
  return target ? createPortal(children, target) : null;
}
