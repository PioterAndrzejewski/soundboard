import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { StorageManager } from './storage';
import { ProjectManager } from './projectManager';
import { IpcChannel, Project } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let storageManager: StorageManager;
let projectManager: ProjectManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the index.html from dist (webpack outputs to dist root)
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html')).catch(() => {
    // Fallback for development with webpack-dev-server
    mainWindow?.loadURL('http://localhost:3000');
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
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

    return { project, filePath };
  });

  ipcMain.handle(IpcChannel.GET_RECENT_PROJECTS, async () => {
    return projectManager.getRecentProjects();
  });
}

app.whenReady().then(() => {
  storageManager = new StorageManager();
  projectManager = new ProjectManager();
  setupIpcHandlers();
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
