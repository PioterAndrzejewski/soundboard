import { Sound, SoundSettings } from '../shared/types';

interface PlayingSound {
  id: string;
  soundId: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number;
  isGateMode: boolean;
  settings: SoundSettings;
  fadeOutTimeout?: number;
}

export class AudioEngine {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private playingSounds: Map<string, PlayingSound> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private outputNodes: Map<string, MediaStreamAudioDestinationNode> = new Map();

  constructor() {
    this.audioContext = new AudioContext();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
  }

  public setMasterVolume(volume: number): void {
    this.masterGainNode.gain.setValueAtTime(
      Math.max(0, Math.min(1, volume)),
      this.audioContext.currentTime
    );
  }

  public getMasterVolume(): number {
    return this.masterGainNode.gain.value;
  }

  public async loadSound(sound: Sound): Promise<void> {
    try {
      console.log('Loading sound from:', sound.filePath);

      // Use IPC to read the file from the main process
      const arrayBuffer = await window.electronAPI.readAudioFile(sound.filePath);
      console.log('Audio file read, size:', arrayBuffer.byteLength, 'bytes');

      if (arrayBuffer.byteLength === 0) {
        throw new Error('Audio file is empty');
      }

      console.log('Decoding audio data...');

      // Use the callback-based version for better error handling
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        this.audioContext.decodeAudioData(
          arrayBuffer,
          (buffer) => {
            console.log('Decode successful!', {
              duration: buffer.duration,
              channels: buffer.numberOfChannels,
              sampleRate: buffer.sampleRate
            });
            resolve(buffer);
          },
          (error) => {
            console.error('Decode error:', error);
            reject(new Error(`Failed to decode audio: ${error?.message || 'Unknown error'}`));
          }
        );
      });

      this.audioBuffers.set(sound.id, audioBuffer);
      console.log(`✅ Successfully loaded sound: ${sound.name}`);
    } catch (error) {
      console.error(`❌ Failed to load sound ${sound.name}:`, error);
      throw error;
    }
  }

  public async playSound(sound: Sound, velocity: number = 127): Promise<string> {
    const buffer = this.audioBuffers.get(sound.id);
    if (!buffer) {
      throw new Error(`Sound ${sound.name} not loaded`);
    }

    const playingId = `${sound.id}-${Date.now()}`;
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    source.connect(gainNode);

    // Connect to output device or master
    if (sound.settings.outputDeviceId && this.outputNodes.has(sound.settings.outputDeviceId)) {
      gainNode.connect(this.outputNodes.get(sound.settings.outputDeviceId)!);
    } else {
      gainNode.connect(this.masterGainNode);
    }

    // Calculate volume based on velocity and sound settings
    const velocityFactor = velocity / 127;
    const targetVolume = sound.settings.volume * velocityFactor;

    const currentTime = this.audioContext.currentTime;
    const fadeInTime = sound.settings.fadeInMs / 1000;

    // Apply fade in
    if (sound.settings.playMode === 'gate' && fadeInTime > 0) {
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + fadeInTime);
    } else {
      gainNode.gain.setValueAtTime(targetVolume, currentTime);
    }

    const playingSound: PlayingSound = {
      id: playingId,
      soundId: sound.id,
      source,
      gainNode,
      startTime: currentTime,
      isGateMode: sound.settings.playMode === 'gate',
      settings: sound.settings,
    };

    this.playingSounds.set(playingId, playingSound);

    // Handle sound end
    source.onended = () => {
      this.cleanupSound(playingId);
    };

    source.start(0);

    // For trigger mode, let it play to completion
    if (sound.settings.playMode === 'trigger') {
      // Sound will clean up automatically when it ends
    }

    return playingId;
  }

  public stopSound(playingId: string): void {
    const playingSound = this.playingSounds.get(playingId);
    if (!playingSound) return;

    const fadeOutTime = playingSound.settings.fadeOutMs / 1000;
    const currentTime = this.audioContext.currentTime;

    if (playingSound.isGateMode && fadeOutTime > 0) {
      // Apply fade out
      const currentVolume = playingSound.gainNode.gain.value;
      playingSound.gainNode.gain.cancelScheduledValues(currentTime);
      playingSound.gainNode.gain.setValueAtTime(currentVolume, currentTime);
      playingSound.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeOutTime);

      // Stop after fade out
      playingSound.fadeOutTimeout = setTimeout(() => {
        try {
          playingSound.source.stop();
        } catch (e) {
          // Source may have already stopped
        }
        this.cleanupSound(playingId);
      }, fadeOutTime * 1000);
    } else {
      // Immediate stop
      try {
        playingSound.source.stop();
      } catch (e) {
        // Source may have already stopped
      }
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
      try {
        playingSound.source.disconnect();
        playingSound.gainNode.disconnect();
      } catch (e) {
        // Already disconnected
      }
      this.playingSounds.delete(playingId);
    }
  }

  public unloadSound(soundId: string): void {
    // Stop all instances of this sound
    this.stopSoundsBySoundId(soundId);
    // Remove buffer
    this.audioBuffers.delete(soundId);
  }

  public destroy(): void {
    this.stopAllSounds();
    this.audioBuffers.clear();
    this.outputNodes.clear();
    this.audioContext.close();
  }
}
