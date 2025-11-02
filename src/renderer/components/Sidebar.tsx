import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMasterVolume } from '../store/settingsSlice';
import { startMidiListening, stopMidiListening, setDirty } from '../store/uiSlice';
import { MidiHandler } from '../midiHandler';
import { SoundManager } from '../soundManager';
import { MidiMessage } from '../../shared/types';

interface SidebarProps {
  midiHandler: MidiHandler | null;
  soundManager: SoundManager | null;
}

const Sidebar: React.FC<SidebarProps> = ({ midiHandler, soundManager }) => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(state => state.settings);
  const ui = useAppSelector(state => state.ui);
  const [midiDevices, setMidiDevices] = useState<any[]>([]);

  useEffect(() => {
    if (midiHandler) {
      setMidiDevices(midiHandler.getDevices());
    }
  }, [midiHandler]);

  useEffect(() => {
    if (!midiHandler || !ui.isMidiListening) return;

    const handleMidiMessage = (message: MidiMessage) => {
      if (ui.listeningMode === 'volume' && message.type === 'cc') {
        const newSettings = {
          ...settings,
          volumeMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            ccNumber: message.ccNumber!,
            channel: message.channel,
          },
        };
        soundManager?.updateSettings(newSettings);
        dispatch(stopMidiListening());
        dispatch(setDirty(true));
      } else if (ui.listeningMode === 'stopall' && message.type === 'noteon') {
        const newSettings = {
          ...settings,
          stopAllMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            note: message.note!,
            channel: message.channel,
          },
        };
        soundManager?.updateSettings(newSettings);
        dispatch(stopMidiListening());
        dispatch(setDirty(true));
      }
    };

    midiHandler.addListener(handleMidiMessage);
    return () => {
      midiHandler.removeListener(handleMidiMessage);
    };
  }, [midiHandler, ui.isMidiListening, ui.listeningMode, soundManager, settings, dispatch]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseInt(e.target.value) / 100;
    dispatch(setMasterVolume(volume));
    soundManager?.setMasterVolume(volume);
    dispatch(setDirty(true));
  };

  return (
    <aside className="w-80 bg-dark-700 border-r-2 border-dark-500 p-6 overflow-y-auto">
      <section className="mb-6">
        <h3 className="text-xs font-semibold text-dark-200 uppercase mb-3">Master Volume</h3>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.masterVolume * 100)}
            onChange={handleVolumeChange}
            className="flex-1 h-1.5 bg-dark-500 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm w-12 text-right">{Math.round(settings.masterVolume * 100)}%</span>
        </div>
        <button
          onClick={() => dispatch(startMidiListening('volume'))}
          disabled={ui.isMidiListening}
          className="w-full px-3 py-2 bg-dark-500 hover:bg-dark-400 disabled:bg-dark-600 disabled:cursor-not-allowed rounded text-xs transition-colors"
        >
          {ui.isMidiListening && ui.listeningMode === 'volume' ? 'Listening...' : 'Map MIDI Knob'}
        </button>
        {settings.volumeMapping && (
          <div className="mt-2 p-2 bg-dark-800 rounded text-xs">
            <div>Device: {settings.volumeMapping.deviceName}</div>
            <div>CC: {settings.volumeMapping.ccNumber} Ch{settings.volumeMapping.channel + 1}</div>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h3 className="text-xs font-semibold text-dark-200 uppercase mb-3">Stop All Mapping</h3>
        <button
          onClick={() => dispatch(startMidiListening('stopall'))}
          disabled={ui.isMidiListening}
          className="w-full px-3 py-2 bg-dark-500 hover:bg-dark-400 disabled:bg-dark-600 disabled:cursor-not-allowed rounded text-xs transition-colors"
        >
          {ui.isMidiListening && ui.listeningMode === 'stopall' ? 'Listening...' : 'Map MIDI Key'}
        </button>
        {settings.stopAllMapping && (
          <div className="mt-2 p-2 bg-dark-800 rounded text-xs">
            <div>Device: {settings.stopAllMapping.deviceName}</div>
            <div>Note: {settings.stopAllMapping.note} Ch{settings.stopAllMapping.channel + 1}</div>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h3 className="text-xs font-semibold text-dark-200 uppercase mb-3">MIDI Devices</h3>
        <div className="bg-dark-800 rounded max-h-36 overflow-y-auto">
          {midiDevices.length === 0 ? (
            <div className="p-3 text-xs text-dark-300">No MIDI devices found</div>
          ) : (
            midiDevices.map(device => (
              <div key={device.id} className="p-2 text-xs border-b border-dark-600 last:border-0">
                {device.name}
              </div>
            ))
          )}
        </div>
      </section>

      {ui.isMidiListening && (
        <div className="p-3 bg-blue-900 border border-blue-700 rounded text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span>Listening for MIDI input...</span>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
