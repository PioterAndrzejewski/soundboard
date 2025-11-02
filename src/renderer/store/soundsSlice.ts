import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Sound } from '../../shared/types';

interface SoundsState {
  sounds: Sound[];
}

const initialState: SoundsState = {
  sounds: [],
};

const soundsSlice = createSlice({
  name: 'sounds',
  initialState,
  reducers: {
    setSounds: (state, action: PayloadAction<Sound[]>) => {
      state.sounds = action.payload;
    },
    addSound: (state, action: PayloadAction<Sound>) => {
      state.sounds.push(action.payload);
    },
    removeSound: (state, action: PayloadAction<string>) => {
      state.sounds = state.sounds.filter(s => s.id !== action.payload);
    },
    updateSound: (state, action: PayloadAction<{ id: string; updates: Partial<Sound> }>) => {
      const index = state.sounds.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.sounds[index] = { ...state.sounds[index], ...action.payload.updates };
      }
    },
    reorderSounds: (state, action: PayloadAction<Sound[]>) => {
      state.sounds = action.payload;
    },
  },
});

export const { setSounds, addSound, removeSound, updateSound, reorderSounds } = soundsSlice.actions;
export default soundsSlice.reducer;
