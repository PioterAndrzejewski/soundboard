import { Sound, AppSettings, Project } from '../shared/types';

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
      readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
    };
  }
}

export {};
