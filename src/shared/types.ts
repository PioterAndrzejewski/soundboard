// Type definitions for MIDI Soundboard

export type PlayMode = 'trigger' | 'gate';

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
}

export interface Sound {
  id: string;
  name: string;
  filePath: string;
  midiMapping?: MidiMapping;
  settings: SoundSettings;
  order: number; // For drag and drop ordering
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

export interface AppSettings {
  masterVolume: number;
  volumeMapping?: VolumeMapping;
  stopAllMapping?: MidiMapping;
  defaultFadeInMs: number;
  defaultFadeOutMs: number;
}

export interface AppState {
  sounds: Sound[];
  settings: AppSettings;
}

// Project data structure for save/load
export interface Project {
  name: string;
  version: string;
  sounds: Sound[];
  settings: AppSettings;
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
  GET_RECENT_PROJECTS = 'get-recent-projects',
}
