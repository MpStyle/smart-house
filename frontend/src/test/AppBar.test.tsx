import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppBar from '../component/common/AppBar/AppBar';
import { hasPreviousAppEntry } from '../book/useBackNavigation';
import { DASHBOARD_ROUTE } from '../book/routes';
import { PageActionsContext } from '../book/pageActions';
import PageActions from '../component/common/PageActions/PageActions';

afterEach(cleanup);

function AppBarWithActions() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <PageActionsContext.Provider value={target}>
    <AppBar account={<button>Account</button>} actionsRef={setTarget}><button>Home selector</button></AppBar>
    <PageActions><button>Refresh</button></PageActions>
  </PageActionsContext.Provider>;
}

describe('AppBar layout', () => {
  it('hides downward, reveals upward or near the top, and reveals for keyboard focus', () => {
    render(<MemoryRouter><AppBar account={<button>Account</button>} /></MemoryRouter>);
    const banner = screen.getByRole('banner');
    const scroll = (y: number) => {
      vi.spyOn(window, 'scrollY', 'get').mockReturnValue(y);
      fireEvent.scroll(window);
    };
    scroll(120);
    expect(banner).toHaveAttribute('data-hidden', 'true');
    scroll(100);
    expect(banner).toHaveAttribute('data-hidden', 'false');
    scroll(150);
    expect(banner).toHaveAttribute('data-hidden', 'true');
    act(() => screen.getByRole('button', { name: 'Account' }).focus());
    expect(banner).toHaveAttribute('data-hidden', 'false');
    scroll(200);
    scroll(0);
    expect(banner).toHaveAttribute('data-hidden', 'false');
  });
  it('renders page actions before the account in the same group, after the other controls', () => {
    render(<MemoryRouter><AppBarWithActions /></MemoryRouter>);
    const home = screen.getByRole('button', { name: 'Home selector' });
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    const account = screen.getByRole('button', { name: 'Account' });
    expect(home.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refresh.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refresh.parentElement?.parentElement).toBe(account.parentElement?.parentElement);
  });

  it('keeps the account available when the page has no actions', () => {
    render(<MemoryRouter><AppBar account={<button>Account</button>} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });
});

describe('AppBar back navigation', () => {
  it('shows the home icon by default and replaces it only when showBack is true', () => {
    const view = render(<MemoryRouter><AppBar /></MemoryRouter>);
    expect(screen.getByTestId('HomeOutlinedIcon')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><AppBar showBack /></MemoryRouter>);
    expect(screen.queryByTestId('HomeOutlinedIcon')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toContainElement(screen.getByTestId('ArrowBackIcon'));
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><AppBar showBack={false} /></MemoryRouter>);
    expect(screen.getByTestId('HomeOutlinedIcon')).toBeInTheDocument();
  });

  it('recognizes only valid positive router history indexes, not browser history length', () => {
    for (const state of [null, undefined, {}, { idx: 0 }, { idx: -1 }, { idx: '1' }, { idx: 0.5 }, { idx: NaN }])
      expect(hasPreviousAppEntry(state)).toBe(false);
    expect(hasPreviousAppEntry({ idx: 1 })).toBe(true);
    expect(hasPreviousAppEntry({ idx: 3 })).toBe(true);
  });

  it('returns to the previous internal page rather than always choosing the dashboard', async () => {
    vi.spyOn(window.history, 'state', 'get').mockReturnValue({ idx: 1 });
    render(<MemoryRouter initialEntries={['/previous', '/history']} initialIndex={1}>
      <AppBar showBack />
      <Routes>
        <Route path="/previous" element={<p>Previous internal page</p>} />
        <Route path="/history" element={<p>History page</p>} />
        <Route path={DASHBOARD_ROUTE} element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Previous internal page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('falls back to the dashboard when the current entry has no internal predecessor', async () => {
    vi.spyOn(window.history, 'state', 'get').mockReturnValue({ idx: 0 });
    render(<MemoryRouter initialEntries={['/history']}>
      <AppBar showBack />
      <Routes>
        <Route path="/history" element={<p>History page</p>} />
        <Route path={DASHBOARD_ROUTE} element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});
