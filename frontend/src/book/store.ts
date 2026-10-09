import { configureStore, createAsyncThunk, createListenerMiddleware, createSlice, isAnyOf } from '@reduxjs/toolkit';
import { api } from '../api/api';
import { preferences, writePreference } from './preferences';
import { selectLanguage } from './i18n';
import type { Language } from '../entity/Language';
import type { TranslationsState } from '../entity/TranslationsState';
import type { PreferencesState } from '../entity/PreferencesState';

export const changeLanguage = createAsyncThunk<Language, Language, { state: { translations: TranslationsState } }>(
  'translations/changeLanguage',
  async language => {
    try { return await selectLanguage(language); }
    catch (error) { console.error('Translations are unavailable.', error); throw error; }
  },
  { condition: (_, context) => !context.getState().translations.loading },
);
const initialTranslations: TranslationsState = { ready: false, loading: false, error: false };
const translations = createSlice({
  name: 'translations',
  initialState: initialTranslations,
  reducers: {},
  extraReducers: builder => builder
    .addCase(changeLanguage.pending, state => { state.loading = true; state.error = false; })
    .addCase(changeLanguage.fulfilled, state => { state.loading = false; state.ready = true; state.error = false; })
    .addCase(changeLanguage.rejected, state => { state.loading = false; state.ready = false; state.error = true; }),
});

const listener = createListenerMiddleware<{ preferences: PreferencesState }>();
listener.startListening({
  actionCreator: changeLanguage.fulfilled,
  effect: (action, context) => { context.dispatch(preferences.actions.setLanguage(action.payload)); },
});
listener.startListening({
  actionCreator: preferences.actions.setLanguage,
  effect: action => { writePreference('language', action.payload); },
});
listener.startListening({
  actionCreator: preferences.actions.setTheme,
  effect: action => { writePreference('theme', action.payload); },
});
listener.startListening({
  actionCreator: preferences.actions.setHome,
  effect: action => { writePreference('home', action.payload); },
});
listener.startListening({
  matcher: isAnyOf(preferences.actions.setRoomOrder, preferences.actions.setMeasurementOrder),
  effect: (_, context) => {
    writePreference('dashboardOrders', JSON.stringify(context.getState().preferences.dashboardOrders));
  },
});
listener.startListening({
  actionCreator: preferences.actions.setExpired,
  effect: (action, context) => { if (action.payload) context.dispatch(api.util.resetApiState()); },
});
export const store = configureStore({
  reducer: { preferences: preferences.reducer, translations: translations.reducer, [api.reducerPath]: api.reducer },
  middleware: getDefault => getDefault().prepend(listener.middleware).concat(api.middleware),
});
