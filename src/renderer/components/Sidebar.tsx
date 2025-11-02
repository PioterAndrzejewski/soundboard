import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMasterVolume, updateSettings } from '../store/settingsSlice';
import { toggleMidiMappingMode, startMappingTarget, clearMappingTarget, setDirty } from '../store/uiSlice';
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
    if (!midiHandler || !ui.isMidiListening || !ui.mappingTarget) return;

    const handleMidiMessage = (message: MidiMessage) => {
      if (ui.mappingTarget === 'volume' && message.type === 'cc') {
        dispatch(updateSettings({
          volumeMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            ccNumber: message.ccNumber!,
            channel: message.channel,
          },
        }));
        dispatch(clearMappingTarget());
        dispatch(setDirty(true));
      } else if (ui.mappingTarget === 'stopall' && message.type === 'noteon') {
        dispatch(updateSettings({
          stopAllMapping: {
            deviceId: message.deviceId,
            deviceName: message.deviceName,
            note: message.note!,
            channel: message.channel,
          },
        }));
        dispatch(clearMappingTarget());
        dispatch(setDirty(true));
      }
    };

    midiHandler.addListener(handleMidiMessage);
    return () => {
      midiHandler.removeListener(handleMidiMessage);
    };
  }, [midiHandler, ui.isMidiListening, ui.mappingTarget, dispatch]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseInt(e.target.value) / 100;
    dispatch(setMasterVolume(volume));
    dispatch(setDirty(true));
  };

  const isMappingVolume = ui.isMidiMappingMode && ui.mappingTarget === 'volume';
  const volumeHasMappingTitle = settings.volumeMapping
    ? `Mapped to: ${settings.volumeMapping.deviceName} CC${settings.volumeMapping.ccNumber} Ch${settings.volumeMapping.channel + 1}`
    : 'Not mapped';

  return (
    <aside className="w-80 bg-dark-700 border-r-2 border-dark-500 p-6 overflow-y-auto">
      {/* MIDI Mapping Mode Toggle */}
      <section className="mb-6">
        <button
          onClick={() => dispatch(toggleMidiMappingMode())}
          className={`w-full px-4 py-3 rounded-lg font-semibold transition-all ${
            ui.isMidiMappingMode
              ? 'bg-green-600 hover:bg-green-500 ring-2 ring-green-400'
              : 'bg-purple-600 hover:bg-purple-500'
          }`}
        >
          🎹 {ui.isMidiMappingMode ? 'MIDI Mapping ON' : 'MIDI Mapping Mode'}
        </button>
        {ui.isMidiMappingMode && (
          <p className="mt-2 text-xs text-green-400 text-center animate-pulse">
            Click any mappable element to assign MIDI
          </p>
        )}
      </section>

      {/* Master Volume */}
      <section
        className={`mb-6 p-3 rounded transition-all duration-300 relative ${
          volumeFlash ? 'bg-blue-900 bg-opacity-30 ring-2 ring-blue-500' : ''
        } ${
          ui.isMidiMappingMode ? 'ring-2 ring-purple-500 hover:ring-purple-400 cursor-pointer' : ''
        } ${
          isMappingVolume ? 'ring-2 ring-green-500 animate-pulse' : ''
        }`}
        onClick={() => {
          if (ui.isMidiMappingMode && !ui.mappingTarget) {
            dispatch(startMappingTarget('volume'));
          }
        }}
        title={ui.isMidiMappingMode ? 'Click to map MIDI knob' : volumeHasMappingTitle}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-dark-200 uppercase">Master Volume</h3>
          <span className={`text-lg ${settings.volumeMapping ? 'text-green-400' : 'text-gray-500'}`}>
            🎹
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.masterVolume * 100)}
            onChange={handleVolumeChange}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-1.5 bg-dark-500 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm w-12 text-right">{Math.round(settings.masterVolume * 100)}%</span>
        </div>
        {settings.volumeMapping && !ui.isMidiMappingMode && (
          <div className="mt-2 p-2 bg-dark-800 rounded text-xs">
            <div>Device: {settings.volumeMapping.deviceName}</div>
            <div>CC: {settings.volumeMapping.ccNumber} Ch{settings.volumeMapping.channel + 1}</div>
          </div>
        )}
        {isMappingVolume && (
          <div className="mt-2 p-2 bg-green-900 border border-green-500 rounded text-xs text-green-300 animate-pulse">
            ⏳ Listening for MIDI knob...
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
