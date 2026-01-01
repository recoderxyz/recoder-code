/**
 * RecoderConfigService - Manages .recoder folder configuration
 * Similar to .cursor or .claude folders
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface RecoderConfig {
  version: string;
  project?: {
    name?: string;
    description?: string;
    type?: string;
  };
  ai?: {
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
  };
  mcp?: {
    servers?: Record<string, any>;
  };
  plans?: PlanMetadata[];
}

export interface PlanMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
}

const DEFAULT_CONFIG: RecoderConfig = {
  version: '1.0.0',
};

export class RecoderConfigService {
  private configDir: string;
  private globalConfigDir: string;

  constructor(workspaceDir: string = process.cwd()) {
    this.configDir = path.join(workspaceDir, '.recoder');
    this.globalConfigDir = path.join(os.homedir(), '.recoder');
  }

  // Initialize .recoder folder structure
  async init(options: { global?: boolean } = {}): Promise<void> {
    const dir = options.global ? this.globalConfigDir : this.configDir;
    
    const dirs = [
      dir,
      path.join(dir, 'plans'),
      path.join(dir, 'context'),
      path.join(dir, 'cache'),
    ];

    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    }

    // Create default config if not exists
    const configPath = path.join(dir, 'config.json');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }

    // Create .gitignore for cache
    const gitignorePath = path.join(dir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 'cache/\n*.log\n');
    }
  }

  // Check if .recoder folder exists
  exists(options: { global?: boolean } = {}): boolean {
    const dir = options.global ? this.globalConfigDir : this.configDir;
    return fs.existsSync(dir);
  }

  // Get config
  getConfig(options: { global?: boolean } = {}): RecoderConfig {
    const dir = options.global ? this.globalConfigDir : this.configDir;
    const configPath = path.join(dir, 'config.json');
    
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG;
    }

    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  // Save config
  saveConfig(config: RecoderConfig, options: { global?: boolean } = {}): void {
    const dir = options.global ? this.globalConfigDir : this.configDir;
    if (!fs.existsSync(dir)) {
      this.init(options);
    }
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2));
  }

  // Get plans directory
  getPlansDir(): string {
    return path.join(this.configDir, 'plans');
  }

  // Get context directory  
  getContextDir(): string {
    return path.join(this.configDir, 'context');
  }

  // Save context file (like rules, instructions)
  saveContext(name: string, content: string): void {
    const contextDir = this.getContextDir();
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    fs.writeFileSync(path.join(contextDir, `${name}.md`), content);
  }

  // Get context file
  getContext(name: string): string | null {
    const filePath = path.join(this.getContextDir(), `${name}.md`);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  }

  // List all context files
  listContextFiles(): string[] {
    const contextDir = this.getContextDir();
    if (!fs.existsSync(contextDir)) return [];
    return fs.readdirSync(contextDir).filter(f => f.endsWith('.md'));
  }
}
