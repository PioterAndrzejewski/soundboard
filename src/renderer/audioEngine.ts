import { Sound, SoundSettings } from '../shared/types';

interface PlayingSound {
  id: string;
  soundId: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number;
  isGateMode: boolean;
  settings: SoundSettings;
  fadeOutTimeout?: ReturnType<typeof setTimeout>;
}

export class AudioEngine {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private playingSounds: Map<string, PlayingSound> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private outputNodes: Map<string, MediaStreamAudioDestinationNode> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer>> = new Map();

  // Cache settings
  private maxCachedBuffers = 20; // Keep max 20 decoded files in memory
  private cacheAccessOrder: string[] = []; // For LRU eviction

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
    // No longer preload - just validate the file exists
    console.log(`📝 Registered sound: ${sound.name} (will load on-demand)`);
  }

  public async preloadSound(sound: Sound): Promise<void> {
    // Optional: allow manual preloading for frequently used sounds
    console.log(`⚡ Preloading sound: ${sound.name}`);
    await this.getOrLoadBuffer(sound);
  }

  private async decodeAudioFile(filePath: string): Promise<AudioBuffer> {
    console.log('Decoding audio from:', filePath);
    console.log('AudioContext state:', this.audioContext.state);

    // Resume AudioContext if suspended
    if (this.audioContext.state === 'suspended') {
      console.log('Resuming AudioContext...');
      await this.audioContext.resume();
    }

    // Read file via IPC
    const receivedData: any = await window.electronAPI.readAudioFile(filePath);
    console.log('Audio file read, type:', typeof receivedData, 'constructor:', receivedData?.constructor?.name);

    // Convert to ArrayBuffer
    let arrayBuffer: ArrayBuffer;
    if (receivedData instanceof ArrayBuffer) {
      arrayBuffer = receivedData.slice(0);
    } else if (receivedData && typeof receivedData === 'object' && 'byteLength' in receivedData && 'buffer' in receivedData) {
      const view = receivedData as ArrayBufferView;
      const sourceBuffer = view.buffer;
      if (sourceBuffer instanceof ArrayBuffer) {
        arrayBuffer = sourceBuffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
      } else {
        const uint8 = new Uint8Array(sourceBuffer, view.byteOffset, view.byteLength);
        arrayBuffer = uint8.slice(0).buffer;
      }
    } else if (Array.isArray(receivedData)) {
      const uint8 = new Uint8Array(receivedData);
      arrayBuffer = uint8.buffer;
    } else if (receivedData && typeof receivedData === 'object' && 'data' in receivedData) {
      const uint8 = new Uint8Array(receivedData.data);
      arrayBuffer = uint8.buffer;
    } else {
      throw new Error('Unexpected data type received from IPC');
    }

    if (arrayBuffer.byteLength === 0) {
      throw new Error('Audio file is empty');
    }

    const sizeMB = arrayBuffer.byteLength / (1024 * 1024);
    console.log(`Decoding ${sizeMB.toFixed(1)}MB audio file...`);

    // Decode audio
    try {
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      console.log('✅ Decoded:', {
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate
      });
      return audioBuffer;
    } catch (decodeError: any) {
      console.error('Decode failed:', decodeError);
      throw new Error(`Failed to decode audio: ${decodeError?.message || 'Unknown error'}`);
    }
  }

  private async getOrLoadBuffer(sound: Sound): Promise<AudioBuffer> {
    // Check if already cached
    if (this.audioBuffers.has(sound.id)) {
      console.log(`🎵 Using cached buffer for: ${sound.name}`);
      this.updateCacheAccess(sound.id);
      return this.audioBuffers.get(sound.id)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(sound.id)) {
      console.log(`⏳ Waiting for ongoing load: ${sound.name}`);
      return this.loadingPromises.get(sound.id)!;
    }

    // Start loading
    console.log(`📥 Loading on-demand: ${sound.name}`);
    const loadPromise = this.decodeAudioFile(sound.filePath)
      .then(buffer => {
        // Add to cache
        this.audioBuffers.set(sound.id, buffer);
        this.updateCacheAccess(sound.id);
        this.evictOldCacheEntries();
        this.loadingPromises.delete(sound.id);
        return buffer;
      })
      .catch(error => {
        this.loadingPromises.delete(sound.id);
        throw error;
      });

    this.loadingPromises.set(sound.id, loadPromise);
    return loadPromise;
  }

  private updateCacheAccess(soundId: string): void {
    // Remove from current position
    const index = this.cacheAccessOrder.indexOf(soundId);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    // Add to end (most recent)
    this.cacheAccessOrder.push(soundId);
  }

  private evictOldCacheEntries(): void {
    while (this.audioBuffers.size > this.maxCachedBuffers) {
      const oldestId = this.cacheAccessOrder.shift();
      if (oldestId) {
        console.log(`🗑️ Evicting cached buffer: ${oldestId}`);
        this.audioBuffers.delete(oldestId);
      }
    }
  }

  public async playSound(sound: Sound, velocity: number = 127): Promise<string> {
    // Load buffer on-demand if not cached
    const buffer = await this.getOrLoadBuffer(sound);

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
    // Remove buffer from cache
    this.audioBuffers.delete(soundId);
    // Remove from cache access order
    const index = this.cacheAccessOrder.indexOf(soundId);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    console.log(`🗑️ Unloaded sound: ${soundId}`);
  }

  public destroy(): void {
    this.stopAllSounds();
    console.log(`Clearing ${this.audioBuffers.size} cached audio buffers`);
    this.audioBuffers.clear();
    this.cacheAccessOrder = [];
    this.loadingPromises.clear();
    this.outputNodes.clear();
    this.audioContext.close();
  }

  public getCacheStats(): { cached: number; maxCache: number } {
    return {
      cached: this.audioBuffers.size,
      maxCache: this.maxCachedBuffers
    };
  }
}
