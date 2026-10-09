import type { store } from '../book/store';

export type RootState = ReturnType<typeof store.getState>;
