import Store from 'electron-store';
import { AppState, AppSettings, Sound, Project } from '../shared/types';

const defaultSettings: AppSettings = {
  masterVolume: 0.8,
  defaultFadeInMs: 50,
  defaultFadeOutMs: 100,
};

const defaultState: AppState = {
  sounds: [],
  settings: defaultSettings,
};

interface StorageSchema extends AppState {
  lastProjectPath?: string;
  autoSave?: Project;
  autoSaveTimestamp?: string;
}

export class StorageManager {
  private store: Store<StorageSchema>;

  constructor() {
    this.store = new Store<StorageSchema>({
      defaults: defaultState,
    });
  }

  public loadState(): AppState {
    return {
      sounds: this.store.get('sounds', []),
      settings: this.store.get('settings', defaultSettings),
    };
  }

  public saveState(state: AppState): void {
    this.store.set('sounds', state.sounds);
    this.store.set('settings', state.settings);
  }

  public saveSounds(sounds: Sound[]): void {
    this.store.set('sounds', sounds);
  }

  public saveSettings(settings: AppSettings): void {
    this.store.set('settings', settings);
  }

  public getSounds(): Sound[] {
    return this.store.get('sounds', []);
  }

  public getSettings(): AppSettings {
    return this.store.get('settings', defaultSettings);
  }

  public clear(): void {
    this.store.clear();
  }

  // Last project path management
  public setLastProjectPath(filePath: string): void {
    this.store.set('lastProjectPath', filePath);
  }

  public getLastProjectPath(): string | undefined {
    return this.store.get('lastProjectPath');
  }

  public clearLastProjectPath(): void {
    this.store.delete('lastProjectPath');
  }

  // Auto-save functionality
  public saveAutoSave(project: Project): void {
    this.store.set('autoSave', project);
    this.store.set('autoSaveTimestamp', new Date().toISOString());
  }

  public getAutoSave(): { project: Project; timestamp: string } | null {
    const project = this.store.get('autoSave');
    const timestamp = this.store.get('autoSaveTimestamp');

    if (project && timestamp) {
      return { project, timestamp };
    }

    return null;
  }

  public clearAutoSave(): void {
    this.store.delete('autoSave');
    this.store.delete('autoSaveTimestamp');
  }

  public hasAutoSave(): boolean {
    return this.store.has('autoSave');
  }
}
