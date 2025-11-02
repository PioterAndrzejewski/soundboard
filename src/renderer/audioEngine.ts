import { Sound, SoundSettings, EffectsState } from '../shared/types';

interface PlayingSound {
  id: string;
  soundId: string;
  audio: HTMLAudioElement;
  source?: MediaElementAudioSourceNode;
  startTime: number;
  isGateMode: boolean;
  settings: SoundSettings;
  fadeOutTimeout?: ReturnType<typeof setTimeout>;
}

export class AudioEngine {
  private playingSounds: Map<string, PlayingSound> = new Map();
  private masterVolume: number = 0.8;
  private outputDeviceId: string | undefined;

  // Web Audio API context and effects nodes
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private lowShelfFilter: BiquadFilterNode | null = null;
  private midPeakFilter: BiquadFilterNode | null = null;
  private highShelfFilter: BiquadFilterNode | null = null;
  private distortionNode: WaveShaperNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayWet: GainNode | null = null;
  private reverbWet: GainNode | null = null;
  private currentEffects: EffectsState = {
    pitch: 0,
    filterLow: 1,
    filterMid: 1,
    filterHigh: 1,
    filterResonance: 0,
    distortion: 0,
    reverb: 0,
    delay: 0,
  };

  constructor() {
    console.log('AudioEngine initialized with HTML5 Audio + Web Audio API effects');
    this.initializeWebAudio();
  }

  private initializeWebAudio(): void {
    try {
      this.audioContext = new AudioContext();

      // Create master gain node
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = this.masterVolume;

      // Create filter nodes (3-band EQ)
      this.lowShelfFilter = this.audioContext.createBiquadFilter();
      this.lowShelfFilter.type = 'lowshelf';
      this.lowShelfFilter.frequency.value = 200;
      this.lowShelfFilter.gain.value = 0;

      this.midPeakFilter = this.audioContext.createBiquadFilter();
      this.midPeakFilter.type = 'peaking';
      this.midPeakFilter.frequency.value = 1000;
      this.midPeakFilter.gain.value = 0;
      this.midPeakFilter.Q.value = 1;

      this.highShelfFilter = this.audioContext.createBiquadFilter();
      this.highShelfFilter.type = 'highshelf';
      this.highShelfFilter.frequency.value = 3000;
      this.highShelfFilter.gain.value = 0;

      // Create distortion node
      this.distortionNode = this.audioContext.createWaveShaper();
      const initialCurve = this.makeDistortionCurve(0);
      if (initialCurve) {
        this.distortionNode.curve = initialCurve;
      }
      this.distortionNode.oversample = '4x';

      // Create delay effect
      this.delayNode = this.audioContext.createDelay(2.0);
      this.delayNode.delayTime.value = 0.3;
      this.delayFeedback = this.audioContext.createGain();
      this.delayFeedback.gain.value = 0.3;
      this.delayWet = this.audioContext.createGain();
      this.delayWet.gain.value = 0;

      // Create reverb wet gain
      this.reverbWet = this.audioContext.createGain();
      this.reverbWet.gain.value = 0;

      // Create simple reverb impulse response
      this.reverbNode = this.audioContext.createConvolver();
      this.reverbNode.buffer = this.createReverbImpulse();

      console.log('✅ Web Audio API initialized with effects chain');
    } catch (error) {
      console.error('Failed to initialize Web Audio API:', error);
    }
  }

  private makeDistortionCurve(amount: number): Float32Array | null {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    const k = amount * 100;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve as Float32Array;
  }

  private createReverbImpulse(): AudioBuffer {
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 second reverb
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    return impulse;
  }

  public setEffects(effects: EffectsState): void {
    this.currentEffects = { ...effects };
    this.updateEffectsChain();
  }

  private updateEffectsChain(): void {
    if (!this.audioContext) return;

    const effects = this.currentEffects;

    // Update filters (3-band EQ)
    if (this.lowShelfFilter) {
      const lowGain = (effects.filterLow - 1) * 24; // -24dB to 0dB
      this.lowShelfFilter.gain.value = lowGain;
      this.lowShelfFilter.Q.value = effects.filterResonance * 10 + 0.1;
    }

    if (this.midPeakFilter) {
      const midGain = (effects.filterMid - 1) * 24;
      this.midPeakFilter.gain.value = midGain;
      this.midPeakFilter.Q.value = effects.filterResonance * 10 + 1;
    }

    if (this.highShelfFilter) {
      const highGain = (effects.filterHigh - 1) * 24;
      this.highShelfFilter.gain.value = highGain;
      this.highShelfFilter.Q.value = effects.filterResonance * 10 + 0.1;
    }

    // Update distortion
    if (this.distortionNode) {
      const curve = this.makeDistortionCurve(effects.distortion);
      if (curve) {
        this.distortionNode.curve = curve;
      }
    }

    // Update delay mix
    if (this.delayWet) {
      this.delayWet.gain.value = effects.delay;
    }

    // Update reverb mix
    if (this.reverbWet) {
      this.reverbWet.gain.value = effects.reverb;
    }

    // Note: Pitch shifting requires more complex implementation
    // For now, we'll use playbackRate as an approximation
    this.playingSounds.forEach(ps => {
      if (effects.pitch !== 0) {
        const pitchFactor = Math.pow(2, effects.pitch / 12);
        ps.audio.playbackRate = pitchFactor;
      } else {
        ps.audio.playbackRate = 1.0;
      }
    });
  }

  private connectEffectsChain(source: MediaElementAudioSourceNode): void {
    if (!this.audioContext || !this.masterGainNode) return;

    const dryGain = this.audioContext.createGain();
    dryGain.gain.value = 1;

    // Main signal chain: source -> filters -> distortion -> dry gain -> master
    source.connect(this.lowShelfFilter!);
    this.lowShelfFilter!.connect(this.midPeakFilter!);
    this.midPeakFilter!.connect(this.highShelfFilter!);
    this.highShelfFilter!.connect(this.distortionNode!);
    this.distortionNode!.connect(dryGain);

    // Delay send/return
    dryGain.connect(this.delayNode!);
    this.delayNode!.connect(this.delayFeedback!);
    this.delayFeedback!.connect(this.delayNode!); // feedback loop
    this.delayNode!.connect(this.delayWet!);
    this.delayWet!.connect(this.masterGainNode);

    // Reverb send/return
    dryGain.connect(this.reverbNode!);
    this.reverbNode!.connect(this.reverbWet!);
    this.reverbWet!.connect(this.masterGainNode);

    // Dry signal to master
    dryGain.connect(this.masterGainNode);

    // Master to destination
    this.masterGainNode.connect(this.audioContext.destination);
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
    // For trigger mode, if sound is already playing, fade it out and DON'T play again
    if (sound.settings.playMode === 'trigger') {
      const alreadyPlaying = Array.from(this.playingSounds.values()).filter(
        ps => ps.soundId === sound.id
      );
      if (alreadyPlaying.length > 0) {
        console.log(`🔄 Trigger mode: fading out already playing sound: ${sound.name}`);
        alreadyPlaying.forEach(ps => this.stopSound(ps.id));
        // Return early - don't play again
        return alreadyPlaying[0].id;
      }
    }

    // For loop mode, behave like trigger mode: if already playing, stop it and DON'T play again
    if (sound.settings.playMode === 'loop') {
      const alreadyPlaying = Array.from(this.playingSounds.values()).filter(
        ps => ps.soundId === sound.id
      );
      if (alreadyPlaying.length > 0) {
        console.log(`🔄 Loop mode: stopping looping sound: ${sound.name}`);
        alreadyPlaying.forEach(ps => this.stopSound(ps.id));
        // Return early - don't play again (trigger behavior)
        return alreadyPlaying[0].id;
      }
    }

    const playingId = `${sound.id}-${Date.now()}`;

    console.log(`🎵 Playing sound: ${sound.name} (mode: ${sound.settings.playMode})`);

    // Create audio element
    const audio = new Audio();
    audio.src = this.getFileUrl(sound.filePath);
    audio.loop = sound.settings.playMode === 'loop';

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

    // Apply fade in for gate and trigger modes
    if ((sound.settings.playMode === 'gate' || sound.settings.playMode === 'trigger') && sound.settings.fadeInMs > 0) {
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

    // Connect to Web Audio API effects chain
    let source: MediaElementAudioSourceNode | undefined;
    if (this.audioContext) {
      try {
        source = this.audioContext.createMediaElementSource(audio);
        this.connectEffectsChain(source);
      } catch (error) {
        console.warn('Failed to connect audio to effects chain:', error);
      }
    }

    const playingSound: PlayingSound = {
      id: playingId,
      soundId: sound.id,
      audio,
      source,
      startTime: Date.now(),
      isGateMode: sound.settings.playMode === 'gate',
      settings: sound.settings,
    };

    this.playingSounds.set(playingId, playingSound);

    // Handle sound end (but not for loop mode since it loops automatically)
    audio.onended = () => {
      if (sound.settings.playMode !== 'loop') {
        this.cleanupSound(playingId);
      }
    };

    audio.onerror = (error) => {
      console.error('Audio playback error:', error);
      this.cleanupSound(playingId);
    };

    // Set start time if specified
    if (sound.settings.startTime !== undefined && sound.settings.startTime > 0) {
      audio.currentTime = sound.settings.startTime;
    }

    // Handle end time for loop mode or regular playback
    if (sound.settings.endTime !== undefined && sound.settings.endTime > 0) {
      const checkEndTime = () => {
        if (audio.currentTime >= sound.settings.endTime!) {
          if (sound.settings.playMode === 'loop' && sound.settings.startTime !== undefined) {
            // Loop back to start time
            audio.currentTime = sound.settings.startTime || 0;
          } else if (sound.settings.playMode === 'loop') {
            // Loop back to beginning
            audio.currentTime = 0;
          } else {
            // Stop playback
            this.stopSound(playingId);
          }
        }
      };
      audio.addEventListener('timeupdate', checkEndTime);
    }

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

    const { audio, settings } = playingSound;

    // Apply fade out for gate and trigger modes
    if ((settings.playMode === 'gate' || settings.playMode === 'trigger') && settings.fadeOutMs > 0) {
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
    const playingSounds = Array.from(this.playingSounds.values());

    playingSounds.forEach(playingSound => {
      const { audio, settings, id: playingId } = playingSound;
      const fadeOutMs = settings.fadeOutMs || 100; // Use at least 100ms fade out

      // Apply fade out to all sounds
      const fadeSteps = 20;
      const stepTime = fadeOutMs / fadeSteps;
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
      }, fadeOutMs + 100);
    });
  }

  public getPlayingSounds(): string[] {
    return Array.from(this.playingSounds.keys());
  }

  public isPlaying(soundId: string): boolean {
    return Array.from(this.playingSounds.values()).some(ps => ps.soundId === soundId);
  }

  public getPlayingSoundsInfo(): Array<{
    playingId: string;
    soundId: string;
    soundName: string;
    currentTime: number;
    duration: number;
    playMode: string;
    isFadingOut: boolean;
  }> {
    return Array.from(this.playingSounds.values()).map(ps => ({
      playingId: ps.id,
      soundId: ps.soundId,
      soundName: '', // Will be filled by caller
      currentTime: ps.audio.currentTime,
      duration: ps.audio.duration || 0,
      playMode: ps.settings.playMode,
      isFadingOut: !!ps.fadeOutTimeout,
    }));
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
