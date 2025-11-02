import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState } from '../../shared/types';

const initialState: UIState = {
  selectedSoundId: null,
  isSettingsModalOpen: false,
  isMidiListening: false,
  listeningMode: 'none',
  currentProjectPath: null,
  isDirty: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSelectedSound: (state, action: PayloadAction<string | null>) => {
      state.selectedSoundId = action.payload;
    },
    openSettingsModal: (state) => {
      state.isSettingsModalOpen = true;
    },
    closeSettingsModal: (state) => {
      state.isSettingsModalOpen = false;
      state.selectedSoundId = null;
    },
    startMidiListening: (state, action: PayloadAction<'sound' | 'volume' | 'stopall'>) => {
      state.isMidiListening = true;
      state.listeningMode = action.payload;
    },
    stopMidiListening: (state) => {
      state.isMidiListening = false;
      state.listeningMode = 'none';
    },
    setCurrentProjectPath: (state, action: PayloadAction<string | null>) => {
      state.currentProjectPath = action.payload;
    },
    setDirty: (state, action: PayloadAction<boolean>) => {
      state.isDirty = action.payload;
    },
  },
});

export const {
  setSelectedSound,
  openSettingsModal,
  closeSettingsModal,
  startMidiListening,
  stopMidiListening,
  setCurrentProjectPath,
  setDirty,
} = uiSlice.actions;
export default uiSlice.reducer;
