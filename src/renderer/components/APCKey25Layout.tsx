import React, { useState, useEffect } from 'react';
import { Sound } from '../../shared/types';
import { InstrumentType } from '../synthGenerator';

interface APCKey25LayoutProps {
  tabId: string;
  sounds: Sound[];
  onAssignSound: (row: number, col: number, section: 'piano') => void;
  onPlaySound: (soundId: string) => void;
  onRemoveSound: (soundId: string) => void;
  onEditSound?: (soundId: string) => void;
  onStartMidiMapping?: (soundId: string) => void;
  onRegenerateWithInstrument?: (instrument: InstrumentType) => void;
}

const APCKey25Layout: React.FC<APCKey25LayoutProps> = ({
  tabId,
  sounds,
  onAssignSound,
  onPlaySound,
  onRemoveSound,
  onEditSound,
  onStartMidiMapping,
  onRegenerateWithInstrument,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>('piano');

  // Check for MIDI mapping on first key (C1) and offer auto-population
  useEffect(() => {
    const firstKeySound = sounds.find(s => s.slotPosition?.row === 0 && s.tabId === tabId);

    if (firstKeySound?.midiMapping && firstKeySound.midiMapping.note === 48) {
      // Check if other keys are not yet populated
      const populatedKeys = sounds.filter(s => s.tabId === tabId && s.midiMapping).length;

      if (populatedKeys === 1) {
        const shouldPopulate = window.confirm(
          'First key (C1) is mapped to MIDI note 48. Would you like to auto-populate the remaining 24 keys with MIDI notes 49-72?'
        );

        if (shouldPopulate && onStartMidiMapping) {
          // Trigger auto-population for remaining keys
          // This will be handled by the parent component
          (window as any).__autoPopulatePianoKeys = true;
        }
      }
    }
  }, [sounds, tabId]);

  const handleInstrumentChange = (instrument: InstrumentType) => {
    setSelectedInstrument(instrument);
    if (onRegenerateWithInstrument) {
      const shouldRegenerate = window.confirm(
        `Change instrument to ${instrument.toUpperCase()}? This will regenerate all sounds in this tab.`
      );
      if (shouldRegenerate) {
        onRegenerateWithInstrument(instrument);
      }
    }
  };

  // Piano keys pattern: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
  // White keys: C, D, E, F, G, A, B (7 per octave, plus C at the start = 7*3 + 1 = 22 white keys for 3 octaves C1-C3)
  // Black keys: C#, D#, F#, G#, A# (5 per octave = 15 black keys)

  // Position mapping for piano keys:
  // Row 0-14: Black keys (C#, D#, F#, G#, A# for each octave, left to right)
  // Row 15-36: White keys (C, D, E, F, G, A, B for each octave, left to right)

  const getSoundAtPosition = (keyIndex: number): Sound | undefined => {
    return sounds.find(s =>
      s.slotPosition?.row === keyIndex &&
      s.slotPosition?.col === 0 &&
      s.tabId === tabId
    );
  };

  // Define the piano key pattern for 25 keys (C1 to C3)
  // Total: 3 octaves = 15 white keys (C1-B1, C2-B2, C3) + 10 black keys
  const pianoKeys: Array<{ note: string; isBlack: boolean; keyIndex: number }> = [];
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let keyIndex = 0;
  // Generate keys from C1 to C3 (25 keys total)
  for (let octave = 1; octave <= 3; octave++) {
    for (let noteIdx = 0; noteIdx < notes.length; noteIdx++) {
      const note = notes[noteIdx];
      const noteName = `${note}${octave}`;
      const isBlack = note.includes('#');

      pianoKeys.push({
        note: noteName,
        isBlack,
        keyIndex: keyIndex++,
      });

      // Stop at C3 (25th key)
      if (noteName === 'C3') break;
    }
    if (pianoKeys.length >= 25) break;
  }

  const renderPianoKey = (key: { note: string; isBlack: boolean; keyIndex: number }) => {
    const slotKey = `piano-${key.keyIndex}`;
    const sound = getSoundAtPosition(key.keyIndex);
    const isHovered = hoveredSlot === slotKey;

    if (key.isBlack) {
      // Black key
      return (
        <div
          key={slotKey}
          className={`
            relative w-full h-32 border-2 transition-all cursor-pointer flex flex-col p-2
            ${sound ? 'border-purple-500 bg-purple-900 hover:bg-purple-800' : 'border-dark-400 bg-dark-900 hover:bg-dark-800'}
            ${isHovered ? 'ring-2 ring-purple-400' : ''}
          `}
          onMouseEnter={() => setHoveredSlot(slotKey)}
          onMouseLeave={() => setHoveredSlot(null)}
          onClick={() => {
            if (sound) {
              onPlaySound(sound.id);
            } else {
              onAssignSound(key.keyIndex, 0, 'piano');
            }
          }}
          title={sound ? `${sound.name} (${key.note}) - Click to play` : `${key.note} - Click to assign sound`}
        >
          {sound ? (
            <>
              {/* Name in top left */}
              <div className="absolute top-1 left-1 text-[10px] font-medium truncate pr-6 max-w-[80%]">
                {sound.name}
              </div>

              {/* Delete button in top right corner */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSound(sound.id);
                }}
                className="absolute top-1 right-1 text-[8px] bg-red-600 hover:bg-red-500 px-1 rounded"
                title="Remove"
              >
                ✕
              </button>

              {/* Bottom left buttons */}
              <div className="absolute bottom-1 left-1 flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartMidiMapping?.(sound.id);
                  }}
                  className="text-[8px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                  title="Assign MIDI"
                >
                  🎹
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSound?.(sound.id);
                  }}
                  className="text-[8px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                  title="Edit"
                >
                  ✎
                </button>
              </div>

              {/* Note name at bottom center */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-dark-300">
                {key.note}
              </div>

              {/* MIDI indicator in bottom right */}
              {sound.midiMapping && (
                <div className="absolute bottom-1 right-1 text-[8px] text-green-300">
                  🎹
                </div>
              )}
            </>
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center text-dark-500 text-lg">
                +
              </div>
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-dark-400">
                {key.note}
              </div>
            </>
          )}
        </div>
      );
    } else {
      // White key
      return (
        <div
          key={slotKey}
          className={`
            relative w-full h-48 border-2 transition-all cursor-pointer flex flex-col p-2
            ${sound ? 'border-blue-500 bg-blue-900 hover:bg-blue-800' : 'border-dark-500 bg-dark-700 hover:bg-dark-600'}
            ${isHovered ? 'ring-2 ring-blue-400' : ''}
          `}
          onMouseEnter={() => setHoveredSlot(slotKey)}
          onMouseLeave={() => setHoveredSlot(null)}
          onClick={() => {
            if (sound) {
              onPlaySound(sound.id);
            } else {
              onAssignSound(key.keyIndex, 0, 'piano');
            }
          }}
          title={sound ? `${sound.name} (${key.note}) - Click to play` : `${key.note} - Click to assign sound`}
        >
          {sound ? (
            <>
              {/* Name in top left */}
              <div className="absolute top-1 left-1 text-xs font-medium truncate pr-6 max-w-[80%]">
                {sound.name}
              </div>

              {/* Delete button in top right corner */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSound(sound.id);
                }}
                className="absolute top-1 right-1 text-[10px] bg-red-600 hover:bg-red-500 px-1 rounded"
                title="Remove"
              >
                ✕
              </button>

              {/* Bottom left buttons */}
              <div className="absolute bottom-1 left-1 flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartMidiMapping?.(sound.id);
                  }}
                  className="text-[10px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                  title="Assign MIDI"
                >
                  🎹
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSound?.(sound.id);
                  }}
                  className="text-[10px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                  title="Edit"
                >
                  ✎
                </button>
              </div>

              {/* Note name at bottom center */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-dark-300">
                {key.note}
              </div>

              {/* MIDI indicator in bottom right */}
              {sound.midiMapping && (
                <div className="absolute bottom-1 right-1 text-[9px] text-green-300">
                  🎹 {sound.midiMapping.note}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center text-dark-400 text-2xl">
                +
              </div>
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-dark-400">
                {key.note}
              </div>
            </>
          )}
        </div>
      );
    }
  };

  // Get white and black keys separately for layout
  const whiteKeys = pianoKeys.filter(k => !k.isBlack);
  const blackKeys = pianoKeys.filter(k => k.isBlack);

  return (
    <div className="p-4 h-full flex flex-col items-center justify-center overflow-auto">
      {/* Instrument Selector */}
      <div className="mb-4 flex items-center gap-3 bg-dark-700 p-3 rounded-lg border border-dark-500">
        <label className="text-sm font-medium text-dark-200">Instrument:</label>
        <div className="flex gap-2">
          {(['piano', 'house', 'flute', 'trumpet'] as InstrumentType[]).map((instrument) => (
            <button
              key={instrument}
              onClick={() => handleInstrumentChange(instrument)}
              className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                selectedInstrument === instrument
                  ? 'bg-blue-600 text-white'
                  : 'bg-dark-600 text-dark-200 hover:bg-dark-500'
              }`}
            >
              {instrument.charAt(0).toUpperCase() + instrument.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative" style={{ width: '1200px' }}>
        {/* White keys row */}
        <div className="flex gap-0.5">
          {whiteKeys.map((key) => (
            <div key={`white-${key.keyIndex}`} className="flex-1">
              {renderPianoKey(key)}
            </div>
          ))}
        </div>

        {/* Black keys positioned absolutely over white keys */}
        <div className="absolute top-0 left-0 right-0 flex pointer-events-none" style={{ height: '128px' }}>
          {whiteKeys.map((whiteKey, idx) => {
            // Find if there's a black key after this white key
            const blackKeyAfter = blackKeys.find(bk => {
              const whiteNote = whiteKey.note.replace(/\d/, '');
              const blackNote = bk.note.replace(/\d/, '').replace('#', '');
              // Check if black key comes right after this white key
              return bk.keyIndex === whiteKey.keyIndex + 1;
            });

            return (
              <div key={`slot-${idx}`} className="flex-1 relative">
                {blackKeyAfter && (
                  <div
                    className="absolute pointer-events-auto"
                    style={{
                      right: '-25%',
                      width: '50%',
                      zIndex: 10,
                    }}
                  >
                    {renderPianoKey(blackKeyAfter)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default APCKey25Layout;
