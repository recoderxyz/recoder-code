/**
 * Recoder.xyz Web Platform Service
 * Handles integration with web IDE for project management
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { RecoderAuthService } from './RecoderAuthService.js';

const RECODER_WEB_URL = process.env['RECODER_WEB_URL'] || 'https://web.recoder.xyz';

export interface WebProject {
  id: string;
  urlId: string;
  description: string;
  timestamp: string;
  messageCount: number;
  fileCount?: number;
}

export interface WebProjectDetails {
  id: string;
  urlId: string;
  description?: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  fileSnapshot: Record<string, string>;
}

export class RecoderWebService {
  private authService: RecoderAuthService;

  constructor() {
    this.authService = new RecoderAuthService();
  }

  /**
   * List all web projects for authenticated user
   */
  async listProjects(limit: number = 50): Promise<WebProject[]> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Run: recoder auth login');
    }

    const user = await this.authService.getUser();
    if (!user) {
      throw new Error('Unable to fetch user info');
    }

    const url = new URL(`${RECODER_WEB_URL}/api/chat-history`);
    url.searchParams.set('userId', user.id);
    url.searchParams.set('limit', limit.toString());

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid response from server');
    }

    return data.data.map((item: any) => ({
      id: item.id,
      urlId: item.urlId,
      description: item.description || 'Untitled Project',
      timestamp: item.timestamp,
      messageCount: item.messageCount || 0,
      fileCount: item.fileCount,
    }));
  }

  /**
   * Get project details including files
   */
  async getProject(urlId: string): Promise<WebProjectDetails> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Run: recoder auth login');
    }

    const url = new URL(`${RECODER_WEB_URL}/api/chat-history`);
    url.searchParams.set('urlId', urlId);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Project not found: ${urlId}`);
      }
      throw new Error(`Failed to fetch project: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      throw new Error('Project not found');
    }

    const project = data.data[0];

    return {
      id: project.id,
      urlId: project.urlId,
      description: project.description,
      messages: project.messages || [],
      fileSnapshot: project.fileSnapshot || {},
    };
  }

  /**
   * Download project files to local directory
   */
  async downloadProject(urlId: string, outputDir?: string): Promise<{
    directory: string;
    fileCount: number;
    files: string[];
  }> {
    console.log(`📥 Fetching project ${urlId}...`);

    const project = await this.getProject(urlId);

    const fileCount = Object.keys(project.fileSnapshot).length;

    if (fileCount === 0) {
      throw new Error('No files found in this project');
    }

    console.log(`✓ Found ${fileCount} files`);

    // Determine output directory
    const projectName = project.description
      ? project.description.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)
      : `project-${urlId}`;

    const targetDir = outputDir || path.join(process.cwd(), projectName);

    // Create directory
    await fs.mkdir(targetDir, { recursive: true });

    console.log(`📂 Creating files in: ${targetDir}`);

    const createdFiles: string[] = [];

    // Write all files
    for (const [filePath, content] of Object.entries(project.fileSnapshot)) {
      const fullPath = path.join(targetDir, filePath);

      // Create parent directories if needed
      const fileDir = path.dirname(fullPath);
      await fs.mkdir(fileDir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');

      createdFiles.push(filePath);
      console.log(`  ✓ ${filePath}`);
    }

    // Create a .recoder-web file with project metadata
    const metadataFile = path.join(targetDir, '.recoder-web');
    await fs.writeFile(
      metadataFile,
      JSON.stringify({
        urlId: project.urlId,
        description: project.description,
        downloadedAt: new Date().toISOString(),
        webUrl: `${RECODER_WEB_URL}/chat/${project.urlId}`,
      }, null, 2),
      'utf-8'
    );

    return {
      directory: targetDir,
      fileCount,
      files: createdFiles,
    };
  }

  /**
   * Open project in browser
   */
  getProjectUrl(urlId: string): string {
    return `${RECODER_WEB_URL}/chat/${urlId}`;
  }

  /**
   * Upload/sync local files to web project
   */
  async uploadProject(urlId: string, files: Record<string, string>, title?: string): Promise<{
    success: boolean;
    sessionId?: string;
    fileCount: number;
  }> {
    const token = await this.authService.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Run: recoder auth login');
    }

    const user = await this.authService.getUser();
    if (!user) {
      throw new Error('Unable to fetch user info');
    }

    console.log(`📤 Uploading ${Object.keys(files).length} files to project ${urlId}...`);

    // Get existing project to preserve messages
    let existingMessages = [];
    try {
      const existing = await this.getProject(urlId);
      existingMessages = existing.messages;
    } catch {
      // Project doesn't exist yet, that's OK
      console.log('Creating new project...');
    }

    const response = await fetch(`${RECODER_WEB_URL}/api/chat-history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        urlId,
        title: title || `Project ${urlId}`,
        description: title || `Synced from CLI`,
        messages: existingMessages.length > 0 ? existingMessages : [
          {
            id: Date.now().toString(),
            role: 'system',
            content: 'Project synced from CLI',
          },
        ],
        fileSnapshot: files,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to upload: ${error.error || response.statusText}`);
    }

    const data = await response.json();

    return {
      success: data.success,
      sessionId: data.data?.sessionId,
      fileCount: Object.keys(files).length,
    };
  }

  /**
   * Scan directory and read all files
   */
  async scanDirectory(directory: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.vercel'];
    const ignoredFiles = ['.DS_Store', '.env', '.env.local', '.recoder-web'];

    const scanDir = async (dir: string, relativePath: string = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (ignoredFiles.includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (!ignoredDirs.includes(entry.name)) {
            await scanDir(fullPath, relPath);
          }
        } else {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            files[relPath] = content;
          } catch (error) {
            console.warn(`⚠ Could not read file: ${relPath}`);
          }
        }
      }
    };

    await scanDir(directory);
    return files;
  }

  /**
   * Compare local files with remote and detect changes
   */
  async detectChanges(
    localFiles: Record<string, string>,
    remoteFiles: Record<string, string>
  ): Promise<{
    added: string[];
    modified: string[];
    deleted: string[];
    unchanged: string[];
  }> {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const unchanged: string[] = [];

    // Check all local files
    for (const [path, content] of Object.entries(localFiles)) {
      if (!remoteFiles[path]) {
        added.push(path);
      } else if (remoteFiles[path] !== content) {
        modified.push(path);
      } else {
        unchanged.push(path);
      }
    }

    // Check for deleted files
    for (const path of Object.keys(remoteFiles)) {
      if (!localFiles[path]) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted, unchanged };
  }

  /**
   * Check if we can connect to recoder-web
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${RECODER_WEB_URL}/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
