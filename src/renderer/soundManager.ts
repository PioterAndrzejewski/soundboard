import { Sound, MidiMessage, AppSettings } from '../shared/types';
import { AudioEngine } from './audioEngine';
import { MidiHandler } from './midiHandler';
import { v4 as uuidv4 } from 'uuid';

export class SoundManager {
  private audioEngine: AudioEngine;
  private midiHandler: MidiHandler;
  private sounds: Map<string, Sound> = new Map();
  private settings: AppSettings;
  private activeSoundsPerMapping: Map<string, string[]> = new Map(); // midiKey -> playingIds
  private onSoundTriggeredCallback: ((soundId: string) => void) | null = null;

  constructor(audioEngine: AudioEngine, midiHandler: MidiHandler, settings: AppSettings) {
    this.audioEngine = audioEngine;
    this.midiHandler = midiHandler;
    // Create a copy of settings to avoid mutating Redux state
    this.settings = { ...settings };

    // Set initial master volume
    this.audioEngine.setMasterVolume(settings.masterVolume);

    // Listen to MIDI messages
    this.midiHandler.addListener(this.handleMidiMessage.bind(this));
  }

  public onSoundTriggered(callback: (soundId: string) => void): void {
    this.onSoundTriggeredCallback = callback;
  }

  private handleMidiMessage(message: MidiMessage): void {
    // Volume and stop-all mappings are handled at the App component level
    // Only handle sound mappings here
    this.sounds.forEach((sound) => {
      if (!sound.midiMapping) return;

      const mapping = sound.midiMapping;

      // Handle note-based mappings (buttons/keys)
      if (
        mapping.note !== undefined &&
        message.deviceId === mapping.deviceId &&
        message.channel === mapping.channel &&
        message.note === mapping.note
      ) {
        if (message.type === 'noteon') {
          this.handleNoteOn(sound, message.value);
        } else if (message.type === 'noteoff') {
          this.handleNoteOff(sound);
        }
      }

      // Handle CC-based mappings (knobs/faders)
      if (
        mapping.ccNumber !== undefined &&
        message.type === 'cc' &&
        message.deviceId === mapping.deviceId &&
        message.channel === mapping.channel &&
        message.ccNumber === mapping.ccNumber
      ) {
        // Check if this sound requires a specific CC value
        if (mapping.ccValue !== undefined) {
          // Only trigger if the CC value matches exactly
          if (message.value === mapping.ccValue) {
            this.audioEngine.playSound(sound, 127).catch((error) => {
              console.error(`Failed to play sound ${sound.name}:`, error);
            });

            if (this.onSoundTriggeredCallback) {
              this.onSoundTriggeredCallback(sound.id);
            }
          }
        }
      }
    });
  }

  private handleNoteOn(sound: Sound, velocity: number): void {
    const mappingKey = this.getMappingKey(sound.midiMapping!);

    // Notify that sound was triggered
    if (this.onSoundTriggeredCallback) {
      this.onSoundTriggeredCallback(sound.id);
    }

    if (sound.settings.playMode === 'trigger') {
      // Trigger mode: start playing, don't track for note off
      this.audioEngine.playSound(sound, velocity).catch((error) => {
        console.error(`Failed to play sound ${sound.name}:`, error);
      });
    } else if (sound.settings.playMode === 'gate') {
      // Gate mode: start playing and track for note off
      this.audioEngine.playSound(sound, velocity).then((playingId) => {
        if (!this.activeSoundsPerMapping.has(mappingKey)) {
          this.activeSoundsPerMapping.set(mappingKey, []);
        }
        this.activeSoundsPerMapping.get(mappingKey)!.push(playingId);
      }).catch((error) => {
        console.error(`Failed to play sound ${sound.name}:`, error);
      });
    } else if (sound.settings.playMode === 'loop') {
      // Loop mode: start playing and loop until stopped manually or note off
      this.audioEngine.playSound(sound, velocity).then((playingId) => {
        if (!this.activeSoundsPerMapping.has(mappingKey)) {
          this.activeSoundsPerMapping.set(mappingKey, []);
        }
        this.activeSoundsPerMapping.get(mappingKey)!.push(playingId);
      }).catch((error) => {
        console.error(`Failed to play sound ${sound.name}:`, error);
      });
    }
  }

  private handleNoteOff(sound: Sound): void {
    // Only handle note off for gate and loop modes
    if (sound.settings.playMode !== 'gate' && sound.settings.playMode !== 'loop') return;

    const mappingKey = this.getMappingKey(sound.midiMapping!);
    const playingIds = this.activeSoundsPerMapping.get(mappingKey);

    if (playingIds && playingIds.length > 0) {
      // Stop all active instances of this sound
      playingIds.forEach((playingId) => {
        this.audioEngine.stopSound(playingId);
      });
      this.activeSoundsPerMapping.delete(mappingKey);
    }
  }

  private getMappingKey(mapping: { deviceId: string; note?: number; ccNumber?: number; ccValue?: number; channel: number }): string {
    if (mapping.note !== undefined) {
      return `${mapping.deviceId}:${mapping.channel}:note:${mapping.note}`;
    } else if (mapping.ccNumber !== undefined) {
      // Include ccValue in the key if specified (for bidirectional knobs)
      if (mapping.ccValue !== undefined) {
        return `${mapping.deviceId}:${mapping.channel}:cc:${mapping.ccNumber}:${mapping.ccValue}`;
      }
      return `${mapping.deviceId}:${mapping.channel}:cc:${mapping.ccNumber}`;
    }
    return `${mapping.deviceId}:${mapping.channel}`;
  }

  public async addSound(filePath: string, name: string): Promise<Sound> {
    const nextOrder = this.sounds.size;
    const sound: Sound = {
      id: uuidv4(),
      name,
      filePath,
      order: nextOrder,
      settings: {
        playMode: 'trigger',
        fadeInMs: this.settings.defaultFadeInMs,
        fadeOutMs: this.settings.defaultFadeOutMs,
        volume: 1.0,
      },
    };

    await this.audioEngine.loadSound(sound);
    this.sounds.set(sound.id, sound);
    return sound;
  }

  public removeSound(soundId: string): void {
    const sound = this.sounds.get(soundId);
    if (sound) {
      this.audioEngine.unloadSound(soundId);
      this.sounds.delete(soundId);
    }
  }

  public updateSound(soundId: string, updates: Partial<Sound>): void {
    const sound = this.sounds.get(soundId);
    if (sound) {
      // Create a new object to avoid mutating Redux state
      const updatedSound = { ...sound, ...updates };
      this.sounds.set(soundId, updatedSound);
    }
  }

  public getSound(soundId: string): Sound | undefined {
    return this.sounds.get(soundId);
  }

  public getAllSounds(): Sound[] {
    return Array.from(this.sounds.values());
  }

  public setMasterVolume(volume: number): void {
    this.settings.masterVolume = volume;
    this.audioEngine.setMasterVolume(volume);
  }

  public getMasterVolume(): number {
    return this.settings.masterVolume;
  }

  public updateSettings(updates: Partial<AppSettings>): void {
    Object.assign(this.settings, updates);
    if (updates.masterVolume !== undefined) {
      this.audioEngine.setMasterVolume(updates.masterVolume);
    }
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public async playSound(soundId: string): Promise<void> {
    console.log(`🎮 SoundManager.playSound called for soundId: ${soundId}`);
    const sound = this.sounds.get(soundId);
    if (sound) {
      console.log(`✅ Sound found in manager: ${sound.name}`);
      await this.audioEngine.playSound(sound);
    } else {
      console.error(`❌ Sound not found in manager: ${soundId}`);
      console.log(`Available sounds:`, Array.from(this.sounds.keys()));
    }
  }

  public stopSound(soundId: string): void {
    this.audioEngine.stopSoundsBySoundId(soundId);
  }

  public stopAllSounds(): void {
    this.audioEngine.stopAllSounds();
    this.activeSoundsPerMapping.clear();
  }

  public destroy(): void {
    this.audioEngine.destroy();
    this.midiHandler.destroy();
    this.sounds.clear();
    this.activeSoundsPerMapping.clear();
  }
}
