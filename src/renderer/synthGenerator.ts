// Generate synthetic audio files for piano keys
// Creates electronic/house beats tuned to specific frequencies

export interface SynthNote {
  note: string;
  frequency: number;
  midiNote: number;
}

// Get frequency for a MIDI note number
export function midiNoteToFrequency(midiNote: number): number {
  // A4 = 440 Hz = MIDI note 69
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Parse note name to MIDI note number (e.g., "C1" -> 24, "A4" -> 69)
export function noteNameToMidiNote(noteName: string): number {
  const noteMap: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };

  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 60; // Default to C4

  const noteName_ = match[1];
  const octave = parseInt(match[2]);

  const noteOffset = noteMap[noteName_];
  if (noteOffset === undefined) return 60;

  // MIDI note = (octave + 1) * 12 + noteOffset
  // C-1 = 0, C0 = 12, C1 = 24, etc.
  return (octave + 1) * 12 + noteOffset;
}

// Instrument types available for synthesis
export type InstrumentType = 'piano' | 'house' | 'flute' | 'trumpet';

// Generate a synthetic audio buffer for a specific note with specified instrument
export async function generateSynthSound(
  noteName: string,
  duration: number = 3.0,
  instrument: InstrumentType = 'piano'
): Promise<AudioBuffer> {
  const audioContext = new AudioContext();
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioContext.createBuffer(2, length, sampleRate);

  const midiNote = noteNameToMidiNote(noteName);
  // Shift up one octave (+12 semitones)
  const frequency = midiNoteToFrequency(midiNote + 12);

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);

  // Generate waveform based on instrument type
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * frequency * t;

    let sample = 0;
    let attackTime = 0.005;
    let decayTime = 0.15;
    let sustainLevel = 0.4;
    let releaseTime = 0.8;

    switch (instrument) {
      case 'piano':
        // Piano-like tone with rich harmonics
        sample = Math.sin(phase) * 0.35;                    // Fundamental
        sample += Math.sin(phase * 2) * 0.25;               // 2nd harmonic (octave)
        sample += Math.sin(phase * 3) * 0.12;               // 3rd harmonic (fifth)
        sample += Math.sin(phase * 4) * 0.08;               // 4th harmonic
        sample += Math.sin(phase * 5) * 0.05;               // 5th harmonic
        sample += Math.sin(phase * 6) * 0.03;               // 6th harmonic
        sample += Math.sin(phase * 7) * 0.02;               // 7th harmonic
        sample += Math.sin(phase * 8) * 0.01;               // 8th harmonic
        // Slight inharmonicity
        sample += Math.sin(phase * 2.01) * 0.04;
        sample += Math.sin(phase * 3.02) * 0.02;
        attackTime = 0.005;
        decayTime = 0.15;
        sustainLevel = 0.35;
        releaseTime = 0.8;
        break;

      case 'house':
        // House techno beat - punchy bass with sub
        sample = Math.sin(phase) * 0.4;                     // Fundamental
        sample += Math.sin(phase * 2) * 0.15;               // 2nd harmonic
        sample += Math.sin(phase * 0.5) * 0.25;             // Sub-bass
        sample += Math.sin(phase * 3) * 0.08;               // 3rd harmonic
        // Add slight noise for punch
        sample += (Math.random() * 2 - 1) * 0.02 * Math.exp(-t * 10);
        attackTime = 0.002;
        decayTime = 0.1;
        sustainLevel = 0.6;
        releaseTime = 0.3;
        break;

      case 'flute':
        // Flute - pure tone with odd harmonics
        sample = Math.sin(phase) * 0.5;                     // Fundamental
        sample += Math.sin(phase * 3) * 0.15;               // 3rd harmonic
        sample += Math.sin(phase * 5) * 0.08;               // 5th harmonic
        sample += Math.sin(phase * 7) * 0.04;               // 7th harmonic
        // Add breath noise at start
        sample += (Math.random() * 2 - 1) * 0.03 * Math.exp(-t * 20);
        attackTime = 0.08;  // Slower attack for breath
        decayTime = 0.05;
        sustainLevel = 0.8;
        releaseTime = 0.15;
        break;

      case 'trumpet':
        // Trumpet - bright with strong harmonics
        sample = Math.sin(phase) * 0.35;                    // Fundamental
        sample += Math.sin(phase * 2) * 0.25;               // 2nd harmonic
        sample += Math.sin(phase * 3) * 0.2;                // 3rd harmonic
        sample += Math.sin(phase * 4) * 0.15;               // 4th harmonic
        sample += Math.sin(phase * 5) * 0.12;               // 5th harmonic
        sample += Math.sin(phase * 6) * 0.08;               // 6th harmonic
        sample += Math.sin(phase * 7) * 0.05;               // 7th harmonic
        // Add slight brass buzz
        sample += Math.sin(phase * 1.5) * 0.05;
        attackTime = 0.02;  // Quick but not instant
        decayTime = 0.08;
        sustainLevel = 0.7;
        releaseTime = 0.2;
        break;
    }

    // Apply ADSR envelope
    let envelope = 1.0;
    if (t < attackTime) {
      // Attack with curve
      const attackProgress = t / attackTime;
      envelope = attackProgress * attackProgress;
    } else if (t < attackTime + decayTime) {
      // Decay to sustain
      const decayProgress = (t - attackTime) / decayTime;
      envelope = 1.0 - (1.0 - sustainLevel) * decayProgress;
    } else if (t < duration - releaseTime) {
      // Sustain with slow natural decay
      const sustainTime = t - (attackTime + decayTime);
      envelope = sustainLevel * Math.exp(-sustainTime * 0.3);
    } else {
      // Release
      const releaseProgress = (t - (duration - releaseTime)) / releaseTime;
      const releaseEnvelope = sustainLevel * Math.exp(-(duration - releaseTime - attackTime - decayTime) * 0.3);
      envelope = releaseEnvelope * (1.0 - releaseProgress * releaseProgress);
    }

    // Apply brightness envelope for more natural sound
    if (instrument !== 'house') {
      const brightnessEnvelope = Math.exp(-t * 2.0);
      sample = sample * (1.0 - brightnessEnvelope * 0.2);
    }

    sample *= envelope;

    // Soft clipping to prevent harsh distortion
    sample = Math.tanh(sample * 0.9) * 0.5;  // Reduced gain to prevent distortion

    leftChannel[i] = sample;
    rightChannel[i] = sample;
  }

  await audioContext.close();
  return buffer;
}

// Convert AudioBuffer to WAV file Blob
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numberOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const bitsPerSample = 16;

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Write audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Generate and save synth sound for a piano key
export async function generateAndSaveSynthSound(
  noteName: string,
  instrument: InstrumentType = 'piano'
): Promise<string> {
  // Generate sound with specified instrument
  const buffer = await generateSynthSound(noteName, 3.0, instrument);
  const wavBlob = audioBufferToWav(buffer);

  // Create a temporary file path in the system temp directory
  const arrayBuffer = await wavBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Save via electron IPC
  const fileName = `${noteName}_${instrument}`;
  const filePath = await window.electronAPI.saveSynthSound(fileName, uint8Array);

  return filePath;
}
