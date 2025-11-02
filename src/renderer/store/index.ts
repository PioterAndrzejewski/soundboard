import { configureStore } from '@reduxjs/toolkit';
import soundsReducer from './soundsSlice';
import settingsReducer from './settingsSlice';
import uiReducer from './uiSlice';
import tabsReducer from './tabsSlice';

export const store = configureStore({
  reducer: {
    sounds: soundsReducer,
    settings: settingsReducer,
    ui: uiReducer,
    tabs: tabsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
