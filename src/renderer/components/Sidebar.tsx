import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMasterVolume, updateSettings } from '../store/settingsSlice';
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
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [volumeFlash, setVolumeFlash] = useState(false);
  const [prevVolume, setPrevVolume] = useState(settings.masterVolume);

  useEffect(() => {
    if (midiHandler) {
      setMidiDevices(midiHandler.getDevices());
    }

    // Enumerate audio output devices
    const enumerateAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        setAudioOutputDevices(audioOutputs);
        console.log('Audio output devices:', audioOutputs);
      } catch (error) {
        console.error('Failed to enumerate audio devices:', error);
      }
    };

    enumerateAudioDevices();
  }, [midiHandler]);

  // Detect volume changes from MIDI and trigger flash
  useEffect(() => {
    if (settings.masterVolume !== prevVolume) {
      setPrevVolume(settings.masterVolume);
      setVolumeFlash(true);
      const timer = setTimeout(() => setVolumeFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [settings.masterVolume, prevVolume]);

  useEffect(() => {
    if (!midiHandler || !ui.isMidiListening) return;

    const handleMidiMessage = (message: MidiMessage) => {
      if (ui.listeningMode === 'volume' && message.type === 'cc') {
        dispatch(updateSettings({
          volumeMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            ccNumber: message.ccNumber!,
            channel: message.channel,
          },
        }));
        dispatch(stopMidiListening());
        dispatch(setDirty(true));
      } else if (ui.listeningMode === 'stopall' && message.type === 'noteon') {
        dispatch(updateSettings({
          stopAllMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            note: message.note!,
            channel: message.channel,
          },
        }));
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
    dispatch(setDirty(true));
  };

  return (
    <aside className="w-80 bg-dark-700 border-r-2 border-dark-500 p-6 overflow-y-auto">
      <section className={`mb-6 p-3 rounded transition-all duration-300 ${volumeFlash ? 'bg-blue-900 bg-opacity-30 ring-2 ring-blue-500' : ''}`}>
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
        <h3 className="text-xs font-semibold text-dark-200 uppercase mb-3">Audio Output Device</h3>
        <select
          value={settings.defaultOutputDeviceId || 'default'}
          onChange={(e) => {
            dispatch(updateSettings({ defaultOutputDeviceId: e.target.value === 'default' ? undefined : e.target.value }));
            dispatch(setDirty(true));
          }}
          className="w-full px-3 py-2 bg-dark-800 border border-dark-500 rounded text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="default">Default Output</option>
          {audioOutputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Device ${device.deviceId.substring(0, 8)}`}
            </option>
          ))}
        </select>
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
    </aside>
  );
};

export default Sidebar;
