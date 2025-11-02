import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../store/hooks';

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
  const projectName = projectPath ? projectPath.split(/[\\/]/).pop() : 'Untitled';
  const [stopAllFlash, setStopAllFlash] = useState(false);
  const ui = useAppSelector(state => state.ui);

  // Watch for Stop All trigger (from button or MIDI)
  useEffect(() => {
    if (ui.lastStopAllTrigger > 0) {
      setStopAllFlash(true);
      const timer = setTimeout(() => setStopAllFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [ui.lastStopAllTrigger]);

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
          onClick={onStopAll}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
            stopAllFlash
              ? 'bg-red-400 ring-2 ring-red-300 scale-105'
              : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          Stop All
        </button>
      </div>
    </header>
  );
};

export default Header;
