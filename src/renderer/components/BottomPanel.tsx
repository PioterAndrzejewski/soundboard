import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setMasterVolume, updateSettings } from '../store/settingsSlice';
import { startMappingTarget, clearMappingTarget, setDirty } from '../store/uiSlice';
import { MidiMessage } from '../../shared/types';

interface BottomPanelProps {
  midiHandler: any;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ midiHandler }) => {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(state => state.settings);
  const ui = useAppSelector(state => state.ui);
  const [volumeFlash, setVolumeFlash] = useState(false);
  const [prevVolume, setPrevVolume] = useState(settings.masterVolume);

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
    <div className="bg-dark-700 border-t-2 border-dark-500 px-6 py-3">
      <div className="flex items-center justify-center">
        <section
          className={`p-3 rounded transition-all duration-300 relative min-w-[320px] ${
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-dark-200 uppercase">Master Volume</h3>
            <span className={`text-lg transition-opacity ${settings.volumeMapping ? 'opacity-100 text-green-400' : 'opacity-30 text-gray-400'}`}>
              🎹
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(settings.masterVolume * 100)}
              onChange={handleVolumeChange}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 h-2 bg-dark-500 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-base w-14 text-right font-semibold">{Math.round(settings.masterVolume * 100)}%</span>
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
      </div>
    </div>
  );
};

export default BottomPanel;
