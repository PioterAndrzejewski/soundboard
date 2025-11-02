import { configureStore } from '@reduxjs/toolkit';
import soundsReducer from './soundsSlice';
import settingsReducer from './settingsSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    sounds: soundsReducer,
    settings: settingsReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
