import { contextBridge, ipcRenderer } from 'electron';

// Use string literals instead of importing types to avoid module resolution issues in sandbox
contextBridge.exposeInMainWorld('electronAPI', {
  // Sound management
  addSound: (filePath: string, name: string) =>
    ipcRenderer.invoke('add-sound', filePath, name),

  removeSound: (soundId: string) =>
    ipcRenderer.invoke('remove-sound', soundId),

  updateSound: (soundId: string, updates: any) =>
    ipcRenderer.invoke('update-sound', soundId, updates),

  getSounds: () =>
    ipcRenderer.invoke('get-sounds'),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke('get-settings'),

  updateSettings: (settings: any) =>
    ipcRenderer.invoke('update-settings', settings),

  // File selection
  selectSoundFile: () =>
    ipcRenderer.invoke('select-sound-file'),

  // Project management
  newProject: () =>
    ipcRenderer.invoke('new-project'),

  saveProject: (project: any, filePath?: string) =>
    ipcRenderer.invoke('save-project', project, filePath),

  saveProjectAs: (project: any) =>
    ipcRenderer.invoke('save-project-as', project),

  loadProject: () =>
    ipcRenderer.invoke('load-project'),

  loadProjectByPath: (filePath: string) =>
    ipcRenderer.invoke('load-project-by-path', filePath),

  getRecentProjects: () =>
    ipcRenderer.invoke('get-recent-projects'),

  // Last project path
  getLastProjectPath: () =>
    ipcRenderer.invoke('get-last-project-path'),

  setLastProjectPath: (filePath: string) =>
    ipcRenderer.invoke('set-last-project-path', filePath),

  // Auto-save
  saveAutoSave: (project: any) =>
    ipcRenderer.invoke('save-auto-save', project),

  getAutoSave: () =>
    ipcRenderer.invoke('get-auto-save'),

  clearAutoSave: () =>
    ipcRenderer.invoke('clear-auto-save'),

  hasAutoSave: () =>
    ipcRenderer.invoke('has-auto-save'),

  // Audio file loading
  readAudioFile: (filePath: string) =>
    ipcRenderer.invoke('read-audio-file', filePath),

  // Synth sound generation
  saveSynthSound: (noteName: string, audioData: Uint8Array) =>
    ipcRenderer.invoke('save-synth-sound', noteName, audioData),

  // System paths
  getTempDir: () =>
    ipcRenderer.invoke('get-temp-dir'),

  // Menu IPC event listeners
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },

  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

// Expose audioIO for WaveformEditor
contextBridge.exposeInMainWorld('audioIO', {
  readFile: async (filePath: string): Promise<ArrayBuffer> => {
    const buffer = await ipcRenderer.invoke('read-audio-file', filePath);

    // Convert to proper ArrayBuffer if needed
    if (buffer instanceof ArrayBuffer) {
      return buffer;
    } else if (buffer && typeof buffer === 'object' && 'buffer' in buffer && buffer.buffer instanceof ArrayBuffer) {
      // Handle Node.js Buffer (has .buffer property)
      const underlyingBuffer = buffer.buffer as ArrayBuffer;
      return underlyingBuffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } else if (ArrayBuffer.isView(buffer)) {
      // Handle typed arrays
      const underlyingBuffer = buffer.buffer as ArrayBuffer;
      return underlyingBuffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } else {
      throw new Error('Unexpected buffer type received from main process');
    }
  },
});

// Type declaration for the exposed API
declare global {
  interface Window {
    electronAPI: {
      addSound: (filePath: string, name: string) => Promise<any>;
      removeSound: (soundId: string) => Promise<any>;
      updateSound: (soundId: string, updates: any) => Promise<any>;
      getSounds: () => Promise<any[]>;
      getSettings: () => Promise<any>;
      updateSettings: (settings: any) => Promise<any>;
      selectSoundFile: () => Promise<string | null>;
      newProject: () => Promise<void>;
      saveProject: (project: any, filePath?: string) => Promise<string>;
      saveProjectAs: (project: any) => Promise<string>;
      loadProject: () => Promise<{ project: any; filePath: string } | null>;
      loadProjectByPath: (filePath: string) => Promise<{ project: any; filePath: string }>;
      getRecentProjects: () => Promise<string[]>;
      getLastProjectPath: () => Promise<string | undefined>;
      setLastProjectPath: (filePath: string) => Promise<any>;
      saveAutoSave: (project: any) => Promise<any>;
      getAutoSave: () => Promise<{ project: any; timestamp: string } | null>;
      clearAutoSave: () => Promise<any>;
      hasAutoSave: () => Promise<boolean>;
      readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
      saveSynthSound: (noteName: string, audioData: Uint8Array) => Promise<string>;
      getTempDir: () => Promise<string>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
    audioIO: {
      readFile: (filePath: string) => Promise<ArrayBuffer>;
    };
  }
}
