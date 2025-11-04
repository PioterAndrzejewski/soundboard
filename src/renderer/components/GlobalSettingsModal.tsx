import React, { useState } from 'react';

interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTabId: string | null;
  onSetAllSoundsVolume: (volume: number) => void;
}

const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  isOpen,
  onClose,
  currentTabId,
  onSetAllSoundsVolume,
}) => {
  const [volumePercent, setVolumePercent] = useState(100);

  if (!isOpen) return null;

  const handleApply = () => {
    const volumeValue = volumePercent / 100;
    onSetAllSoundsVolume(volumeValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-600 border-2 border-dark-500 rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-dark-500 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Global Settings</h2>
          <button
            onClick={onClose}
            className="text-dark-300 hover:text-dark-100 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!currentTabId ? (
            <div className="text-center text-dark-300 py-8">
              No tab selected
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Set All Sounds Volume (Current Tab Only)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volumePercent}
                    onChange={(e) => setVolumePercent(Number(e.target.value))}
                    className="flex-1 h-2 bg-dark-500 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="w-16 text-right font-mono text-sm">
                    {volumePercent}%
                  </div>
                </div>
                <p className="text-xs text-dark-300 mt-2">
                  This will update the volume of all sounds in the current tab
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-500 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-500 hover:bg-dark-400 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!currentTabId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-dark-500 disabled:cursor-not-allowed rounded transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettingsModal;
