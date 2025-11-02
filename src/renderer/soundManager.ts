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

  private handleMidiMessage(message: MidiMessage): void {
    // Handle volume mapping
    if (message.type === 'cc' && this.settings.volumeMapping) {
      const vm = this.settings.volumeMapping;
      if (
        message.deviceId === vm.deviceId &&
        message.ccNumber === vm.ccNumber &&
        message.channel === vm.channel
      ) {
        const volume = message.value / 127;
        this.setMasterVolume(volume);
        return;
      }
    }

    // Handle stop all mapping
    if (message.type === 'noteon' && this.settings.stopAllMapping) {
      const sam = this.settings.stopAllMapping;
      if (
        message.deviceId === sam.deviceId &&
        message.note === sam.note &&
        message.channel === sam.channel
      ) {
        this.stopAllSounds();
        return;
      }
    }

    // Handle sound mappings
    this.sounds.forEach((sound) => {
      if (!sound.midiMapping) return;

      const mapping = sound.midiMapping;
      if (
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
    });
  }

  private handleNoteOn(sound: Sound, velocity: number): void {
    const mappingKey = this.getMappingKey(sound.midiMapping!);

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
    }
  }

  private handleNoteOff(sound: Sound): void {
    if (sound.settings.playMode !== 'gate') return;

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

  private getMappingKey(mapping: { deviceId: string; note: number; channel: number }): string {
    return `${mapping.deviceId}:${mapping.channel}:${mapping.note}`;
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
      Object.assign(sound, updates);
      this.sounds.set(soundId, sound);
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
    const sound = this.sounds.get(soundId);
    if (sound) {
      await this.audioEngine.playSound(sound);
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
