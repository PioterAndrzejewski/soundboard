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

  getRecentProjects: () =>
    ipcRenderer.invoke('get-recent-projects'),
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
      getRecentProjects: () => Promise<string[]>;
    };
  }
}
