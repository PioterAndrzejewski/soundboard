import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { setSounds, addSound, removeSound, updateSound, reorderSounds } from './store/soundsSlice';
import { setSettings, setMasterVolume } from './store/settingsSlice';
import { setCurrentProjectPath, setDirty, triggerStopAll } from './store/uiSlice';
import { AudioEngine } from './audioEngine';
import { MidiHandler } from './midiHandler';
import { SoundManager } from './soundManager';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SoundsGrid from './components/SoundsGrid';
import SoundSettingsModal from './components/SoundSettingsModal';
import MidiListeningOverlay from './components/MidiListeningOverlay';
import ActiveSoundsPanel from './components/ActiveSoundsPanel';
import { Project } from '../shared/types';

const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const sounds = useAppSelector(state => state.sounds.sounds);
  const settings = useAppSelector(state => state.settings);
  const ui = useAppSelector(state => state.ui);

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const midiHandlerRef = useRef<MidiHandler | null>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);

  // Initialize engines
  useEffect(() => {
    // Add global error handler to catch crashes
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      event.preventDefault();
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const initEngines = async () => {
      try {
        audioEngineRef.current = new AudioEngine();
        midiHandlerRef.current = new MidiHandler();
        await midiHandlerRef.current.initialize();

        soundManagerRef.current = new SoundManager(
          audioEngineRef.current,
          midiHandlerRef.current,
          settings
        );

        console.log('Engines initialized successfully');
      } catch (error) {
        console.error('Failed to initialize engines:', error);
      }
    };

    initEngines();

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      soundManagerRef.current?.destroy();
    };
  }, []);

  // Update sound manager when settings change
  useEffect(() => {
    if (soundManagerRef.current) {
      soundManagerRef.current.updateSettings(settings);
    }

    // Update audio output device
    if (audioEngineRef.current) {
      audioEngineRef.current.setOutputDevice(settings.defaultOutputDeviceId);
    }
  }, [settings]);

  // Handle MIDI messages for volume and stop-all controls
  useEffect(() => {
    if (!midiHandlerRef.current) return;

    const handleMidiMessage = (message: any) => {
      // Debug logging for CC messages
      if (message.type === 'cc') {
        console.log('🎛️ MIDI CC Message:', {
          device: message.deviceName,
          deviceId: message.deviceId,
          channel: message.channel + 1, // Display as 1-16 instead of 0-15
          ccNumber: message.ccNumber,
          value: message.value,
          percentage: Math.round((message.value / 127) * 100) + '%'
        });
      }

      // Handle volume mapping
      if (message.type === 'cc' && settings.volumeMapping) {
        const vm = settings.volumeMapping;
        if (
          message.deviceId === vm.deviceId &&
          message.ccNumber === vm.ccNumber &&
          message.channel === vm.channel
        ) {
          console.log('✅ Matched volume mapping!', { value: message.value, volume: message.value / 127 });
          const volume = message.value / 127;
          dispatch(setMasterVolume(volume));
        }
      }

      // Handle stop all mapping
      if (message.type === 'noteon' && settings.stopAllMapping) {
        const sam = settings.stopAllMapping;
        if (
          message.deviceId === sam.deviceId &&
          message.note === sam.note &&
          message.channel === sam.channel
        ) {
          handleStopAll();
        }
      }
    };

    midiHandlerRef.current.addListener(handleMidiMessage);
    return () => {
      midiHandlerRef.current?.removeListener(handleMidiMessage);
    };
  }, [midiHandlerRef.current, settings.volumeMapping, settings.stopAllMapping, dispatch]);

  // Handle project operations
  const handleNewProject = async () => {
    if (ui.isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Create new project?');
      if (!confirmed) return;
    }

    await window.electronAPI.newProject();
    dispatch(setSounds([]));
    dispatch(setSettings({
      masterVolume: 0.8,
      defaultFadeInMs: 50,
      defaultFadeOutMs: 100,
    }));
    dispatch(setCurrentProjectPath(null));
    dispatch(setDirty(false));
  };

  const handleSaveProject = async () => {
    try {
      const project: Project = {
        name: ui.currentProjectPath ? ui.currentProjectPath.split('/').pop()?.replace('.sboard', '') || 'Untitled' : 'Untitled',
        version: '1.0.0',
        sounds,
        settings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const filePath = await window.electronAPI.saveProject(project, ui.currentProjectPath || undefined);
      dispatch(setCurrentProjectPath(filePath));
      dispatch(setDirty(false));
    } catch (error: any) {
      if (error.message !== 'Save canceled') {
        console.error('Failed to save project:', error);
        alert(`Failed to save project: ${error.message}`);
      }
    }
  };

  const handleSaveProjectAs = async () => {
    try {
      const project: Project = {
        name: 'Untitled',
        version: '1.0.0',
        sounds,
        settings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const filePath = await window.electronAPI.saveProjectAs(project);
      dispatch(setCurrentProjectPath(filePath));
      dispatch(setDirty(false));
    } catch (error: any) {
      if (error.message !== 'Save canceled') {
        console.error('Failed to save project:', error);
        alert(`Failed to save project: ${error.message}`);
      }
    }
  };

  const handleLoadProject = async () => {
    if (ui.isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Load project?');
      if (!confirmed) return;
    }

    try {
      const result = await window.electronAPI.loadProject();
      if (result) {
        dispatch(setSounds(result.project.sounds));
        dispatch(setSettings(result.project.settings));
        dispatch(setCurrentProjectPath(result.filePath));
        dispatch(setDirty(false));

        // Reload sounds into audio engine
        if (soundManagerRef.current && audioEngineRef.current) {
          for (const sound of result.project.sounds) {
            try {
              await audioEngineRef.current.loadSound(sound);
            } catch (error) {
              console.error(`Failed to load sound ${sound.name}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      alert(`Failed to load project: ${error}`);
    }
  };

  const handleAddSound = async () => {
    try {
      console.log('📂 Opening file picker...');
      const filePath = await window.electronAPI.selectSoundFile();
      console.log('📂 Selected file:', filePath);

      if (filePath && soundManagerRef.current) {
        const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
        console.log('➕ Adding sound:', fileName);

        const sound = await soundManagerRef.current.addSound(filePath, fileName);
        console.log('✅ Sound added to manager:', sound.id);

        dispatch(addSound(sound));
        console.log('✅ Sound added to Redux store');

        dispatch(setDirty(true));
        console.log('✅ All done!');
      }
    } catch (error: any) {
      console.error('❌ Failed to add sound:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      alert(`Failed to add sound: ${error?.message || error}`);
    }
  };

  const handleRemoveSound = (soundId: string) => {
    if (soundManagerRef.current) {
      soundManagerRef.current.removeSound(soundId);
      dispatch(removeSound(soundId));
      dispatch(setDirty(true));
    }
  };

  const handleStopAll = () => {
    if (soundManagerRef.current) {
      soundManagerRef.current.stopAllSounds();
      dispatch(triggerStopAll());
    }
  };

  return (
    <div className="flex flex-col h-screen bg-dark-800 text-dark-50">
      <Header
        projectPath={ui.currentProjectPath}
        isDirty={ui.isDirty}
        onNew={handleNewProject}
        onSave={handleSaveProject}
        onSaveAs={handleSaveProjectAs}
        onLoad={handleLoadProject}
        onAddSound={handleAddSound}
        onStopAll={handleStopAll}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          midiHandler={midiHandlerRef.current}
          soundManager={soundManagerRef.current}
        />

        <main className="flex-1 overflow-auto p-6">
          <SoundsGrid
            sounds={sounds}
            onRemove={handleRemoveSound}
            soundManager={soundManagerRef.current}
          />
        </main>

        <ActiveSoundsPanel audioEngine={audioEngineRef.current} />
      </div>

      <SoundSettingsModal
        soundManager={soundManagerRef.current}
        midiHandler={midiHandlerRef.current}
      />

      <MidiListeningOverlay
        assignmentTarget={
          ui.selectedSoundId
            ? sounds.find(s => s.id === ui.selectedSoundId)?.name
            : undefined
        }
      />
    </div>
  );
};

export default App;
