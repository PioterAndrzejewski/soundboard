import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppSettings } from '../../shared/types';

const initialState: AppSettings = {
  masterVolume: 0.8,
  defaultFadeInMs: 50,
  defaultFadeOutMs: 100,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action: PayloadAction<AppSettings>) => {
      return action.payload;
    },
    updateSettings: (state, action: PayloadAction<Partial<AppSettings>>) => {
      return { ...state, ...action.payload };
    },
    setMasterVolume: (state, action: PayloadAction<number>) => {
      state.masterVolume = action.payload;
    },
  },
});

export const { setSettings, updateSettings, setMasterVolume } = settingsSlice.actions;
export default settingsSlice.reducer;
