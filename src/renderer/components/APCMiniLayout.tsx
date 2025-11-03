import React, { useState } from 'react';
import { Sound } from '../../shared/types';

interface APCMiniLayoutProps {
  tabId: string;
  sounds: Sound[];
  onAssignSound: (row: number, col: number, section: 'grid' | 'bottom' | 'side') => void;
  onPlaySound: (soundId: string) => void;
  onRemoveSound: (soundId: string) => void;
}

const APCMiniLayout: React.FC<APCMiniLayoutProps> = ({
  tabId,
  sounds,
  onAssignSound,
  onPlaySound,
  onRemoveSound,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  // Find sound at specific position
  const getSoundAtPosition = (row: number, col: number, section: 'grid' | 'bottom' | 'side'): Sound | undefined => {
    return sounds.find(s =>
      s.slotPosition?.row === row &&
      s.slotPosition?.col === col &&
      s.tabId === tabId
    );
  };

  const renderSlot = (
    row: number,
    col: number,
    section: 'grid' | 'bottom' | 'side',
    isRounded: boolean = false,
    isSquare: boolean = false
  ) => {
    const slotKey = `${section}-${row}-${col}`;
    const sound = getSoundAtPosition(row, col, section);
    const isHovered = hoveredSlot === slotKey;

    const baseClasses = `
      relative border-2 transition-all cursor-pointer
      ${isRounded ? 'rounded-full' : isSquare ? '' : 'rounded'}
      ${sound ? 'border-blue-500 bg-blue-900 hover:bg-blue-800' : 'border-dark-500 bg-dark-700 hover:bg-dark-600'}
      ${isHovered ? 'ring-2 ring-blue-400' : ''}
    `;

    return (
      <div
        key={slotKey}
        className={baseClasses}
        onMouseEnter={() => setHoveredSlot(slotKey)}
        onMouseLeave={() => setHoveredSlot(null)}
        onClick={() => {
          if (sound) {
            onPlaySound(sound.id);
          } else {
            onAssignSound(row, col, section);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (sound) {
            onRemoveSound(sound.id);
          }
        }}
        title={sound ? `${sound.name} (Right-click to remove)` : 'Click to assign sound'}
      >
        {sound && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium text-center px-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {sound.name}
            </span>
          </div>
        )}
        {!sound && (
          <div className="absolute inset-0 flex items-center justify-center text-dark-400 text-xs">
            +
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 h-full flex items-center justify-center">
      <div className="flex flex-col gap-3">
        {/* Main 8x8 Grid */}
        <div className="grid grid-cols-8 gap-2">
          {[...Array(8)].map((_, row) =>
            [...Array(8)].map((_, col) => (
              <div key={`${row}-${col}`} className="w-16 h-8">
                {renderSlot(row, col, 'grid')}
              </div>
            ))
          )}
        </div>

        {/* Bottom row and side column container */}
        <div className="flex gap-2">
          {/* Bottom 8 rounded buttons */}
          <div className="grid grid-cols-8 gap-2 flex-1">
            {[...Array(8)].map((_, col) => (
              <div key={`bottom-${col}`} className="w-16 h-16">
                {renderSlot(0, col, 'bottom', true)}
              </div>
            ))}
          </div>

          {/* Right side column: 8 rounded + 1 square */}
          <div className="flex flex-col gap-2">
            {[...Array(8)].map((_, row) => (
              <div key={`side-${row}`} className="w-16 h-16">
                {renderSlot(row, 0, 'side', true)}
              </div>
            ))}
            <div className="w-16 h-16">
              {renderSlot(8, 0, 'side', false, true)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APCMiniLayout;
