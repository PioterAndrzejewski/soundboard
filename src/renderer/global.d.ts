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
      loadProjectByPath: (filePath: string) => Promise<{ project: Project; filePath: string }>;
      getRecentProjects: () => Promise<string[]>;
      getLastProjectPath: () => Promise<string | undefined>;
      setLastProjectPath: (filePath: string) => Promise<any>;
      saveAutoSave: (project: Project) => Promise<any>;
      getAutoSave: () => Promise<{ project: Project; timestamp: string } | null>;
      clearAutoSave: () => Promise<any>;
      hasAutoSave: () => Promise<boolean>;
      readAudioFile: (filePath: string) => Promise<ArrayBuffer>;
      saveSynthSound: (noteName: string, audioData: Uint8Array) => Promise<string>;
      getTempDir: () => Promise<string>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

export {};
