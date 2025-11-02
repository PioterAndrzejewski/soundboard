import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateSound } from '../store/soundsSlice';
import { closeSettingsModal, startMidiListening, stopMidiListening, setDirty } from '../store/uiSlice';
import { Sound, MidiMessage } from '../../shared/types';
import { SoundManager } from '../soundManager';
import { MidiHandler } from '../midiHandler';

interface SoundSettingsModalProps {
  soundManager: SoundManager | null;
  midiHandler: MidiHandler | null;
}

const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({ soundManager, midiHandler }) => {
  const dispatch = useAppDispatch();
  const sounds = useAppSelector(state => state.sounds.sounds);
  const ui = useAppSelector(state => state.ui);

  const sound = sounds.find(s => s.id === ui.selectedSoundId);
  const [editedSound, setEditedSound] = useState<Sound | null>(null);

  useEffect(() => {
    if (sound && ui.isSettingsModalOpen) {
      setEditedSound({ ...sound });
    }
  }, [sound, ui.isSettingsModalOpen]);

  useEffect(() => {
    if (!midiHandler || !editedSound || !ui.isMidiListening || ui.listeningMode !== 'sound') return;

    const handleMidiMessage = (message: MidiMessage) => {
      if (message.type === 'noteon') {
        setEditedSound(prev => prev ? {
          ...prev,
          midiMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            note: message.note!,
            channel: message.channel,
          },
        } : null);
        dispatch(stopMidiListening());
      }
    };

    midiHandler.addListener(handleMidiMessage);
    return () => {
      midiHandler.removeListener(handleMidiMessage);
    };
  }, [midiHandler, editedSound, ui.isMidiListening, ui.listeningMode, dispatch]);

  if (!ui.isSettingsModalOpen || !editedSound) return null;

  const handleSave = () => {
    if (soundManager && editedSound) {
      soundManager.updateSound(editedSound.id, editedSound);
      dispatch(updateSound({ id: editedSound.id, updates: editedSound }));
      dispatch(setDirty(true));
      dispatch(closeSettingsModal());
    }
  };

  const handleClose = () => {
    dispatch(closeSettingsModal());
    dispatch(stopMidiListening());
  };

  const handleClearMapping = () => {
    setEditedSound(prev => prev ? { ...prev, midiMapping: undefined } : null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-dark-600 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b-2 border-dark-500 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Sound Settings</h3>
          <button onClick={handleClose} className="text-2xl hover:text-red-500 transition-colors">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={editedSound.name}
              onChange={(e) => setEditedSound({ ...editedSound, name: e.target.value })}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-500 rounded focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Play Mode</label>
            <select
              value={editedSound.settings.playMode}
              onChange={(e) => setEditedSound({
                ...editedSound,
                settings: { ...editedSound.settings, playMode: e.target.value as 'trigger' | 'gate' },
              })}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-500 rounded focus:border-blue-500 focus:outline-none"
            >
              <option value="trigger">Trigger (one-shot)</option>
              <option value="gate">Gate (hold to play)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Volume: {Math.round(editedSound.settings.volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(editedSound.settings.volume * 100)}
              onChange={(e) => setEditedSound({
                ...editedSound,
                settings: { ...editedSound.settings, volume: parseInt(e.target.value) / 100 },
              })}
              className="w-full h-2 bg-dark-500 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Fade In (ms)</label>
              <input
                type="number"
                min="0"
                max="5000"
                value={editedSound.settings.fadeInMs}
                onChange={(e) => setEditedSound({
                  ...editedSound,
                  settings: { ...editedSound.settings, fadeInMs: parseInt(e.target.value) || 0 },
                })}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-500 rounded focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fade Out (ms)</label>
              <input
                type="number"
                min="0"
                max="5000"
                value={editedSound.settings.fadeOutMs}
                onChange={(e) => setEditedSound({
                  ...editedSound,
                  settings: { ...editedSound.settings, fadeOutMs: parseInt(e.target.value) || 0 },
                })}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-500 rounded focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">MIDI Mapping</label>
            {editedSound.midiMapping ? (
              <div className="p-3 bg-dark-800 rounded mb-2">
                <div className="text-sm mb-1"><strong>Device:</strong> {editedSound.midiMapping.deviceName}</div>
                <div className="text-sm mb-1"><strong>Channel:</strong> {editedSound.midiMapping.channel + 1}</div>
                <div className="text-sm"><strong>Note:</strong> {editedSound.midiMapping.note}</div>
              </div>
            ) : (
              <div className="p-3 bg-dark-800 rounded mb-2 text-sm text-dark-300 italic">
                No mapping assigned
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => dispatch(startMidiListening('sound'))}
                disabled={ui.isMidiListening}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-dark-600 disabled:cursor-not-allowed rounded transition-colors"
              >
                {ui.isMidiListening && ui.listeningMode === 'sound' ? 'Listening...' : 'Assign MIDI Key'}
              </button>
              <button
                onClick={handleClearMapping}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t-2 border-dark-500 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-dark-500 hover:bg-dark-400 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SoundSettingsModal;
