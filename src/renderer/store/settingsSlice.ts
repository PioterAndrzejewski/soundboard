import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppSettings, EffectsState, EffectCCMapping } from '../../shared/types';

const initialState: AppSettings = {
  masterVolume: 0.8,
  defaultFadeInMs: 100,
  defaultFadeOutMs: 500,
  effects: {
    speed: 1,
    pitch: 0,
    filterLow: 1,
    filterMid: 1,
    filterHigh: 1,
    distortion: 0,
    reverb: 0,
    delay: 0,
  },
  effectsMidiMappings: {},
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
    setEffectValue: (state, action: PayloadAction<{ effect: keyof EffectsState; value: number }>) => {
      if (!state.effects) {
        state.effects = {
          speed: 1,
          pitch: 0,
          filterLow: 1,
          filterMid: 1,
          filterHigh: 1,
          distortion: 0,
          reverb: 0,
          delay: 0,
        };
      }
      state.effects[action.payload.effect] = action.payload.value;
    },
    setEffectMidiMapping: (state, action: PayloadAction<{ effect: keyof EffectsState; mapping?: EffectCCMapping }>) => {
      if (!state.effectsMidiMappings) {
        state.effectsMidiMappings = {};
      }
      if (action.payload.mapping) {
        state.effectsMidiMappings[action.payload.effect] = action.payload.mapping;
      } else {
        delete state.effectsMidiMappings[action.payload.effect];
      }
    },
  },
});

export const { setSettings, updateSettings, setMasterVolume, setEffectValue, setEffectMidiMapping } = settingsSlice.actions;
export default settingsSlice.reducer;
