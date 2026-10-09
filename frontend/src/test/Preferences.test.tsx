import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Preferences from '../component/page/Settings/Preferences';
import { preferences } from '../book/preferences';
import { changeLanguage, store } from '../book/store';
import { selectLanguage } from '../book/i18n';

vi.mock('../book/i18n', () => ({ selectLanguage: vi.fn() }));

beforeEach(() => {
  store.dispatch(changeLanguage.fulfilled('en', 'reset', 'en'));
  store.dispatch(preferences.actions.setTheme('system'));
  localStorage.clear();
  vi.mocked(selectLanguage).mockImplementation(async language => language);
});
afterEach(() => {
  cleanup();
  store.dispatch(changeLanguage.fulfilled('en', 'reset', 'en'));
  store.dispatch(preferences.actions.setTheme('system'));
  localStorage.clear();
});

describe('settings radio preferences', () => {
  it('shows language and appearance as two distinct named sections without selects', () => {
    render(<Provider store={store}><Preferences /></Provider>);
    const language = within(screen.getByRole('region', { name: 'Language' }));
    const theme = within(screen.getByRole('region', { name: 'Appearance' }));
    expect(language.getByRole('heading', { level: 2, name: 'Language' })).toBeInTheDocument();
    expect(theme.getByRole('heading', { level: 2, name: 'Appearance' })).toBeInTheDocument();
    expect(language.getAllByRole('radio')).toHaveLength(6);
    expect(theme.getAllByRole('radio')).toHaveLength(3);
    expect(language.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(theme.getByRole('radio', { name: 'System' })).toBeChecked();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('saves selections immediately and keeps exactly one checked option in each group', async () => {
    render(<Provider store={store}><Preferences /></Provider>);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(localStorage.getItem('smart-house.theme')).toBe('dark');
    fireEvent.click(screen.getByRole('radio', { name: 'Italiano' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Italiano' })).toBeChecked());
    expect(selectLanguage).toHaveBeenCalledWith('it');
    expect(localStorage.getItem('smart-house.language')).toBe('it');
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  it('disables only language options while translations are loading', () => {
    store.dispatch(changeLanguage.pending('loading-test', 'it'));
    render(<Provider store={store}><Preferences /></Provider>);
    for (const radio of within(screen.getByRole('radiogroup', { name: 'Language' })).getAllByRole('radio'))
      expect(radio).toBeDisabled();
    for (const radio of within(screen.getByRole('radiogroup', { name: 'Appearance' })).getAllByRole('radio'))
      expect(radio).toBeEnabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(localStorage.getItem('smart-house.theme')).toBe('light');
  });
});
