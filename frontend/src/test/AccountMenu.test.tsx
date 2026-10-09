import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountMenu from '../component/common/AccountMenu/AccountMenu';
import { SETTINGS_ROUTE } from '../book/routes';

afterEach(cleanup);

describe('account menu', () => {
  it('preserves the full account identity in the title and accessible name for the compact button', () => {
    const name = 'person.with.a.long.name@example.test';
    render(<MemoryRouter><AccountMenu name={name} loggingOut={false} logout={vi.fn()} /></MemoryRouter>);
    const account = screen.getByRole('button', { name });
    expect(account).toHaveAttribute('title', name);
    expect(account).toHaveAttribute('aria-label', name);
    expect(account).toContainElement(screen.getByTestId('PersonOutlineIcon'));
    expect(screen.getByTestId('PersonOutlineIcon')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(account);
    expect(screen.getByRole('menu', { name })).toBeInTheDocument();
  });

  it('opens settings and sign-out only after clicking the account identity', async () => {
    render(<MemoryRouter>
      <AccountMenu name="Person" loggingOut={false} logout={vi.fn()} />
      <Routes><Route path={SETTINGS_ROUTE} element={<h1>Settings page</h1>} /></Routes>
    </MemoryRouter>);
    const account = screen.getByRole('button', { name: 'Person' });
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    fireEvent.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', SETTINGS_ROUTE);
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings page' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('closes the menu before signing out and disables duplicate sign-out', async () => {
    const logout = vi.fn();
    const view = render(<MemoryRouter><AccountMenu name="Person" loggingOut={false} logout={logout} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Person' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    view.rerender(<MemoryRouter><AccountMenu name="Person" loggingOut logout={logout} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Person' }));
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});
