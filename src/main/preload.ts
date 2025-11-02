import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel, Sound, AppSettings, Project } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
console.log('Preload script is running');
contextBridge.exposeInMainWorld('electronAPI', {
  // Sound management
  addSound: (filePath: string, name: string) =>
    ipcRenderer.invoke(IpcChannel.ADD_SOUND, filePath, name),

  removeSound: (soundId: string) =>
    ipcRenderer.invoke(IpcChannel.REMOVE_SOUND, soundId),

  updateSound: (soundId: string, updates: Partial<Sound>) =>
    ipcRenderer.invoke(IpcChannel.UPDATE_SOUND, soundId, updates),

  getSounds: (): Promise<Sound[]> =>
    ipcRenderer.invoke(IpcChannel.GET_SOUNDS),

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannel.GET_SETTINGS),

  updateSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IpcChannel.UPDATE_SETTINGS, settings),

  // File selection
  selectSoundFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannel.SELECT_SOUND_FILE),

  // Project management
  newProject: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.NEW_PROJECT),

  saveProject: (project: Project, filePath?: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannel.SAVE_PROJECT, project, filePath),

  saveProjectAs: (project: Project): Promise<string> =>
    ipcRenderer.invoke(IpcChannel.SAVE_PROJECT_AS, project),

  loadProject: (): Promise<{ project: Project; filePath: string } | null> =>
    ipcRenderer.invoke(IpcChannel.LOAD_PROJECT),

  getRecentProjects: (): Promise<string[]> =>
    ipcRenderer.invoke(IpcChannel.GET_RECENT_PROJECTS),
});

console.log('electronAPI exposed to window');

// Type declaration for the exposed API
declare global {
  interface Window {
    electronAPI: {
      addSound: (filePath: string, name: string) => Promise<any>;
      removeSound: (soundId: string) => Promise<any>;
      updateSound: (soundId: string, updates: Partial<Sound>) => Promise<any>;
      getSounds: () => Promise<Sound[]>;
      getSettings: () => Promise<AppSettings>;
      updateSettings: (settings: Partial<AppSettings>) => Promise<any>;
      selectSoundFile: () => Promise<string | null>;
      newProject: () => Promise<void>;
      saveProject: (project: Project, filePath?: string) => Promise<string>;
      saveProjectAs: (project: Project) => Promise<string>;
      loadProject: () => Promise<{ project: Project; filePath: string } | null>;
      getRecentProjects: () => Promise<string[]>;
    };
  }
}
