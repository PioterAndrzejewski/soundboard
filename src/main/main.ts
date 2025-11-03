import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { StorageManager } from './storage';
import { ProjectManager } from './projectManager';
import { IpcChannel, Project } from '../shared/types';

// Increase memory limits for audio processing
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

let mainWindow: BrowserWindow | null = null;
let storageManager: StorageManager;
let projectManager: ProjectManager;

function createMenu() {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu-open-project');
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu-save-project');
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu-save-project-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Add Sound...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow?.webContents.send('menu-add-sound');
          }
        },
        { type: 'separator' },
        {
          label: 'Revert to Auto-save',
          click: () => {
            mainWindow?.webContents.send('menu-revert-autosave');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Increase memory limits for audio processing
      v8CacheOptions: 'none',
    },
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    // Development mode - load from webpack dev server
    mainWindow.loadURL('http://localhost:3000').catch(err => {
      console.error('Failed to load dev server, falling back to file:', err);
      mainWindow?.loadFile(path.join(__dirname, '..', 'index.html'));
    });
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load from dist
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  // Sound management
  ipcMain.handle(IpcChannel.ADD_SOUND, async (event, filePath: string, name: string) => {
    // This will be handled by the renderer's sound manager
    return { success: true };
  });

  ipcMain.handle(IpcChannel.REMOVE_SOUND, async (event, soundId: string) => {
    return { success: true };
  });

  ipcMain.handle(IpcChannel.UPDATE_SOUND, async (event, soundId: string, updates: any) => {
    return { success: true };
  });

  ipcMain.handle(IpcChannel.GET_SOUNDS, async () => {
    return storageManager.getSounds();
  });

  // Settings
  ipcMain.handle(IpcChannel.GET_SETTINGS, async () => {
    return storageManager.getSettings();
  });

  ipcMain.handle(IpcChannel.UPDATE_SETTINGS, async (event, settings: any) => {
    storageManager.saveSettings(settings);
    return { success: true };
  });

  // File selection
  ipcMain.handle(IpcChannel.SELECT_SOUND_FILE, async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Project management
  ipcMain.handle(IpcChannel.NEW_PROJECT, async () => {
    // Clear current project - handled in renderer
    return { success: true };
  });

  ipcMain.handle(IpcChannel.SAVE_PROJECT, async (event, project: Project, filePath?: string) => {
    if (!mainWindow) throw new Error('No main window');

    let targetPath = filePath;

    if (!targetPath) {
      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: `${project.name}${projectManager.getProjectExtension()}`,
        filters: [
          { name: 'Soundboard Project', extensions: [projectManager.getProjectExtension().slice(1)] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Save canceled');
      }

      targetPath = result.filePath;
    }

    await projectManager.saveProject(project, targetPath);
    storageManager.setLastProjectPath(targetPath);
    // Clear auto-save when manually saving
    storageManager.clearAutoSave();
    return targetPath;
  });

  ipcMain.handle(IpcChannel.SAVE_PROJECT_AS, async (event, project: Project) => {
    if (!mainWindow) throw new Error('No main window');

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Project As',
      defaultPath: `${project.name}${projectManager.getProjectExtension()}`,
      filters: [
        { name: 'Soundboard Project', extensions: [projectManager.getProjectExtension().slice(1)] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      throw new Error('Save canceled');
    }

    await projectManager.saveProject(project, result.filePath);
    storageManager.setLastProjectPath(result.filePath);
    // Clear auto-save when manually saving
    storageManager.clearAutoSave();
    return result.filePath;
  });

  ipcMain.handle(IpcChannel.LOAD_PROJECT, async () => {
    if (!mainWindow) throw new Error('No main window');

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Load Project',
      properties: ['openFile'],
      filters: [
        { name: 'Soundboard Project', extensions: [projectManager.getProjectExtension().slice(1)] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const project = await projectManager.loadProject(filePath);
    storageManager.setLastProjectPath(filePath);
    // Clear auto-save when loading a new project
    storageManager.clearAutoSave();

    return { project, filePath };
  });

  ipcMain.handle(IpcChannel.LOAD_PROJECT_BY_PATH, async (event, filePath: string) => {
    const project = await projectManager.loadProject(filePath);
    storageManager.setLastProjectPath(filePath);
    return { project, filePath };
  });

  ipcMain.handle(IpcChannel.GET_RECENT_PROJECTS, async () => {
    return projectManager.getRecentProjects();
  });

  // Last project path management
  ipcMain.handle(IpcChannel.GET_LAST_PROJECT_PATH, async () => {
    return storageManager.getLastProjectPath();
  });

  ipcMain.handle(IpcChannel.SET_LAST_PROJECT_PATH, async (event, filePath: string) => {
    storageManager.setLastProjectPath(filePath);
    return { success: true };
  });

  // Auto-save management
  ipcMain.handle(IpcChannel.SAVE_AUTO_SAVE, async (event, project: Project) => {
    storageManager.saveAutoSave(project);
    return { success: true };
  });

  ipcMain.handle(IpcChannel.GET_AUTO_SAVE, async () => {
    return storageManager.getAutoSave();
  });

  ipcMain.handle(IpcChannel.CLEAR_AUTO_SAVE, async () => {
    storageManager.clearAutoSave();
    return { success: true };
  });

  ipcMain.handle(IpcChannel.HAS_AUTO_SAVE, async () => {
    return storageManager.hasAutoSave();
  });

  // Audio file reading
  ipcMain.handle('read-audio-file', async (event, filePath: string) => {
    try {
      console.log('Main process: Reading audio file:', filePath);
      const buffer = await fs.readFile(filePath);
      console.log('Main process: File read successfully, size:', buffer.length, 'bytes');

      // Return the Node.js Buffer directly - Electron will handle the serialization
      return buffer;
    } catch (error) {
      console.error('Main process: Failed to read audio file:', error);
      throw error;
    }
  });

  // Save synthesized sound
  ipcMain.handle('save-synth-sound', async (event, noteName: string, audioData: Uint8Array) => {
    try {
      const tempDir = app.getPath('temp');
      const synthDir = path.join(tempDir, 'soundboard-synth');

      // Create synth directory if it doesn't exist
      await fs.mkdir(synthDir, { recursive: true });

      // Create filename from note name
      const fileName = `synth_${noteName.replace('#', 's')}.wav`;
      const filePath = path.join(synthDir, fileName);

      // Write the audio data
      await fs.writeFile(filePath, Buffer.from(audioData));

      console.log('Synth sound saved:', filePath);
      return filePath;
    } catch (error) {
      console.error('Failed to save synth sound:', error);
      throw error;
    }
  });

  // Get temp directory path
  ipcMain.handle('get-temp-dir', async () => {
    return app.getPath('temp');
  });
}

app.whenReady().then(() => {
  storageManager = new StorageManager();
  projectManager = new ProjectManager();
  setupIpcHandlers();
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup will be handled by renderer process
});
