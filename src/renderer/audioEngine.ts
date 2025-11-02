import { Sound, SoundSettings } from '../shared/types';

interface PlayingSound {
  id: string;
  soundId: string;
  audio: HTMLAudioElement;
  startTime: number;
  isGateMode: boolean;
  settings: SoundSettings;
  fadeOutTimeout?: ReturnType<typeof setTimeout>;
}

export class AudioEngine {
  private playingSounds: Map<string, PlayingSound> = new Map();
  private masterVolume: number = 0.8;
  private outputDeviceId: string | undefined;

  constructor() {
    console.log('AudioEngine initialized with HTML5 Audio');
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    // Update volume for all currently playing sounds
    this.playingSounds.forEach(ps => {
      ps.audio.volume = this.calculateVolume(ps.settings.volume);
    });
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  private calculateVolume(soundVolume: number): number {
    return Math.max(0, Math.min(1, soundVolume * this.masterVolume));
  }

  public async setOutputDevice(deviceId: string | undefined): Promise<void> {
    this.outputDeviceId = deviceId;

    try {
      // Apply to all currently playing sounds
      for (const [, ps] of this.playingSounds) {
        if ('setSinkId' in ps.audio) {
          await (ps.audio as any).setSinkId(deviceId || '');
        }
      }
      console.log('✅ Audio output device set to:', deviceId || 'default');
    } catch (error) {
      console.error('Failed to set audio output device:', error);
    }
  }

  public async loadSound(sound: Sound): Promise<void> {
    // No preloading needed with HTML5 Audio
    console.log(`📝 Registered sound: ${sound.name} (HTML5 Audio mode)`);
  }

  public async preloadSound(sound: Sound): Promise<void> {
    // Optional preload by creating and loading the audio element
    console.log(`⚡ Preloading sound: ${sound.name}`);
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = this.getFileUrl(sound.filePath);
    await new Promise((resolve, reject) => {
      audio.oncanplaythrough = resolve;
      audio.onerror = reject;
    });
  }

  private getFileUrl(filePath: string): string {
    // Convert Windows paths to file:// URL
    const normalizedPath = filePath.replace(/\\/g, '/');
    if (/^[A-Za-z]:\//.test(normalizedPath)) {
      return `file:///${normalizedPath}`;
    }
    return `file://${normalizedPath}`;
  }

  public async playSound(sound: Sound, velocity: number = 127): Promise<string> {
    const playingId = `${sound.id}-${Date.now()}`;

    console.log(`🎵 Playing sound: ${sound.name}`);

    // Create audio element
    const audio = new Audio();
    audio.src = this.getFileUrl(sound.filePath);

    // Set output device if specified
    if (this.outputDeviceId && 'setSinkId' in audio) {
      try {
        await (audio as any).setSinkId(this.outputDeviceId);
      } catch (error) {
        console.warn('Failed to set output device for this sound:', error);
      }
    }

    // Calculate volume based on velocity and sound settings
    const velocityFactor = velocity / 127;
    const targetVolume = sound.settings.volume * velocityFactor;
    audio.volume = this.calculateVolume(targetVolume);

    // Apply fade in for gate mode
    if (sound.settings.playMode === 'gate' && sound.settings.fadeInMs > 0) {
      audio.volume = 0;
      const fadeSteps = 20;
      const stepTime = sound.settings.fadeInMs / fadeSteps;
      const volumeStep = this.calculateVolume(targetVolume) / fadeSteps;

      let currentStep = 0;
      const fadeInterval = setInterval(() => {
        currentStep++;
        audio.volume = Math.min(this.calculateVolume(targetVolume), volumeStep * currentStep);
        if (currentStep >= fadeSteps) {
          clearInterval(fadeInterval);
        }
      }, stepTime);
    }

    const playingSound: PlayingSound = {
      id: playingId,
      soundId: sound.id,
      audio,
      startTime: Date.now(),
      isGateMode: sound.settings.playMode === 'gate',
      settings: sound.settings,
    };

    this.playingSounds.set(playingId, playingSound);

    // Handle sound end
    audio.onended = () => {
      this.cleanupSound(playingId);
    };

    audio.onerror = (error) => {
      console.error('Audio playback error:', error);
      this.cleanupSound(playingId);
    };

    // Start playback
    try {
      await audio.play();
      console.log(`✅ Sound playing: ${sound.name}`);
    } catch (error) {
      console.error('Failed to play sound:', error);
      this.cleanupSound(playingId);
      throw error;
    }

    return playingId;
  }

  public stopSound(playingId: string): void {
    const playingSound = this.playingSounds.get(playingId);
    if (!playingSound) return;

    const { audio, settings, isGateMode } = playingSound;

    if (isGateMode && settings.fadeOutMs > 0) {
      // Apply fade out
      const fadeSteps = 20;
      const stepTime = settings.fadeOutMs / fadeSteps;
      const startVolume = audio.volume;
      const volumeStep = startVolume / fadeSteps;

      let currentStep = 0;
      const fadeInterval = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(0, startVolume - (volumeStep * currentStep));
        if (currentStep >= fadeSteps) {
          clearInterval(fadeInterval);
          audio.pause();
          this.cleanupSound(playingId);
        }
      }, stepTime);

      playingSound.fadeOutTimeout = setTimeout(() => {
        clearInterval(fadeInterval);
        audio.pause();
        this.cleanupSound(playingId);
      }, settings.fadeOutMs + 100);
    } else {
      // Immediate stop
      audio.pause();
      this.cleanupSound(playingId);
    }
  }

  public stopSoundsBySoundId(soundId: string): void {
    const playingIds = Array.from(this.playingSounds.values())
      .filter(ps => ps.soundId === soundId)
      .map(ps => ps.id);

    playingIds.forEach(id => this.stopSound(id));
  }

  public stopAllSounds(): void {
    const playingIds = Array.from(this.playingSounds.keys());
    playingIds.forEach(id => this.stopSound(id));
  }

  public getPlayingSounds(): string[] {
    return Array.from(this.playingSounds.keys());
  }

  public isPlaying(soundId: string): boolean {
    return Array.from(this.playingSounds.values()).some(ps => ps.soundId === soundId);
  }

  private cleanupSound(playingId: string): void {
    const playingSound = this.playingSounds.get(playingId);
    if (playingSound) {
      if (playingSound.fadeOutTimeout) {
        clearTimeout(playingSound.fadeOutTimeout);
      }
      playingSound.audio.src = ''; // Release audio resources
      playingSound.audio.remove();
      this.playingSounds.delete(playingId);
    }
  }

  public unloadSound(soundId: string): void {
    // Stop all instances of this sound
    this.stopSoundsBySoundId(soundId);
    console.log(`🗑️ Unloaded sound: ${soundId}`);
  }

  public destroy(): void {
    this.stopAllSounds();
    console.log(`Destroyed audio engine`);
  }

  public getCacheStats(): { cached: number; maxCache: number } {
    return {
      cached: 0,
      maxCache: 0
    };
  }
}
