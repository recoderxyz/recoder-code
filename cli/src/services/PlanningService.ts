/**
 * PlanningService - Comprehensive project planning module
 * Generates technical architecture, folder structure, and implementation plans
 * Plans are designed to be AI-executable for end-to-end project generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { RecoderConfigService } from './RecoderConfigService.js';

export interface ProjectPlan {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  
  overview: {
    summary: string;
    goals: string[];
    targetAudience?: string;
    timeline?: string;
  };

  architecture: {
    type: string;
    diagram?: string;
    components: ArchitectureComponent[];
    dataFlow?: string;
    patterns: string[];
  };

  techStack: {
    frontend?: TechChoice[];
    backend?: TechChoice[];
    database?: TechChoice[];
    infrastructure?: TechChoice[];
    tools?: TechChoice[];
  };

  structure: FileStructure;
  phases: ImplementationPhase[];

  api?: {
    style: string;
    endpoints?: ApiEndpoint[];
    authentication?: string;
  };

  database?: {
    type: string;
    entities: DatabaseEntity[];
    relationships?: string;
  };

  dependencies: {
    production: Dependency[];
    development: Dependency[];
  };

  environment?: {
    variables: EnvVariable[];
    secrets: string[];
  };

  // AI Execution Instructions
  aiInstructions: AIExecutionPlan;

  notes?: string[];
  risks?: string[];
  assumptions?: string[];
}

// AI-specific execution plan
export interface AIExecutionPlan {
  systemPrompt: string;
  executionOrder: ExecutionStep[];
  codeTemplates: CodeTemplate[];
  validationChecks: ValidationCheck[];
}

export interface ExecutionStep {
  step: number;
  action: 'create_file' | 'create_directory' | 'run_command' | 'install_deps' | 'configure' | 'implement' | 'test';
  target: string;
  description: string;
  content?: string;
  command?: string;
  dependencies?: number[]; // step numbers this depends on
  validation?: string;
}

export interface CodeTemplate {
  file: string;
  language: string;
  description: string;
  template: string;
  variables?: Record<string, string>;
}

export interface ValidationCheck {
  name: string;
  type: 'file_exists' | 'command_succeeds' | 'contains_text' | 'builds' | 'tests_pass';
  target: string;
  expected?: string;
}

export interface ArchitectureComponent {
  name: string;
  type: string;
  description: string;
  responsibilities: string[];
  dependencies?: string[];
}

export interface TechChoice {
  name: string;
  version?: string;
  reason: string;
}

export interface FileStructure {
  root: string;
  directories: DirectoryNode[];
}

export interface DirectoryNode {
  name: string;
  description?: string;
  files?: FileNode[];
  children?: DirectoryNode[];
}

export interface FileNode {
  name: string;
  description: string;
  template?: string;
}

export interface ImplementationPhase {
  phase: number;
  name: string;
  description: string;
  tasks: Task[];
  deliverables: string[];
  estimatedTime?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  files?: string[];
  dependencies?: string[];
  status: 'pending' | 'in-progress' | 'completed';
  aiPrompt?: string; // Specific prompt for AI to execute this task
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  request?: string;
  response?: string;
}

export interface DatabaseEntity {
  name: string;
  fields: { name: string; type: string; constraints?: string }[];
}

export interface Dependency {
  name: string;
  version?: string;
  purpose: string;
}

export interface EnvVariable {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

export class PlanningService {
  private configService: RecoderConfigService;
  private plansDir: string;

  constructor(workspaceDir: string = process.cwd()) {
    this.configService = new RecoderConfigService(workspaceDir);
    this.plansDir = this.configService.getPlansDir();
  }

  createPlan(name: string, description: string): ProjectPlan {
    const id = `plan-${Date.now()}`;
    const now = new Date().toISOString();

    const plan: ProjectPlan = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
      overview: { summary: description, goals: [] },
      architecture: { type: 'tbd', components: [], patterns: [] },
      techStack: {},
      structure: { root: '.', directories: [] },
      phases: [],
      dependencies: { production: [], development: [] },
      aiInstructions: this.generateDefaultAIInstructions(name, description),
    };

    this.savePlan(plan);
    return plan;
  }

  private generateDefaultAIInstructions(name: string, description: string): AIExecutionPlan {
    return {
      systemPrompt: `You are building "${name}". ${description}. Follow the execution steps in order. Create production-ready code with proper error handling, types, and documentation.`,
      executionOrder: [],
      codeTemplates: [],
      validationChecks: [],
    };
  }

  // Generate AI execution steps from plan structure
  generateAIExecutionSteps(plan: ProjectPlan): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    let stepNum = 1;

    // Step 1: Create directory structure
    const flattenDirs = (dirs: DirectoryNode[], basePath: string = ''): string[] => {
      const paths: string[] = [];
      for (const dir of dirs) {
        const dirPath = basePath ? `${basePath}/${dir.name}` : dir.name;
        paths.push(dirPath);
        if (dir.children) {
          paths.push(...flattenDirs(dir.children, dirPath));
        }
      }
      return paths;
    };

    for (const dirPath of flattenDirs(plan.structure.directories)) {
      steps.push({
        step: stepNum++,
        action: 'create_directory',
        target: dirPath,
        description: `Create ${dirPath} directory`,
      });
    }

    // Step 2: Install dependencies
    if (plan.dependencies.production.length > 0 || plan.dependencies.development.length > 0) {
      steps.push({
        step: stepNum++,
        action: 'create_file',
        target: 'package.json',
        description: 'Create package.json with dependencies',
        content: this.generatePackageJson(plan),
      });

      steps.push({
        step: stepNum++,
        action: 'run_command',
        target: '.',
        description: 'Install dependencies',
        command: 'npm install',
        dependencies: [stepNum - 1],
      });
    }

    // Step 3: Create config files
    steps.push({
      step: stepNum++,
      action: 'create_file',
      target: 'tsconfig.json',
      description: 'Create TypeScript configuration',
      content: this.generateTsConfig(plan),
    });

    // Step 4: Create files from structure
    const flattenFiles = (dirs: DirectoryNode[], basePath: string = ''): { path: string; file: FileNode }[] => {
      const files: { path: string; file: FileNode }[] = [];
      for (const dir of dirs) {
        const dirPath = basePath ? `${basePath}/${dir.name}` : dir.name;
        if (dir.files) {
          for (const file of dir.files) {
            files.push({ path: `${dirPath}/${file.name}`, file });
          }
        }
        if (dir.children) {
          files.push(...flattenFiles(dir.children, dirPath));
        }
      }
      return files;
    };

    for (const { path: filePath, file } of flattenFiles(plan.structure.directories)) {
      steps.push({
        step: stepNum++,
        action: 'create_file',
        target: filePath,
        description: file.description,
        content: file.template || `// ${file.description}\n// TODO: Implement`,
      });
    }

    // Step 5: Implementation phases
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        steps.push({
          step: stepNum++,
          action: 'implement',
          target: task.files?.join(', ') || 'various',
          description: `${task.title}: ${task.description}`,
          content: task.aiPrompt || task.description,
        });
      }
    }

    // Step 6: Validation
    steps.push({
      step: stepNum++,
      action: 'run_command',
      target: '.',
      description: 'Build project',
      command: 'npm run build',
    });

    return steps;
  }

  private generatePackageJson(plan: ProjectPlan): string {
    const pkg: any = {
      name: plan.name.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      description: plan.description,
      type: 'module',
      scripts: {
        dev: 'next dev || vite || ts-node src/index.ts',
        build: 'next build || vite build || tsc',
        start: 'next start || node dist/index.js',
        test: 'jest || vitest',
        lint: 'eslint . --ext .ts,.tsx',
      },
      dependencies: {} as Record<string, string>,
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
      } as Record<string, string>,
    };

    for (const dep of plan.dependencies.production) {
      pkg.dependencies[dep.name] = dep.version || 'latest';
    }
    for (const dep of plan.dependencies.development) {
      pkg.devDependencies[dep.name] = dep.version || 'latest';
    }

    return JSON.stringify(pkg, null, 2);
  }

  private generateTsConfig(plan: ProjectPlan): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: './dist',
        rootDir: './src',
        declaration: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    }, null, 2);
  }

  savePlan(plan: ProjectPlan): void {
    if (!fs.existsSync(this.plansDir)) {
      fs.mkdirSync(this.plansDir, { recursive: true });
    }

    plan.updatedAt = new Date().toISOString();
    
    // Generate AI execution steps
    plan.aiInstructions.executionOrder = this.generateAIExecutionSteps(plan);
    
    fs.writeFileSync(
      path.join(this.plansDir, `${plan.id}.json`),
      JSON.stringify(plan, null, 2)
    );

    fs.writeFileSync(
      path.join(this.plansDir, `${plan.id}.md`),
      this.planToMarkdown(plan)
    );

    // Also save AI-executable version
    fs.writeFileSync(
      path.join(this.plansDir, `${plan.id}.ai.md`),
      this.planToAIExecutable(plan)
    );
  }

  loadPlan(id: string): ProjectPlan | null {
    const filePath = path.join(this.plansDir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  listPlans(): ProjectPlan[] {
    if (!fs.existsSync(this.plansDir)) return [];
    
    return fs.readdirSync(this.plansDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.plansDir, f), 'utf-8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ProjectPlan[];
  }

  deletePlan(id: string): boolean {
    const files = [`${id}.json`, `${id}.md`, `${id}.ai.md`];
    let deleted = false;
    for (const file of files) {
      const filePath = path.join(this.plansDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
      }
    }
    return deleted;
  }

  // Generate AI-executable markdown
  planToAIExecutable(plan: ProjectPlan): string {
    let md = `# AI Execution Plan: ${plan.name}\n\n`;
    md += `> ${plan.aiInstructions.systemPrompt}\n\n`;
    md += `## Instructions for AI\n\n`;
    md += `Execute the following steps in order. Each step must be completed before moving to the next.\n`;
    md += `Create production-ready, fully functional code - NOT placeholder or mock implementations.\n\n`;

    md += `## Execution Steps\n\n`;
    for (const step of plan.aiInstructions.executionOrder) {
      md += `### Step ${step.step}: ${step.description}\n\n`;
      md += `**Action:** \`${step.action}\`\n`;
      md += `**Target:** \`${step.target}\`\n`;
      
      if (step.command) {
        md += `**Command:** \`${step.command}\`\n`;
      }
      
      if (step.dependencies && step.dependencies.length > 0) {
        md += `**Depends on:** Steps ${step.dependencies.join(', ')}\n`;
      }
      
      if (step.content) {
        md += `\n**Content:**\n\`\`\`\n${step.content}\n\`\`\`\n`;
      }
      
      if (step.validation) {
        md += `**Validation:** ${step.validation}\n`;
      }
      
      md += '\n---\n\n';
    }

    // Code templates
    if (plan.aiInstructions.codeTemplates.length > 0) {
      md += `## Code Templates\n\n`;
      for (const template of plan.aiInstructions.codeTemplates) {
        md += `### ${template.file}\n`;
        md += `${template.description}\n\n`;
        md += `\`\`\`${template.language}\n${template.template}\n\`\`\`\n\n`;
      }
    }

    // Validation checklist
    md += `## Validation Checklist\n\n`;
    md += `Before marking complete, verify:\n`;
    md += `- [ ] All files created as specified\n`;
    md += `- [ ] Dependencies installed successfully\n`;
    md += `- [ ] Project builds without errors\n`;
    md += `- [ ] All features implemented (not mocked)\n`;
    md += `- [ ] Code follows best practices\n`;
    md += `- [ ] Error handling implemented\n`;
    md += `- [ ] Types properly defined\n\n`;

    for (const check of plan.aiInstructions.validationChecks) {
      md += `- [ ] ${check.name}: ${check.type} on \`${check.target}\`\n`;
    }

    return md;
  }

  planToMarkdown(plan: ProjectPlan): string {
    let md = `# ${plan.name}\n\n`;
    md += `> ${plan.description}\n\n`;
    md += `**Status:** ${plan.status} | **Created:** ${plan.createdAt.split('T')[0]}\n\n`;

    // Overview
    md += `## 📋 Overview\n\n`;
    md += `${plan.overview.summary}\n\n`;
    if (plan.overview.goals.length > 0) {
      md += `### Goals\n`;
      plan.overview.goals.forEach(g => md += `- ${g}\n`);
      md += '\n';
    }

    // Architecture
    md += `## 🏗️ Architecture\n\n`;
    md += `**Type:** ${plan.architecture.type}\n\n`;
    if (plan.architecture.diagram) {
      md += `\`\`\`\n${plan.architecture.diagram}\n\`\`\`\n\n`;
    }
    if (plan.architecture.components.length > 0) {
      md += `### Components\n\n`;
      plan.architecture.components.forEach(c => {
        md += `#### ${c.name} (${c.type})\n`;
        md += `${c.description}\n`;
        md += `- Responsibilities: ${c.responsibilities.join(', ')}\n\n`;
      });
    }
    if (plan.architecture.patterns.length > 0) {
      md += `### Design Patterns\n`;
      plan.architecture.patterns.forEach(p => md += `- ${p}\n`);
      md += '\n';
    }

    // Tech Stack
    md += `## 🛠️ Technology Stack\n\n`;
    const stackSections = ['frontend', 'backend', 'database', 'infrastructure', 'tools'] as const;
    for (const section of stackSections) {
      const items = plan.techStack[section];
      if (items && items.length > 0) {
        md += `### ${section.charAt(0).toUpperCase() + section.slice(1)}\n`;
        items.forEach(t => md += `- **${t.name}**${t.version ? ` v${t.version}` : ''}: ${t.reason}\n`);
        md += '\n';
      }
    }

    // File Structure
    md += `## 📁 Project Structure\n\n`;
    md += '```\n';
    md += this.structureToTree(plan.structure);
    md += '```\n\n';

    // Implementation Phases
    if (plan.phases.length > 0) {
      md += `## 🚀 Implementation Phases\n\n`;
      plan.phases.forEach(phase => {
        md += `### Phase ${phase.phase}: ${phase.name}\n`;
        md += `${phase.description}\n`;
        if (phase.estimatedTime) md += `**Estimated Time:** ${phase.estimatedTime}\n`;
        md += '\n**Tasks:**\n';
        phase.tasks.forEach(t => {
          const status = t.status === 'completed' ? '✅' : t.status === 'in-progress' ? '🔄' : '⬜';
          md += `- ${status} ${t.title}\n`;
          if (t.aiPrompt) md += `  - AI: ${t.aiPrompt}\n`;
        });
        md += '\n**Deliverables:**\n';
        phase.deliverables.forEach(d => md += `- ${d}\n`);
        md += '\n';
      });
    }

    // API
    if (plan.api && plan.api.endpoints && plan.api.endpoints.length > 0) {
      md += `## 🔌 API Design\n\n`;
      md += `**Style:** ${plan.api.style}\n`;
      if (plan.api.authentication) md += `**Auth:** ${plan.api.authentication}\n`;
      md += '\n### Endpoints\n\n';
      md += '| Method | Path | Description |\n';
      md += '|--------|------|-------------|\n';
      plan.api.endpoints.forEach(e => {
        md += `| ${e.method} | ${e.path} | ${e.description} |\n`;
      });
      md += '\n';
    }

    // Database
    if (plan.database && plan.database.entities.length > 0) {
      md += `## 💾 Database Schema\n\n`;
      md += `**Type:** ${plan.database.type}\n\n`;
      plan.database.entities.forEach(entity => {
        md += `### ${entity.name}\n`;
        md += '| Field | Type | Constraints |\n';
        md += '|-------|------|-------------|\n';
        entity.fields.forEach(f => {
          md += `| ${f.name} | ${f.type} | ${f.constraints || '-'} |\n`;
        });
        md += '\n';
      });
    }

    // Dependencies
    md += `## 📦 Dependencies\n\n`;
    if (plan.dependencies.production.length > 0) {
      md += `### Production\n`;
      plan.dependencies.production.forEach(d => {
        md += `- **${d.name}**${d.version ? ` (${d.version})` : ''}: ${d.purpose}\n`;
      });
      md += '\n';
    }
    if (plan.dependencies.development.length > 0) {
      md += `### Development\n`;
      plan.dependencies.development.forEach(d => {
        md += `- **${d.name}**${d.version ? ` (${d.version})` : ''}: ${d.purpose}\n`;
      });
      md += '\n';
    }

    // Environment
    if (plan.environment && plan.environment.variables.length > 0) {
      md += `## ⚙️ Environment Variables\n\n`;
      md += '| Variable | Description | Required | Example |\n';
      md += '|----------|-------------|----------|----------|\n';
      plan.environment.variables.forEach(v => {
        md += `| ${v.name} | ${v.description} | ${v.required ? 'Yes' : 'No'} | ${v.example || '-'} |\n`;
      });
      md += '\n';
    }

    // Notes
    if (plan.notes && plan.notes.length > 0) {
      md += `## 📝 Notes\n\n`;
      plan.notes.forEach(n => md += `- ${n}\n`);
      md += '\n';
    }

    if (plan.risks && plan.risks.length > 0) {
      md += `## ⚠️ Risks\n\n`;
      plan.risks.forEach(r => md += `- ${r}\n`);
      md += '\n';
    }

    // AI Execution reference
    md += `## 🤖 AI Execution\n\n`;
    md += `This plan has ${plan.aiInstructions.executionOrder.length} execution steps.\n`;
    md += `See \`${plan.id}.ai.md\` for AI-executable instructions.\n`;

    return md;
  }

  private structureToTree(structure: FileStructure, indent: string = ''): string {
    let tree = `${structure.root}/\n`;
    
    const renderDir = (dirs: DirectoryNode[], prefix: string): string => {
      let result = '';
      dirs.forEach((dir, i) => {
        const isLast = i === dirs.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        
        result += `${prefix}${connector}${dir.name}/\n`;
        
        if (dir.files) {
          dir.files.forEach((file, fi) => {
            const fileIsLast = fi === dir.files!.length - 1 && (!dir.children || dir.children.length === 0);
            const fileConnector = fileIsLast ? '└── ' : '├── ';
            result += `${prefix}${childPrefix}${fileConnector}${file.name}\n`;
          });
        }
        
        if (dir.children) {
          result += renderDir(dir.children, prefix + childPrefix);
        }
      });
      return result;
    };

    tree += renderDir(structure.directories, '');
    return tree;
  }

  generateScaffold(plan: ProjectPlan, targetDir: string = process.cwd()): string[] {
    const created: string[] = [];

    const createStructure = (dirs: DirectoryNode[], basePath: string) => {
      for (const dir of dirs) {
        const dirPath = path.join(basePath, dir.name);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          created.push(dirPath);
        }

        if (dir.files) {
          for (const file of dir.files) {
            const filePath = path.join(dirPath, file.name);
            if (!fs.existsSync(filePath)) {
              const content = file.template || `// ${file.description}\n`;
              fs.writeFileSync(filePath, content);
              created.push(filePath);
            }
          }
        }

        if (dir.children) {
          createStructure(dir.children, dirPath);
        }
      }
    };

    createStructure(plan.structure.directories, targetDir);
    return created;
  }
}
