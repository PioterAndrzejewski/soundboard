import React, { useState } from 'react';
import { Sound } from '../../shared/types';

interface APCMiniLayoutProps {
  tabId: string;
  sounds: Sound[];
  onAssignSound: (row: number, col: number, section: 'grid' | 'bottom' | 'side') => void;
  onPlaySound: (soundId: string) => void;
  onRemoveSound: (soundId: string) => void;
  onEditSound?: (soundId: string) => void;
  onStartMidiMapping?: (soundId: string) => void;
}

const APCMiniLayout: React.FC<APCMiniLayoutProps> = ({
  tabId,
  sounds,
  onAssignSound,
  onPlaySound,
  onRemoveSound,
  onEditSound,
  onStartMidiMapping,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  // Find sound at specific position
  // We need to create unique identifiers for each section
  // Grid: row 0-7, col 0-7 (use actual row and col)
  // Bottom: row 100, col 0-7
  // Side: row 200-207, col 0
  // Square: row 300, col 0
  const getSoundAtPosition = (row: number, col: number, section: 'grid' | 'bottom' | 'side'): Sound | undefined => {
    if (section === 'grid') {
      // For grid, use actual row and col
      return sounds.find(s =>
        s.slotPosition?.row === row &&
        s.slotPosition?.col === col &&
        s.tabId === tabId
      );
    }

    // For bottom and side, use adjusted row and col 0
    let adjustedRow = row;
    if (section === 'bottom') {
      adjustedRow = 100 + col; // 100-107
    } else if (section === 'side') {
      adjustedRow = 200 + row; // 200-207 or 300 for square
    }

    return sounds.find(s =>
      s.slotPosition?.row === adjustedRow &&
      s.slotPosition?.col === 0 &&
      s.tabId === tabId
    );
  };

  const renderGridButton = (row: number, col: number) => {
    const slotKey = `grid-${row}-${col}`;
    const sound = getSoundAtPosition(row, col, 'grid');
    const isHovered = hoveredSlot === slotKey;

    return (
      <div
        key={slotKey}
        className={`
          relative w-full aspect-[2/1] border-2 transition-all cursor-pointer flex flex-col p-2
          ${sound ? 'border-blue-500 bg-blue-900 hover:bg-blue-800' : 'border-dark-500 bg-dark-700 hover:bg-dark-600'}
          ${isHovered ? 'ring-2 ring-blue-400' : ''}
        `}
        onMouseEnter={() => setHoveredSlot(slotKey)}
        onMouseLeave={() => setHoveredSlot(null)}
        onClick={() => {
          if (sound) {
            onPlaySound(sound.id);
          } else {
            onAssignSound(row, col, 'grid');
          }
        }}
        title={sound ? `${sound.name} (Click to play)` : 'Click to assign sound'}
      >
        {sound ? (
          <>
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

            {/* Name in top left */}
            <div className="absolute top-1 left-1 text-xs font-medium truncate pr-8 max-w-[80%]">
              {sound.name}
            </div>

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

            {/* MIDI indicator in bottom right */}
            {sound.midiMapping && (
              <div className="absolute bottom-1 right-1 text-[9px] text-green-300">
                🎹 {sound.midiMapping.note}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-dark-400 text-2xl">
            +
          </div>
        )}
      </div>
    );
  };

  const renderRoundButton = (row: number, col: number, section: 'bottom' | 'side') => {
    const slotKey = `${section}-${row}-${col}`;
    const sound = getSoundAtPosition(row, col, section);
    const isHovered = hoveredSlot === slotKey;

    return (
      <div
        key={slotKey}
        className={`
          relative w-full aspect-[2/1] border-2 rounded-lg transition-all cursor-pointer flex flex-col p-2
          ${sound ? 'border-green-500 bg-green-900 hover:bg-green-800' : 'border-dark-500 bg-dark-700 hover:bg-dark-600'}
          ${isHovered ? 'ring-2 ring-green-400' : ''}
        `}
        onMouseEnter={() => setHoveredSlot(slotKey)}
        onMouseLeave={() => setHoveredSlot(null)}
        onClick={() => {
          if (sound) {
            onPlaySound(sound.id);
          } else {
            onAssignSound(row, col, section);
          }
        }}
        title={sound ? `${sound.name} (Click to play)` : 'Click to assign sound'}
      >
        {sound ? (
          <>
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

            {/* Name in top left */}
            <div className="absolute top-1 left-1 text-xs font-medium truncate pr-8 max-w-[80%]">
              {sound.name}
            </div>

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

            {/* MIDI indicator in bottom right */}
            {sound.midiMapping && (
              <div className="absolute bottom-1 right-1 text-[9px] text-green-300">
                🎹 {sound.midiMapping.note}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-dark-400 text-2xl">+</div>
        )}
      </div>
    );
  };

  const renderSquareButton = (row: number, col: number) => {
    const slotKey = `side-${row}-${col}`;
    const sound = getSoundAtPosition(row, col, 'side');
    const isHovered = hoveredSlot === slotKey;

    return (
      <div
        key={slotKey}
        className={`
          relative w-full aspect-[2/1] border-2 transition-all cursor-pointer flex flex-col p-2
          ${sound ? 'border-red-500 bg-red-900 hover:bg-red-800' : 'border-dark-500 bg-dark-700 hover:bg-dark-600'}
          ${isHovered ? 'ring-2 ring-red-400' : ''}
        `}
        onMouseEnter={() => setHoveredSlot(slotKey)}
        onMouseLeave={() => setHoveredSlot(null)}
        onClick={() => {
          if (sound) {
            onPlaySound(sound.id);
          } else {
            onAssignSound(row, col, 'side');
          }
        }}
        title={sound ? `${sound.name} (Click to play)` : 'Click to assign sound'}
      >
        {sound ? (
          <>
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

            {/* Name in top left */}
            <div className="absolute top-1 left-1 text-xs font-medium truncate pr-8 max-w-[80%]">
              {sound.name}
            </div>

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

            {/* MIDI indicator in bottom right */}
            {sound.midiMapping && (
              <div className="absolute bottom-1 right-1 text-[9px] text-green-300">
                🎹 {sound.midiMapping.note}
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-dark-400 text-2xl">+</div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 h-full flex items-start justify-center overflow-auto">
      <div className="flex flex-col gap-4">
        {/* Top section: 8x8 grid + side column */}
        <div className="flex gap-4">
          {/* Main 8x8 Grid */}
          <div className="grid grid-cols-8 gap-2" style={{ width: '960px' }}>
            {[...Array(8)].map((_, row) =>
              [...Array(8)].map((_, col) => renderGridButton(row, col))
            )}
          </div>

          {/* Right side column: 8 rounded buttons */}
          <div className="flex flex-col gap-2" style={{ width: '120px' }}>
            {[...Array(8)].map((_, row) => renderRoundButton(row, 0, 'side'))}
          </div>
        </div>

        {/* Bottom section: 8 rounded buttons + square button */}
        <div className="flex gap-4">
          {/* Bottom 8 rounded buttons */}
          <div className="grid grid-cols-8 gap-2" style={{ width: '960px' }}>
            {[...Array(8)].map((_, col) => renderRoundButton(0, col, 'bottom'))}
          </div>

          {/* Bottom-right square button */}
          <div style={{ width: '60px' }}>
            {renderSquareButton(8, 0)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default APCMiniLayout;
