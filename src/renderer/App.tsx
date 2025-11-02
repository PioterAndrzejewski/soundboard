import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { setSounds, addSound, removeSound, updateSound, reorderSounds } from './store/soundsSlice';
import { setSettings, setMasterVolume } from './store/settingsSlice';
import { setCurrentProjectPath, setDirty } from './store/uiSlice';
import { AudioEngine } from './audioEngine';
import { MidiHandler } from './midiHandler';
import { SoundManager } from './soundManager';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SoundsGrid from './components/SoundsGrid';
import SoundSettingsModal from './components/SoundSettingsModal';
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
      soundManagerRef.current?.destroy();
    };
  }, []);

  // Update sound manager when settings change
  useEffect(() => {
    if (soundManagerRef.current) {
      soundManagerRef.current.updateSettings(settings);
    }
  }, [settings]);

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
      const filePath = await window.electronAPI.selectSoundFile();
      if (filePath && soundManagerRef.current) {
        const fileName = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Untitled';
        const sound = await soundManagerRef.current.addSound(filePath, fileName);
        dispatch(addSound(sound));
        dispatch(setDirty(true));
      }
    } catch (error) {
      console.error('Failed to add sound:', error);
      alert(`Failed to add sound: ${error}`);
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
      </div>

      <SoundSettingsModal
        soundManager={soundManagerRef.current}
        midiHandler={midiHandlerRef.current}
      />
    </div>
  );
};

export default App;
