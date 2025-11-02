import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { startMappingTarget, clearMappingTarget, toggleActiveSoundsPanel } from '../store/uiSlice';

interface HeaderProps {
  projectPath: string | null;
  isDirty: boolean;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
  onAddSound: () => void;
  onStopAll: () => void;
}

const Header: React.FC<HeaderProps> = ({
  projectPath,
  isDirty,
  onNew,
  onSave,
  onSaveAs,
  onLoad,
  onAddSound,
  onStopAll,
}) => {
  const dispatch = useAppDispatch();
  const projectName = projectPath ? projectPath.split(/[\\/]/).pop() : 'Untitled';
  const [stopAllFlash, setStopAllFlash] = useState(false);
  const ui = useAppSelector(state => state.ui);
  const settings = useAppSelector(state => state.settings);

  // Watch for Stop All trigger (from button or MIDI)
  useEffect(() => {
    if (ui.lastStopAllTrigger > 0) {
      setStopAllFlash(true);
      const timer = setTimeout(() => setStopAllFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [ui.lastStopAllTrigger]);

  const isMappingStopAll = ui.isMidiMappingMode && ui.mappingTarget === 'stopall';
  const stopAllHasMappingTitle = settings.stopAllMapping
    ? `Mapped to: ${settings.stopAllMapping.deviceName} Note${settings.stopAllMapping.note} Ch${settings.stopAllMapping.channel + 1}`
    : 'Not mapped';

  const handleStopAllClick = () => {
    if (ui.isMidiMappingMode && !ui.mappingTarget) {
      dispatch(startMappingTarget('stopall'));
    } else if (!ui.isMidiMappingMode) {
      onStopAll();
    }
  };

  return (
    <header className="bg-dark-600 border-b-2 border-dark-500 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">MIDI Soundboard</h1>
        <span className="text-dark-200 text-sm">
          {projectName}{isDirty && ' *'}
        </span>
      </div>

      <div className="flex gap-2">
        <button onClick={onNew} className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors">
          New
        </button>
        <button onClick={onLoad} className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors">
          Open
        </button>
        <button onClick={onSave} className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors">
          Save
        </button>
        <button onClick={onSaveAs} className="px-3 py-1.5 bg-dark-500 hover:bg-dark-400 rounded text-sm transition-colors">
          Save As
        </button>
        <div className="w-px bg-dark-500 mx-2"></div>
        <button onClick={onAddSound} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors">
          Add Sound
        </button>
        <button
          onClick={() => dispatch(toggleActiveSoundsPanel())}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            ui.isActiveSoundsPanelOpen
              ? 'bg-purple-600 hover:bg-purple-500'
              : 'bg-dark-500 hover:bg-dark-400'
          }`}
          title={ui.isActiveSoundsPanelOpen ? 'Hide Active Sounds' : 'Show Active Sounds'}
        >
          {ui.isActiveSoundsPanelOpen ? '🎵 Active' : '🎵'}
        </button>
        <div
          className={`relative rounded transition-all ${
            ui.isMidiMappingMode ? 'ring-2 ring-purple-500 hover:ring-purple-400 cursor-pointer' : ''
          } ${
            isMappingStopAll ? 'ring-2 ring-green-500 animate-pulse' : ''
          }`}
          onClick={handleStopAllClick}
          title={ui.isMidiMappingMode ? 'Click to map MIDI key' : stopAllHasMappingTitle}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                if (!ui.isMidiMappingMode) {
                  e.stopPropagation();
                  onStopAll();
                }
              }}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
                stopAllFlash
                  ? 'bg-red-400 ring-2 ring-red-300 scale-105'
                  : 'bg-red-600 hover:bg-red-500'
              } ${ui.isMidiMappingMode ? 'cursor-pointer' : ''}`}
            >
              Stop All
            </button>
            <span className={`text-sm ${settings.stopAllMapping ? 'text-green-400' : 'text-gray-500'}`}>
              🎹
            </span>
          </div>
          {isMappingStopAll && (
            <div className="absolute top-full mt-1 left-0 right-0 p-2 bg-green-900 border border-green-500 rounded text-xs text-green-300 animate-pulse whitespace-nowrap z-50">
              ⏳ Listening for MIDI key...
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
