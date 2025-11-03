import React, { useState } from 'react';
import { Sound } from '../../shared/types';

interface APCRightLayoutProps {
  tabId: string;
  sounds: Sound[];
  onAssignSound: (row: number, col: number, section: 'knobs') => void;
  onPlaySound: (soundId: string) => void;
  onRemoveSound: (soundId: string) => void;
  onEditSound?: (soundId: string) => void;
  onStartMidiMapping?: (soundId: string) => void;
}

const APCRightLayout: React.FC<APCRightLayoutProps> = ({
  tabId,
  sounds,
  onAssignSound,
  onPlaySound,
  onRemoveSound,
  onEditSound,
  onStartMidiMapping,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  // Position mapping:
  // Knobs: row 0-7 (8 knobs total, arranged in 2 rows of 4)
  // These knobs use CC-based MIDI mappings (not note-based)

  const getSoundAtPosition = (row: number, col: number, section: 'knobs'): Sound | undefined => {
    return sounds.find(s =>
      s.slotPosition?.row === row &&
      s.slotPosition?.col === col &&
      s.tabId === tabId
    );
  };

  const renderKnob = (knobIndex: number) => {
    const slotKey = `knob-${knobIndex}`;
    const sound = getSoundAtPosition(knobIndex, 0, 'knobs');
    const isHovered = hoveredSlot === slotKey;

    return (
      <div
        key={slotKey}
        className={`
          relative w-32 h-32 border-2 transition-all cursor-pointer flex flex-col items-center justify-center p-2
          ${sound ? 'border-purple-500 bg-purple-900 hover:bg-purple-800' : 'border-dark-400 bg-dark-900 hover:bg-dark-800'}
          ${isHovered ? 'ring-2 ring-purple-400' : ''}
          rounded-full
        `}
        onMouseEnter={() => setHoveredSlot(slotKey)}
        onMouseLeave={() => setHoveredSlot(null)}
        onClick={() => {
          if (sound) {
            onPlaySound(sound.id);
          } else {
            onAssignSound(knobIndex, 0, 'knobs');
          }
        }}
        title={sound ? `${sound.name} (Knob ${knobIndex + 1}) - Click to play` : `Knob ${knobIndex + 1} - Click to assign sound`}
      >
        {sound ? (
          <>
            {/* Name in center */}
            <div className="absolute inset-0 flex items-center justify-center text-center px-2">
              <div className="text-[10px] font-medium truncate max-w-full">
                {sound.name}
              </div>
            </div>

            {/* Delete button in top right corner */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveSound(sound.id);
              }}
              className="absolute top-1 right-1 text-[8px] bg-red-600 hover:bg-red-500 px-1 rounded z-10"
              title="Remove"
            >
              ✕
            </button>

            {/* Bottom buttons */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartMidiMapping?.(sound.id);
                }}
                className="text-[8px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                title="Assign MIDI CC"
              >
                🎛️
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

            {/* MIDI indicator */}
            {sound.midiMapping && sound.midiMapping.ccNumber !== undefined && (
              <div className="absolute top-1 left-1 text-[8px] text-green-300" title={`CC ${sound.midiMapping.ccNumber}`}>
                🎛️
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-dark-500 text-2xl">🎛️</div>
            <div className="text-[9px] text-dark-400 mt-1">K{knobIndex + 1}</div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 h-full flex flex-col items-center justify-center overflow-auto">
      <div className="flex flex-col gap-4">
        {/* Info text */}
        <div className="text-center text-sm text-dark-300 mb-2">
          <div className="font-semibold">AKAI APC RIGHT Layout</div>
          <div className="text-xs">8 Knobs with CC MIDI Control</div>
          <div className="text-xs text-dark-400">Turn right (CC=1) plays forward, turn left (CC=127) plays backward</div>
        </div>

        {/* Knobs section - 2 rows of 4 knobs */}
        <div className="flex flex-col gap-3">
          {/* First row of knobs */}
          <div className="flex gap-3 justify-center">
            {[0, 1, 2, 3].map((i) => renderKnob(i))}
          </div>

          {/* Second row of knobs */}
          <div className="flex gap-3 justify-center">
            {[4, 5, 6, 7].map((i) => renderKnob(i))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default APCRightLayout;
