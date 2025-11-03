import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState, EffectsState } from '../../shared/types';

type MappingTarget = 'volume' | 'stopall' | 'sound' | keyof EffectsState;

interface ExtendedUIState extends UIState {
  lastStopAllTrigger: number;
  isMidiMappingMode: boolean;
  mappingTarget: MappingTarget | null;
  isActiveSoundsPanelOpen: boolean;
  lastTriggeredSoundId: string | null;
  lastTriggeredSoundTimestamp: number;
  tabListeningTarget: string | null; // Tab ID when listening for tab MIDI mapping
}

const initialState: ExtendedUIState = {
  selectedSoundId: null,
  isSettingsModalOpen: false,
  isMidiListening: false,
  listeningMode: 'none',
  currentProjectPath: null,
  isDirty: false,
  lastStopAllTrigger: 0,
  isMidiMappingMode: false,
  mappingTarget: null,
  isActiveSoundsPanelOpen: true,
  lastTriggeredSoundId: null,
  lastTriggeredSoundTimestamp: 0,
  tabListeningTarget: null,
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
    startMidiListening: (state, action: PayloadAction<'sound' | 'volume' | 'stopall' | { mode: 'tab'; target: string }>) => {
      state.isMidiListening = true;
      if (typeof action.payload === 'object' && action.payload.mode === 'tab') {
        state.listeningMode = 'sound'; // Use 'sound' mode for note-based listening
        state.tabListeningTarget = action.payload.target;
      } else {
        state.listeningMode = action.payload as 'sound' | 'volume' | 'stopall';
        state.tabListeningTarget = null;
      }
    },
    stopMidiListening: (state) => {
      state.isMidiListening = false;
      state.listeningMode = 'none';
      state.tabListeningTarget = null;
    },
    setCurrentProjectPath: (state, action: PayloadAction<string | null>) => {
      state.currentProjectPath = action.payload;
    },
    setDirty: (state, action: PayloadAction<boolean>) => {
      state.isDirty = action.payload;
    },
    triggerStopAll: (state) => {
      state.lastStopAllTrigger = Date.now();
    },
    toggleMidiMappingMode: (state) => {
      state.isMidiMappingMode = !state.isMidiMappingMode;
      if (!state.isMidiMappingMode) {
        // Exiting mapping mode
        state.isMidiListening = false;
        state.listeningMode = 'none';
        state.mappingTarget = null;
      }
    },
    startMappingTarget: (state, action: PayloadAction<MappingTarget>) => {
      state.mappingTarget = action.payload;
      state.isMidiListening = true;
      // For effect mappings, use 'volume' as the listening mode (CC messages)
      if (action.payload === 'sound' || action.payload === 'stopall') {
        state.listeningMode = action.payload;
      } else {
        state.listeningMode = 'volume'; // Effects use CC messages like volume
      }
    },
    clearMappingTarget: (state) => {
      state.mappingTarget = null;
      state.isMidiListening = false;
      state.listeningMode = 'none';
    },
    toggleActiveSoundsPanel: (state) => {
      state.isActiveSoundsPanelOpen = !state.isActiveSoundsPanelOpen;
    },
    triggerSoundHighlight: (state, action: PayloadAction<string>) => {
      state.lastTriggeredSoundId = action.payload;
      state.lastTriggeredSoundTimestamp = Date.now();
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
  triggerStopAll,
  toggleMidiMappingMode,
  startMappingTarget,
  clearMappingTarget,
  toggleActiveSoundsPanel,
  triggerSoundHighlight,
} = uiSlice.actions;
export default uiSlice.reducer;
