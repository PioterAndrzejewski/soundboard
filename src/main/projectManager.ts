import * as fs from 'fs/promises';
import * as path from 'path';
import { Project } from '../shared/types';

const PROJECT_VERSION = '1.0.0';
const PROJECT_EXTENSION = '.sboard';

export class ProjectManager {
  private recentProjects: string[] = [];
  private readonly maxRecentProjects = 10;

  public async saveProject(project: Project, filePath: string): Promise<void> {
    const projectData: Project = {
      ...project,
      version: PROJECT_VERSION,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf-8');
    this.addToRecentProjects(filePath);
  }

  public async loadProject(filePath: string): Promise<Project> {
    const data = await fs.readFile(filePath, 'utf-8');
    const project = JSON.parse(data) as Project;

    // Validate project version
    if (!project.version) {
      throw new Error('Invalid project file: missing version');
    }

    // Add to recent projects
    this.addToRecentProjects(filePath);

    return project;
  }

  public createNewProject(name: string): Project {
    return {
      name,
      version: PROJECT_VERSION,
      sounds: [],
      settings: {
        masterVolume: 0.8,
        defaultFadeInMs: 50,
        defaultFadeOutMs: 100,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  public getProjectExtension(): string {
    return PROJECT_EXTENSION;
  }

  public getRecentProjects(): string[] {
    return [...this.recentProjects];
  }

  private addToRecentProjects(filePath: string): void {
    // Remove if already exists
    this.recentProjects = this.recentProjects.filter(p => p !== filePath);

    // Add to beginning
    this.recentProjects.unshift(filePath);

    // Keep only max items
    if (this.recentProjects.length > this.maxRecentProjects) {
      this.recentProjects = this.recentProjects.slice(0, this.maxRecentProjects);
    }
  }

  public async validateProjectFile(filePath: string): Promise<boolean> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const project = JSON.parse(data);
      return !!(project.version && project.sounds && project.settings);
    } catch {
      return false;
    }
  }
}
