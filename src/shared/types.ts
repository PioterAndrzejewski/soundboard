// Type definitions for MIDI Soundboard

export type PlayMode = 'trigger' | 'gate' | 'loop';

export interface MidiMapping {
  deviceId: string;
  deviceName: string;
  note: number; // MIDI note number (0-127)
  channel: number; // MIDI channel (0-15)
}

export interface SoundSettings {
  playMode: PlayMode;
  fadeInMs: number;
  fadeOutMs: number;
  volume: number; // 0-1
  outputDeviceId?: string;
  startTime?: number; // in seconds
  endTime?: number; // in seconds
}

export interface Sound {
  id: string;
  name: string;
  filePath: string;
  midiMapping?: MidiMapping;
  settings: SoundSettings;
  order: number; // For drag and drop ordering
  tabId?: string; // Tab assignment (optional for backwards compatibility)
  slotPosition?: { row: number; col: number }; // For fixed layout positions (APC MINI)
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

export interface VolumeMapping {
  deviceId: string;
  deviceName: string;
  ccNumber: number; // Control Change number (0-127)
  channel: number;
}

export interface EffectCCMapping {
  deviceId: string;
  deviceName: string;
  ccNumber: number; // Control Change number (0-127)
  channel: number;
}

export interface EffectsState {
  speed: number; // 0.5 to 2.0 (playback rate)
  pan: number; // -1 to 1 (stereo balance: -1=left, 0=center, 1=right)
  filterLow: number; // 0-1
  filterMid: number; // 0-1
  filterHigh: number; // 0-1
  distortion: number; // 0-1
  reverb: number; // 0-1
  delay: number; // 0-1
}

export interface EffectsMidiMappings {
  speed?: EffectCCMapping;
  pan?: EffectCCMapping;
  filterLow?: EffectCCMapping;
  filterMid?: EffectCCMapping;
  filterHigh?: EffectCCMapping;
  distortion?: EffectCCMapping;
  reverb?: EffectCCMapping;
  delay?: EffectCCMapping;
}

export interface AppSettings {
  masterVolume: number;
  volumeMapping?: VolumeMapping;
  stopAllMapping?: MidiMapping;
  defaultFadeInMs: number;
  defaultFadeOutMs: number;
  defaultOutputDeviceId?: string; // Audio output device
  effects?: EffectsState;
  effectsMidiMappings?: EffectsMidiMappings;
}

export interface AppState {
  sounds: Sound[];
  settings: AppSettings;
}

// Tab definition
export type TabLayoutType = 'free' | 'apc-mini' | 'apc-key25' | 'apc-key';

export interface Tab {
  id: string;
  name: string;
  color: string;
  order: number;
  layoutType?: TabLayoutType; // 'free' (default) or 'apc-mini'
}

// Project data structure for save/load
export interface Project {
  name: string;
  version: string;
  sounds: Sound[];
  settings: AppSettings;
  tabs?: Tab[]; // Optional for backwards compatibility
  createdAt: string;
  updatedAt: string;
}

// UI State (not persisted to project file)
export interface UIState {
  selectedSoundId: string | null;
  isSettingsModalOpen: boolean;
  isMidiListening: boolean;
  listeningMode: 'none' | 'sound' | 'volume' | 'stopall';
  currentProjectPath: string | null;
  isDirty: boolean; // Has unsaved changes
}

// MIDI message types
export interface MidiMessage {
  type: 'noteon' | 'noteoff' | 'cc';
  deviceId: string;
  deviceName: string;
  note?: number;
  ccNumber?: number;
  value: number;
  channel: number;
  timestamp: number;
}

// IPC channel names
export enum IpcChannel {
  // Sound management
  ADD_SOUND = 'add-sound',
  REMOVE_SOUND = 'remove-sound',
  UPDATE_SOUND = 'update-sound',
  GET_SOUNDS = 'get-sounds',

  // MIDI
  GET_MIDI_DEVICES = 'get-midi-devices',
  START_MIDI_LISTEN = 'start-midi-listen',
  STOP_MIDI_LISTEN = 'stop-midi-listen',
  MIDI_MESSAGE = 'midi-message',

  // Audio
  GET_AUDIO_DEVICES = 'get-audio-devices',
  PLAY_SOUND = 'play-sound',
  STOP_SOUND = 'stop-sound',
  STOP_ALL_SOUNDS = 'stop-all-sounds',

  // Settings
  GET_SETTINGS = 'get-settings',
  UPDATE_SETTINGS = 'update-settings',

  // File selection
  SELECT_SOUND_FILE = 'select-sound-file',

  // Project management
  NEW_PROJECT = 'new-project',
  SAVE_PROJECT = 'save-project',
  SAVE_PROJECT_AS = 'save-project-as',
  LOAD_PROJECT = 'load-project',
  LOAD_PROJECT_BY_PATH = 'load-project-by-path',
  GET_RECENT_PROJECTS = 'get-recent-projects',

  // Auto-save and last project
  GET_LAST_PROJECT_PATH = 'get-last-project-path',
  SET_LAST_PROJECT_PATH = 'set-last-project-path',
  SAVE_AUTO_SAVE = 'save-auto-save',
  GET_AUTO_SAVE = 'get-auto-save',
  CLEAR_AUTO_SAVE = 'clear-auto-save',
  HAS_AUTO_SAVE = 'has-auto-save',
}
