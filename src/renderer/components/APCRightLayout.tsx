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
  // Each knob can have 2 sounds: one for CC value 1 (right turn) and one for CC value 127 (left turn)

  const getSoundsAtPosition = (row: number): { right?: Sound; left?: Sound } => {
    const knobSounds = sounds.filter(s =>
      s.slotPosition?.row === row &&
      s.slotPosition?.col === 0 &&
      s.tabId === tabId
    );

    const right = knobSounds.find(s => s.midiMapping?.ccValue === 1);
    const left = knobSounds.find(s => s.midiMapping?.ccValue === 127);

    return { right, left };
  };

  const renderKnob = (knobIndex: number) => {
    const slotKey = `knob-${knobIndex}`;
    const { right, left } = getSoundsAtPosition(knobIndex);
    const isHovered = hoveredSlot === slotKey;
    const hasAnySounds = right || left;

    return (
      <div
        key={slotKey}
        className={`
          relative w-40 h-40 border-2 transition-all cursor-pointer flex flex-col items-center justify-center p-2
          ${hasAnySounds ? 'border-purple-500 bg-purple-900 hover:bg-purple-800' : 'border-dark-400 bg-dark-900 hover:bg-dark-800'}
          ${isHovered ? 'ring-2 ring-purple-400' : ''}
          rounded-full
        `}
        onMouseEnter={() => setHoveredSlot(slotKey)}
        onMouseLeave={() => setHoveredSlot(null)}
        title={`Knob ${knobIndex + 1} - Click sides to assign sounds`}
      >
        {hasAnySounds ? (
          <>
            {/* Left side (turn left, CC 127) */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1/2 flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (left) {
                  onPlaySound(left.id);
                } else {
                  onAssignSound(knobIndex, 0, 'knobs');
                }
              }}
            >
              <div className="flex flex-col items-center w-full px-1">
                {left ? (
                  <>
                    <div className="text-[8px] text-blue-300 mb-1">←</div>
                    <div className="text-[9px] font-medium truncate max-w-full text-center">{left.name}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSound(left.id);
                      }}
                      className="mt-1 text-[8px] bg-red-600 hover:bg-red-500 px-1 rounded"
                      title="Remove left sound"
                    >
                      ✕
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartMidiMapping?.(left.id);
                      }}
                      className="mt-0.5 text-[8px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                      title="Assign MIDI CC"
                    >
                      🎛️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSound?.(left.id);
                      }}
                      className="mt-0.5 text-[8px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                      title="Edit"
                    >
                      ✎
                    </button>
                  </>
                ) : (
                  <div className="text-[8px] text-dark-400">+ Left</div>
                )}
              </div>
            </div>

            {/* Center divider */}
            <div className="absolute left-1/2 top-2 bottom-2 w-px bg-dark-600 -translate-x-1/2" />

            {/* Right side (turn right, CC 1) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1/2 flex items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (right) {
                  onPlaySound(right.id);
                } else {
                  onAssignSound(knobIndex, 0, 'knobs');
                }
              }}
            >
              <div className="flex flex-col items-center w-full px-1">
                {right ? (
                  <>
                    <div className="text-[8px] text-blue-300 mb-1">→</div>
                    <div className="text-[9px] font-medium truncate max-w-full text-center">{right.name}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSound(right.id);
                      }}
                      className="mt-1 text-[8px] bg-red-600 hover:bg-red-500 px-1 rounded"
                      title="Remove right sound"
                    >
                      ✕
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartMidiMapping?.(right.id);
                      }}
                      className="mt-0.5 text-[8px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                      title="Assign MIDI CC"
                    >
                      🎛️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSound?.(right.id);
                      }}
                      className="mt-0.5 text-[8px] bg-dark-600 hover:bg-dark-500 px-1 rounded"
                      title="Edit"
                    >
                      ✎
                    </button>
                  </>
                ) : (
                  <div className="text-[8px] text-dark-400">+ Right</div>
                )}
              </div>
            </div>

            {/* Knob label at top */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-dark-300 bg-dark-800 px-1 rounded">
              K{knobIndex + 1}
            </div>
          </>
        ) : (
          <>
            <div className="text-dark-500 text-2xl">🎛️</div>
            <div className="text-[9px] text-dark-400 mt-1">K{knobIndex + 1}</div>
            <div className="text-[8px] text-dark-500 mt-1">Click to assign</div>
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
          <div className="text-xs text-dark-400">Each knob can have 2 sounds: Left (CC value 127) and Right (CC value 1)</div>
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
