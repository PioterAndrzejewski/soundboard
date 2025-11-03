import React, { useState } from 'react';
import { Sound, Tab } from '../../shared/types';

interface APCKeyLayoutProps {
  tabId: string;
  tab: Tab;
  sounds: Sound[];
  onAssignSound: (row: number, col: number, section: 'grid' | 'right' | 'bottom') => void;
  onPlaySound: (soundId: string) => void;
  onRemoveSound: (soundId: string) => void;
  onEditSound?: (soundId: string) => void;
  onStartMidiMapping?: (soundId: string) => void;
  onUpdateRowLabel?: (rowIndex: number, label: string) => void;
}

const APCKeyLayout: React.FC<APCKeyLayoutProps> = ({
  tabId,
  tab,
  sounds,
  onAssignSound,
  onPlaySound,
  onRemoveSound,
  onEditSound,
  onStartMidiMapping,
  onUpdateRowLabel,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);

  // Position mapping for APC KEY layout:
  // Grid: row 0-4, col 0-7 (use actual row and col)
  // Right: row 400-404, col 0
  // Bottom: row 500-508, col 0

  const getSoundAtPosition = (row: number, col: number, section: 'grid' | 'right' | 'bottom'): Sound | undefined => {
    if (section === 'grid') {
      // For grid, use actual row and col
      return sounds.find(s =>
        s.slotPosition?.row === row &&
        s.slotPosition?.col === col &&
        s.tabId === tabId
      );
    }

    // For right and bottom, use adjusted row and col 0
    let adjustedRow = row;
    if (section === 'right') {
      adjustedRow = 400 + row; // 400-404
    } else if (section === 'bottom') {
      adjustedRow = 500 + col; // 500-508
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
          relative w-full aspect-[2.5/1] border-2 transition-all cursor-pointer flex flex-col p-2
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
            {/* Name in top left */}
            <div className="absolute top-1 left-1 text-xs font-medium truncate pr-8 max-w-[80%]">
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

  const renderSquareButton = (row: number, col: number, section: 'right' | 'bottom') => {
    const slotKey = `${section}-${row}-${col}`;
    const sound = getSoundAtPosition(row, col, section);
    const isHovered = hoveredSlot === slotKey;

    return (
      <div
        key={slotKey}
        className={`
          relative w-full aspect-[2.5/1] border-2 transition-all cursor-pointer flex flex-col p-2
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
            {/* Name in top left */}
            <div className="absolute top-1 left-1 text-xs font-medium truncate pr-8 max-w-[80%]">
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
    <div className="p-1 h-full flex items-start justify-center overflow-auto">
      <div className="flex flex-col gap-1">
        {/* Top section: row labels + 8x5 grid + right column (5 buttons) */}
        <div className="flex gap-1">
          {/* Row labels */}
          <div className="flex flex-col gap-[1px]" style={{ width: '80px' }}>
            {[...Array(5)].map((_, row) => {
              const label = tab.rowLabels?.[row] || '';
              const isEditing = editingRow === row;

              return (
                <div
                  key={`label-${row}`}
                  className="flex items-center justify-end pr-2 text-xs text-gray-400"
                  style={{ height: '118px' }}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => onUpdateRowLabel?.(row, e.target.value)}
                      onBlur={() => setEditingRow(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingRow(null);
                      }}
                      autoFocus
                      className="w-full px-1 py-0.5 bg-dark-700 border border-dark-500 rounded text-right focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div
                      onClick={() => setEditingRow(row)}
                      className="w-full cursor-pointer hover:bg-dark-700 px-1 py-0.5 rounded text-right"
                      title="Click to edit label"
                    >
                      {label || `Row ${row + 1}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main 8x5 Grid */}
          <div className="grid grid-cols-8 gap-[1px]" style={{ width: '960px' }}>
            {[...Array(5)].map((_, row) =>
              [...Array(8)].map((_, col) => renderGridButton(row, col))
            )}
          </div>

          {/* Right side column: 5 square buttons */}
          <div className="flex flex-col gap-0.5" style={{ width: '120px' }}>
            {[...Array(5)].map((_, row) => renderSquareButton(row, 0, 'right'))}
          </div>
        </div>

        {/* Bottom section: 9 square buttons */}
        <div className="flex gap-1">
          <div className="grid grid-cols-9 gap-[1px]" style={{ width: '1080px' }}>
            {[...Array(9)].map((_, col) => renderSquareButton(0, col, 'bottom'))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default APCKeyLayout;
