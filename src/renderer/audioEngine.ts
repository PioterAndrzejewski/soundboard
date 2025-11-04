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
  blobUrl?: string; // Store blob URL for cleanup
}

export class AudioEngine {
  private playingSounds: Map<string, PlayingSound> = new Map();
  private masterVolume: number = 0.8;
  private outputDeviceId: string | undefined;

  // Web Audio API context and effects nodes
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
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
    speed: 1,
    pan: 0,
    filterLow: 1,
    filterMid: 1,
    filterHigh: 1,
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

      // Create stereo panner
      this.pannerNode = this.audioContext.createStereoPanner();
      this.pannerNode.pan.value = 0; // Center

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
        this.distortionNode.curve = initialCurve as any;
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

      // Connect the effects chain ONCE during initialization
      this.setupEffectsChain();

      console.log('✅ Web Audio API initialized with effects chain');
    } catch (error) {
      console.error('Failed to initialize Web Audio API:', error);
    }
  }

  private setupEffectsChain(): void {
    if (!this.audioContext || !this.masterGainNode) return;

    // Set up the effects chain connections ONCE
    // These connections will be reused for all sounds

    // Main signal chain: panner -> filters -> distortion
    this.pannerNode!.connect(this.lowShelfFilter!);
    this.lowShelfFilter!.connect(this.midPeakFilter!);
    this.midPeakFilter!.connect(this.highShelfFilter!);
    this.highShelfFilter!.connect(this.distortionNode!);

    // Distortion output goes to master gain (dry signal path)
    this.distortionNode!.connect(this.masterGainNode);

    // Delay send/return from distortion output
    this.distortionNode!.connect(this.delayNode!);
    this.delayNode!.connect(this.delayFeedback!);
    this.delayFeedback!.connect(this.delayNode!); // feedback loop
    this.delayNode!.connect(this.delayWet!);
    this.delayWet!.connect(this.masterGainNode);

    // Reverb send/return from distortion output
    this.distortionNode!.connect(this.reverbNode!);
    this.reverbNode!.connect(this.reverbWet!);
    this.reverbWet!.connect(this.masterGainNode);

    // Master to destination - ONLY CONNECTED ONCE HERE
    this.masterGainNode.connect(this.audioContext.destination);
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
    return curve as any;
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

    // Update pan
    if (this.pannerNode) {
      this.pannerNode.pan.value = effects.pan;
    }

    // Update filters (3-band EQ)
    // Map 0.0-1.0 to -24dB to +24dB, with 0.5 being 0dB (no change)
    if (this.lowShelfFilter) {
      const lowGain = (effects.filterLow - 0.5) * 48; // 0.5 = 0dB
      this.lowShelfFilter.gain.value = lowGain;
    }

    if (this.midPeakFilter) {
      const midGain = (effects.filterMid - 0.5) * 48; // 0.5 = 0dB
      this.midPeakFilter.gain.value = midGain;
    }

    if (this.highShelfFilter) {
      const highGain = (effects.filterHigh - 0.5) * 48; // 0.5 = 0dB
      this.highShelfFilter.gain.value = highGain;
    }

    // Update distortion
    if (this.distortionNode) {
      const curve = this.makeDistortionCurve(effects.distortion);
      if (curve) {
        this.distortionNode.curve = curve as any;
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

    // Update speed and pitch for all playing sounds
    // Speed: direct playback rate control (changes both pitch and tempo)
    // Pitch: would need pitch shifter algorithm (not yet implemented - uses speed for now)
    this.playingSounds.forEach(ps => {
      // For now, speed controls playback rate
      // TODO: Implement proper pitch shifting without tempo change
      ps.audio.playbackRate = effects.speed;
    });
  }

  private connectSourceToEffects(source: AudioNode): void {
    if (!this.audioContext || !this.pannerNode) return;

    // Simply connect the new audio source to the beginning of the pre-configured effects chain
    // The effects chain is already set up and connected to the destination in setupEffectsChain()
    source.connect(this.pannerNode);
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
    audio.src = await this.getFileUrl(sound.filePath);
    await new Promise((resolve, reject) => {
      audio.oncanplaythrough = resolve;
      audio.onerror = reject;
    });
  }

  private async getFileUrl(filePath: string): Promise<string> {
    try {
      // Load the audio file via IPC to avoid file:// security restrictions
      const arrayBuffer = await window.electronAPI.readAudioFile(filePath);

      // Detect MIME type from file extension
      const ext = filePath.toLowerCase().split('.').pop();
      let mimeType = 'audio/mpeg'; // default

      if (ext === 'wav') mimeType = 'audio/wav';
      else if (ext === 'ogg') mimeType = 'audio/ogg';
      else if (ext === 'mp3') mimeType = 'audio/mpeg';
      else if (ext === 'flac') mimeType = 'audio/flac';
      else if (ext === 'm4a' || ext === 'aac') mimeType = 'audio/mp4';
      else if (ext === 'webm') mimeType = 'audio/webm';

      // Convert ArrayBuffer to Blob with proper MIME type
      const blob = new Blob([arrayBuffer], { type: mimeType });

      // Create a blob URL
      const blobUrl = URL.createObjectURL(blob);

      console.log(`✅ Created blob URL for: ${filePath} (${mimeType})`);
      return blobUrl;
    } catch (error) {
      console.error(`❌ Failed to load audio file: ${filePath}`, error);
      throw error;
    }
  }

  public async playSound(sound: Sound, velocity: number = 127): Promise<string> {
    console.log(`🎬 playSound called for: ${sound.name}, mode: ${sound.settings.playMode}, velocity: ${velocity}`);
    console.log(`📁 File path: ${sound.filePath}`);

    // For trigger mode (restart): if sound is already playing, stop it immediately and restart from beginning
    if (sound.settings.playMode === 'trigger') {
      const alreadyPlaying = Array.from(this.playingSounds.values()).filter(
        ps => ps.soundId === sound.id
      );
      if (alreadyPlaying.length > 0) {
        console.log(`🔄 Trigger mode: restarting sound from beginning: ${sound.name}`);
        // Stop all instances immediately (no fade out for restart)
        alreadyPlaying.forEach(ps => {
          ps.audio.pause();
          this.cleanupSound(ps.id);
        });
        // Continue to play the sound again from the beginning
      }
    }

    // For trigger-stop mode: if already playing, stop it with fade out (toggle behavior)
    if (sound.settings.playMode === 'trigger-stop') {
      const alreadyPlaying = Array.from(this.playingSounds.values()).filter(
        ps => ps.soundId === sound.id
      );
      if (alreadyPlaying.length > 0) {
        console.log(`🔄 Trigger-stop mode: stopping sound with fade out: ${sound.name}`);
        alreadyPlaying.forEach(ps => this.stopSound(ps.id));
        // Return early - don't play again (toggle off with fade)
        return alreadyPlaying[0].id;
      }
    }

    // For loop mode: if already playing, stop it (toggle off behavior)
    if (sound.settings.playMode === 'loop') {
      const alreadyPlaying = Array.from(this.playingSounds.values()).filter(
        ps => ps.soundId === sound.id
      );
      if (alreadyPlaying.length > 0) {
        console.log(`🔄 Loop mode: stopping looping sound: ${sound.name}`);
        alreadyPlaying.forEach(ps => this.stopSound(ps.id));
        // Return early - don't play again (toggle off)
        return alreadyPlaying[0].id;
      }
    }

    const playingId = `${sound.id}-${Date.now()}`;

    console.log(`🎵 Playing sound: ${sound.name} (mode: ${sound.settings.playMode})`);

    // Create audio element
    console.log(`📦 Creating Audio element...`);
    const audio = new Audio();

    console.log(`🔄 Loading file URL...`);
    const blobUrl = await this.getFileUrl(sound.filePath);
    console.log(`✅ Blob URL created: ${blobUrl}`);

    audio.src = blobUrl;
    audio.loop = sound.settings.playMode === 'loop';
    console.log(`🔊 Audio src set, loop: ${audio.loop}`);

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

    // Apply fade in for gate, trigger, trigger-stop, and loop modes
    if ((sound.settings.playMode === 'gate' || sound.settings.playMode === 'trigger' || sound.settings.playMode === 'trigger-stop' || sound.settings.playMode === 'loop') && sound.settings.fadeInMs > 0) {
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
        console.log(`🎚️ Connecting to Web Audio API effects chain...`);
        source = this.audioContext.createMediaElementSource(audio);
        this.connectSourceToEffects(source);
        console.log(`✅ Connected to effects chain`);
      } catch (error) {
        console.warn('❌ Failed to connect audio to effects chain:', error);
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
      blobUrl,
    };

    this.playingSounds.set(playingId, playingSound);
    console.log(`📝 Added to playingSounds map. Total playing: ${this.playingSounds.size}`);

    // Handle sound end (but not for loop mode since it loops automatically)
    audio.onended = () => {
      console.log(`🏁 Audio ended: ${sound.name}`);
      if (sound.settings.playMode !== 'loop') {
        this.cleanupSound(playingId);
      }
    };

    audio.onerror = (error) => {
      console.error('❌ Audio playback error:', error);
      console.error('Error details:', audio.error);
      this.cleanupSound(playingId);
    };

    audio.onloadedmetadata = () => {
      console.log(`📊 Metadata loaded: duration=${audio.duration}s`);
    };

    audio.oncanplay = () => {
      console.log(`✅ Audio can play (buffered enough data)`);
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
      console.log(`▶️ Calling audio.play()...`);
      await audio.play();
      console.log(`✅ audio.play() succeeded! Sound playing: ${sound.name}`);
      console.log(`Current state: paused=${audio.paused}, currentTime=${audio.currentTime}, readyState=${audio.readyState}`);
    } catch (error) {
      console.error('❌ Failed to play sound:', error);
      this.cleanupSound(playingId);
      throw error;
    }

    return playingId;
  }

  public stopSound(playingId: string): void {
    const playingSound = this.playingSounds.get(playingId);
    if (!playingSound) return;

    const { audio, settings } = playingSound;

    // Apply fade out for gate, trigger, trigger-stop, and loop modes
    if ((settings.playMode === 'gate' || settings.playMode === 'trigger' || settings.playMode === 'trigger-stop' || settings.playMode === 'loop') && settings.fadeOutMs > 0) {
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
      // Revoke blob URL to free memory
      if (playingSound.blobUrl) {
        URL.revokeObjectURL(playingSound.blobUrl);
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
