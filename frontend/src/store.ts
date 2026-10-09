import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { api } from './api';
import { preferences, writePreference } from './preferences';
import i18n from './i18n';

const listener = createListenerMiddleware();
listener.startListening({
  actionCreator: preferences.actions.setLanguage,
  effect: async action => {
    writePreference('language', action.payload);
    await i18n.changeLanguage(action.payload);
  },
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
  actionCreator: preferences.actions.setExpired,
  effect: (action, context) => { if (action.payload) context.dispatch(api.util.resetApiState()); },
});
export const store = configureStore({
  reducer: { preferences: preferences.reducer, [api.reducerPath]: api.reducer },
  middleware: getDefault => getDefault().prepend(listener.middleware).concat(api.middleware),
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
