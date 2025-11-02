import Store from 'electron-store';
import { AppState, AppSettings, Sound } from '../shared/types';

const defaultSettings: AppSettings = {
  masterVolume: 0.8,
  defaultFadeInMs: 50,
  defaultFadeOutMs: 100,
};

const defaultState: AppState = {
  sounds: [],
  settings: defaultSettings,
};

export class StorageManager {
  private store: Store<AppState>;

  constructor() {
    this.store = new Store<AppState>({
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
}
