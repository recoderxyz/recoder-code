/**
 * 'recoder plan create' command
 */

import type { CommandModule } from 'yargs';
import * as readline from 'readline';
import { PlanningService, type ProjectPlan, type Task } from '../../services/PlanningService.js';
import { RecoderConfigService } from '../../services/RecoderConfigService.js';

interface CreateArgs {
  name: string;
  description?: string;
  interactive?: boolean;
  template?: string;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptMultiple(question: string): Promise<string[]> {
  console.log(question + ' (empty line to finish)');
  const items: string[] = [];
  let input = await prompt('  - ');
  while (input) {
    items.push(input);
    input = await prompt('  - ');
  }
  return items;
}

// Comprehensive templates with AI execution instructions
const TEMPLATES: Record<string, Partial<ProjectPlan>> = {
  'web-app': {
    architecture: {
      type: 'Full-Stack Web Application',
      diagram: `
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Next.js   │────▶│  Database   │
│  (React UI) │◀────│   (API)     │◀────│ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
      `,
      components: [
        { name: 'Frontend', type: 'SPA', description: 'Next.js React application with TypeScript', responsibilities: ['UI rendering', 'State management', 'API calls', 'Routing'] },
        { name: 'API Routes', type: 'API', description: 'Next.js API routes for backend logic', responsibilities: ['Request handling', 'Business logic', 'Data validation', 'Authentication'] },
        { name: 'Database', type: 'Storage', description: 'PostgreSQL with Prisma ORM', responsibilities: ['Data persistence', 'Queries', 'Migrations'] },
      ],
      patterns: ['MVC', 'Repository Pattern', 'Server Components', 'API Routes'],
    },
    techStack: {
      frontend: [
        { name: 'Next.js', version: '14', reason: 'Full-stack React framework with SSR/SSG' },
        { name: 'React', version: '18', reason: 'Component-based UI library' },
        { name: 'TypeScript', version: '5', reason: 'Type safety and better DX' },
        { name: 'Tailwind CSS', version: '3', reason: 'Utility-first CSS framework' },
      ],
      backend: [
        { name: 'Next.js API Routes', reason: 'Serverless API endpoints' },
        { name: 'Prisma', version: '5', reason: 'Type-safe ORM' },
      ],
      database: [{ name: 'PostgreSQL', version: '15', reason: 'Robust relational database' }],
      tools: [
        { name: 'ESLint', reason: 'Code linting' },
        { name: 'Prettier', reason: 'Code formatting' },
      ],
    },
    structure: {
      root: '.',
      directories: [
        {
          name: 'src',
          children: [
            { name: 'app', description: 'Next.js App Router pages', files: [
              { name: 'layout.tsx', description: 'Root layout with providers' },
              { name: 'page.tsx', description: 'Home page component' },
              { name: 'globals.css', description: 'Global styles with Tailwind' },
            ]},
            { name: 'components', description: 'Reusable React components', files: [
              { name: 'ui/Button.tsx', description: 'Button component' },
              { name: 'ui/Input.tsx', description: 'Input component' },
              { name: 'ui/Card.tsx', description: 'Card component' },
            ]},
            { name: 'lib', description: 'Utility functions and configurations', files: [
              { name: 'db.ts', description: 'Prisma client instance' },
              { name: 'utils.ts', description: 'Helper functions' },
            ]},
            { name: 'types', description: 'TypeScript type definitions', files: [
              { name: 'index.ts', description: 'Shared types' },
            ]},
          ],
        },
        { name: 'prisma', description: 'Database schema and migrations', files: [
          { name: 'schema.prisma', description: 'Prisma schema definition' },
        ]},
        { name: 'public', description: 'Static assets' },
      ],
    },
    phases: [
      {
        phase: 1,
        name: 'Project Setup',
        description: 'Initialize project with all configurations',
        tasks: [
          { id: 't1-1', title: 'Create Next.js project', description: 'Initialize with TypeScript and Tailwind', status: 'pending', aiPrompt: 'Create a new Next.js 14 project with TypeScript, Tailwind CSS, and App Router. Use `npx create-next-app@latest` with appropriate flags.' },
          { id: 't1-2', title: 'Setup Prisma', description: 'Initialize Prisma with PostgreSQL', status: 'pending', aiPrompt: 'Install Prisma, initialize it with PostgreSQL provider, create initial schema with User model.' },
          { id: 't1-3', title: 'Configure ESLint & Prettier', description: 'Setup code quality tools', status: 'pending', aiPrompt: 'Configure ESLint with Next.js rules and Prettier for consistent formatting.' },
        ],
        deliverables: ['Working development environment', 'Database connection'],
        estimatedTime: '2 hours',
      },
      {
        phase: 2,
        name: 'Core UI Components',
        description: 'Build reusable UI component library',
        tasks: [
          { id: 't2-1', title: 'Create Button component', description: 'Reusable button with variants', status: 'pending', aiPrompt: 'Create a Button component with variants (primary, secondary, outline), sizes (sm, md, lg), and loading state using Tailwind CSS.' },
          { id: 't2-2', title: 'Create Input component', description: 'Form input with validation', status: 'pending', aiPrompt: 'Create an Input component with label, error state, and proper accessibility attributes.' },
          { id: 't2-3', title: 'Create Card component', description: 'Content card container', status: 'pending', aiPrompt: 'Create a Card component with header, body, and footer slots using Tailwind CSS.' },
        ],
        deliverables: ['Component library', 'Storybook documentation'],
        estimatedTime: '4 hours',
      },
      {
        phase: 3,
        name: 'API & Database',
        description: 'Implement backend functionality',
        tasks: [
          { id: 't3-1', title: 'Create API routes', description: 'RESTful API endpoints', status: 'pending', aiPrompt: 'Create Next.js API routes for CRUD operations with proper error handling and validation.' },
          { id: 't3-2', title: 'Implement authentication', description: 'User auth with NextAuth.js', status: 'pending', aiPrompt: 'Setup NextAuth.js with credentials provider, JWT sessions, and protected routes.' },
        ],
        deliverables: ['Working API', 'Authentication system'],
        estimatedTime: '6 hours',
      },
      {
        phase: 4,
        name: 'Features & Polish',
        description: 'Complete features and optimize',
        tasks: [
          { id: 't4-1', title: 'Implement main features', description: 'Core application functionality', status: 'pending', aiPrompt: 'Implement the main features of the application with full CRUD operations.' },
          { id: 't4-2', title: 'Add error handling', description: 'Global error boundaries', status: 'pending', aiPrompt: 'Add error boundaries, loading states, and user-friendly error messages.' },
          { id: 't4-3', title: 'Optimize performance', description: 'Caching and optimization', status: 'pending', aiPrompt: 'Add React Query for data fetching, implement caching, and optimize images.' },
        ],
        deliverables: ['Production-ready application'],
        estimatedTime: '8 hours',
      },
    ],
    dependencies: {
      production: [
        { name: 'next', version: '^14.0.0', purpose: 'React framework' },
        { name: 'react', version: '^18.0.0', purpose: 'UI library' },
        { name: 'react-dom', version: '^18.0.0', purpose: 'React DOM' },
        { name: '@prisma/client', version: '^5.0.0', purpose: 'Database ORM' },
        { name: 'next-auth', version: '^4.0.0', purpose: 'Authentication' },
        { name: '@tanstack/react-query', version: '^5.0.0', purpose: 'Data fetching' },
      ],
      development: [
        { name: 'typescript', version: '^5.0.0', purpose: 'Type checking' },
        { name: 'prisma', version: '^5.0.0', purpose: 'Database toolkit' },
        { name: 'tailwindcss', version: '^3.0.0', purpose: 'CSS framework' },
        { name: 'eslint', purpose: 'Linting' },
        { name: 'prettier', purpose: 'Formatting' },
      ],
    },
    environment: {
      variables: [
        { name: 'DATABASE_URL', description: 'PostgreSQL connection string', required: true, example: 'postgresql://user:pass@localhost:5432/db' },
        { name: 'NEXTAUTH_SECRET', description: 'NextAuth.js secret key', required: true, example: 'your-secret-key' },
        { name: 'NEXTAUTH_URL', description: 'Application URL', required: true, example: 'http://localhost:3000' },
      ],
      secrets: ['DATABASE_URL', 'NEXTAUTH_SECRET'],
    },
    aiInstructions: {
      systemPrompt: 'Build a production-ready Next.js web application. Create REAL, working code - not placeholders. Include proper error handling, TypeScript types, and follow best practices.',
      executionOrder: [],
      codeTemplates: [],
      validationChecks: [
        { name: 'Project builds', type: 'command_succeeds', target: 'npm run build' },
        { name: 'Linting passes', type: 'command_succeeds', target: 'npm run lint' },
        { name: 'Database connects', type: 'command_succeeds', target: 'npx prisma db push' },
      ],
    },
  },

  'api': {
    architecture: {
      type: 'REST API Service',
      diagram: `
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Express   │────▶│  Database   │
│             │◀────│   (API)     │◀────│ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
      `,
      components: [
        { name: 'API Server', type: 'Service', description: 'Express.js REST API', responsibilities: ['Request routing', 'Middleware', 'Error handling'] },
        { name: 'Controllers', type: 'Logic', description: 'Request handlers', responsibilities: ['Input validation', 'Business logic', 'Response formatting'] },
        { name: 'Services', type: 'Business', description: 'Business logic layer', responsibilities: ['Data processing', 'External integrations'] },
        { name: 'Repository', type: 'Data', description: 'Data access layer', responsibilities: ['Database queries', 'Data mapping'] },
      ],
      patterns: ['Repository Pattern', 'Dependency Injection', 'Middleware Chain', 'DTO Pattern'],
    },
    techStack: {
      backend: [
        { name: 'Node.js', version: '20', reason: 'JavaScript runtime' },
        { name: 'Express', version: '4', reason: 'Web framework' },
        { name: 'TypeScript', version: '5', reason: 'Type safety' },
        { name: 'Prisma', version: '5', reason: 'Type-safe ORM' },
      ],
      database: [{ name: 'PostgreSQL', version: '15', reason: 'Relational database' }],
      tools: [
        { name: 'Jest', reason: 'Testing framework' },
        { name: 'Swagger', reason: 'API documentation' },
      ],
    },
    structure: {
      root: '.',
      directories: [
        {
          name: 'src',
          children: [
            { name: 'controllers', description: 'Request handlers', files: [
              { name: 'index.ts', description: 'Controller exports' },
            ]},
            { name: 'services', description: 'Business logic', files: [
              { name: 'index.ts', description: 'Service exports' },
            ]},
            { name: 'repositories', description: 'Data access', files: [
              { name: 'index.ts', description: 'Repository exports' },
            ]},
            { name: 'middleware', description: 'Express middleware', files: [
              { name: 'auth.ts', description: 'Authentication middleware' },
              { name: 'errorHandler.ts', description: 'Global error handler' },
              { name: 'validate.ts', description: 'Request validation' },
            ]},
            { name: 'routes', description: 'API routes', files: [
              { name: 'index.ts', description: 'Route definitions' },
            ]},
            { name: 'types', description: 'TypeScript types', files: [
              { name: 'index.ts', description: 'Shared types' },
            ]},
            { name: 'utils', description: 'Utilities', files: [
              { name: 'logger.ts', description: 'Logging utility' },
            ]},
          ],
          files: [
            { name: 'app.ts', description: 'Express app setup' },
            { name: 'server.ts', description: 'Server entry point' },
          ],
        },
        { name: 'prisma', files: [{ name: 'schema.prisma', description: 'Database schema' }] },
        { name: 'tests', description: 'Test files' },
      ],
    },
    phases: [
      {
        phase: 1,
        name: 'Setup',
        description: 'Initialize Express API project',
        tasks: [
          { id: 't1-1', title: 'Initialize project', description: 'Create package.json and install deps', status: 'pending', aiPrompt: 'Initialize Node.js project with TypeScript, Express, Prisma. Setup tsconfig.json for ES modules.' },
          { id: 't1-2', title: 'Setup Express app', description: 'Configure Express with middleware', status: 'pending', aiPrompt: 'Create Express app with CORS, JSON parsing, helmet security, and request logging.' },
          { id: 't1-3', title: 'Setup Prisma', description: 'Initialize database', status: 'pending', aiPrompt: 'Initialize Prisma with PostgreSQL, create schema with User and related models.' },
        ],
        deliverables: ['Running Express server', 'Database connection'],
        estimatedTime: '2 hours',
      },
      {
        phase: 2,
        name: 'Core API',
        description: 'Implement CRUD endpoints',
        tasks: [
          { id: 't2-1', title: 'Create routes', description: 'Define API routes', status: 'pending', aiPrompt: 'Create RESTful routes for all resources with proper HTTP methods and status codes.' },
          { id: 't2-2', title: 'Implement controllers', description: 'Request handlers', status: 'pending', aiPrompt: 'Implement controllers with input validation using Zod, proper error handling, and response formatting.' },
          { id: 't2-3', title: 'Add authentication', description: 'JWT auth middleware', status: 'pending', aiPrompt: 'Implement JWT authentication with login, register, and protected route middleware.' },
        ],
        deliverables: ['Working CRUD API', 'Authentication'],
        estimatedTime: '6 hours',
      },
      {
        phase: 3,
        name: 'Polish',
        description: 'Documentation and testing',
        tasks: [
          { id: 't3-1', title: 'Add Swagger docs', description: 'API documentation', status: 'pending', aiPrompt: 'Add Swagger/OpenAPI documentation for all endpoints with request/response schemas.' },
          { id: 't3-2', title: 'Write tests', description: 'Unit and integration tests', status: 'pending', aiPrompt: 'Write Jest tests for controllers and services with mocked dependencies.' },
        ],
        deliverables: ['API documentation', 'Test coverage'],
        estimatedTime: '4 hours',
      },
    ],
    dependencies: {
      production: [
        { name: 'express', version: '^4.18.0', purpose: 'Web framework' },
        { name: '@prisma/client', version: '^5.0.0', purpose: 'Database ORM' },
        { name: 'jsonwebtoken', purpose: 'JWT authentication' },
        { name: 'bcryptjs', purpose: 'Password hashing' },
        { name: 'zod', purpose: 'Schema validation' },
        { name: 'helmet', purpose: 'Security headers' },
        { name: 'cors', purpose: 'CORS support' },
      ],
      development: [
        { name: 'typescript', version: '^5.0.0', purpose: 'Type checking' },
        { name: 'prisma', version: '^5.0.0', purpose: 'Database toolkit' },
        { name: 'ts-node', purpose: 'TypeScript execution' },
        { name: 'nodemon', purpose: 'Development server' },
        { name: 'jest', purpose: 'Testing' },
        { name: '@types/express', purpose: 'Express types' },
      ],
    },
    aiInstructions: {
      systemPrompt: 'Build a production-ready REST API with Express.js. Create REAL, working endpoints - not mocks. Include proper validation, error handling, and security.',
      executionOrder: [],
      codeTemplates: [],
      validationChecks: [
        { name: 'Server starts', type: 'command_succeeds', target: 'npm run dev' },
        { name: 'Tests pass', type: 'command_succeeds', target: 'npm test' },
      ],
    },
  },

  'cli': {
    architecture: {
      type: 'CLI Application',
      components: [
        { name: 'CLI Parser', type: 'Interface', description: 'Command line argument parsing', responsibilities: ['Parse arguments', 'Show help', 'Handle flags'] },
        { name: 'Commands', type: 'Logic', description: 'Command implementations', responsibilities: ['Execute actions', 'Handle errors'] },
      ],
      patterns: ['Command Pattern', 'Factory Pattern'],
    },
    techStack: {
      backend: [
        { name: 'Node.js', version: '20', reason: 'JavaScript runtime' },
        { name: 'TypeScript', version: '5', reason: 'Type safety' },
        { name: 'yargs', reason: 'CLI framework' },
        { name: 'chalk', reason: 'Terminal styling' },
      ],
    },
    structure: {
      root: '.',
      directories: [
        {
          name: 'src',
          children: [
            { name: 'commands', description: 'CLI commands', files: [
              { name: 'index.ts', description: 'Command exports' },
            ]},
            { name: 'utils', description: 'Utilities', files: [
              { name: 'logger.ts', description: 'Colored logging' },
            ]},
          ],
          files: [
            { name: 'cli.ts', description: 'CLI entry point' },
          ],
        },
        { name: 'bin', files: [{ name: 'cli.js', description: 'Executable entry' }] },
      ],
    },
    phases: [
      {
        phase: 1,
        name: 'Setup',
        description: 'Initialize CLI project',
        tasks: [
          { id: 't1-1', title: 'Initialize project', description: 'Setup TypeScript CLI', status: 'pending', aiPrompt: 'Create Node.js CLI project with TypeScript, yargs, and chalk. Configure bin entry in package.json.' },
        ],
        deliverables: ['Working CLI scaffold'],
        estimatedTime: '1 hour',
      },
      {
        phase: 2,
        name: 'Commands',
        description: 'Implement CLI commands',
        tasks: [
          { id: 't2-1', title: 'Create commands', description: 'Implement main commands', status: 'pending', aiPrompt: 'Create CLI commands with proper argument parsing, help text, and error handling.' },
        ],
        deliverables: ['Working commands'],
        estimatedTime: '4 hours',
      },
    ],
    dependencies: {
      production: [
        { name: 'yargs', purpose: 'CLI framework' },
        { name: 'chalk', purpose: 'Terminal colors' },
      ],
      development: [
        { name: 'typescript', version: '^5.0.0', purpose: 'Type checking' },
        { name: '@types/yargs', purpose: 'Yargs types' },
      ],
    },
    aiInstructions: {
      systemPrompt: 'Build a production-ready CLI tool. Create working commands with proper argument parsing and error handling.',
      executionOrder: [],
      codeTemplates: [],
      validationChecks: [
        { name: 'CLI runs', type: 'command_succeeds', target: 'node dist/cli.js --help' },
      ],
    },
  },
};

export const createPlanCommand: CommandModule<{}, CreateArgs> = {
  command: 'create <name>',
  describe: 'Create a new project plan',
  builder: (yargs) =>
    yargs
      .positional('name', {
        type: 'string',
        description: 'Plan name',
        demandOption: true,
      })
      .option('description', {
        alias: 'd',
        type: 'string',
        describe: 'Plan description',
      })
      .option('interactive', {
        alias: 'i',
        type: 'boolean',
        describe: 'Interactive mode - guided plan creation',
      })
      .option('template', {
        alias: 't',
        type: 'string',
        choices: ['web-app', 'api', 'cli'],
        describe: 'Start from a template',
      }),
  handler: async (argv) => {
    const configService = new RecoderConfigService();
    const planningService = new PlanningService();

    if (!configService.exists()) {
      await configService.init();
      console.log('📁 Created .recoder folder\n');
    }

    const description = argv.description || `Plan for ${argv.name}`;
    let plan = planningService.createPlan(argv.name, description);

    if (argv.template && TEMPLATES[argv.template]) {
      const template = TEMPLATES[argv.template];
      plan = {
        ...plan,
        ...template,
        name: argv.name,
        description,
        id: plan.id,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        aiInstructions: {
          ...template.aiInstructions!,
          systemPrompt: `Build "${argv.name}": ${description}. ${template.aiInstructions?.systemPrompt || ''}`,
        },
      };
    }

    if (argv.interactive) {
      console.log('\n🎯 Interactive Plan Creation\n');

      plan.overview.summary = await prompt('Project summary: ') || description;
      plan.overview.goals = await promptMultiple('Project goals:');
      plan.overview.targetAudience = await prompt('Target audience: ') || undefined;

      plan.architecture.type = await prompt('Architecture type (monolith/microservices/serverless): ') || 'monolith';
      plan.architecture.patterns = await promptMultiple('Design patterns:');

      console.log('\n📦 Technology Stack');
      const frontendTech = await prompt('Frontend technologies (comma-separated): ');
      if (frontendTech) {
        plan.techStack.frontend = frontendTech.split(',').map(t => ({ name: t.trim(), reason: 'Selected' }));
      }
      const backendTech = await prompt('Backend technologies (comma-separated): ');
      if (backendTech) {
        plan.techStack.backend = backendTech.split(',').map(t => ({ name: t.trim(), reason: 'Selected' }));
      }
      const dbTech = await prompt('Database (comma-separated): ');
      if (dbTech) {
        plan.techStack.database = dbTech.split(',').map(t => ({ name: t.trim(), reason: 'Selected' }));
      }

      plan.notes = await promptMultiple('\n📝 Additional notes:');
    }

    planningService.savePlan(plan);

    console.log(`\n✅ Created plan: ${plan.name}`);
    console.log(`   ID: ${plan.id}`);
    console.log(`   Files created:`);
    console.log(`   - .recoder/plans/${plan.id}.json   (full plan data)`);
    console.log(`   - .recoder/plans/${plan.id}.md     (human-readable)`);
    console.log(`   - .recoder/plans/${plan.id}.ai.md  (AI-executable)`);
    console.log('\n💡 Next steps:');
    console.log(`   recoder plan show ${plan.id}       # View the plan`);
    console.log(`   recoder plan scaffold ${plan.id}   # Generate folder structure`);
    console.log(`\n🤖 To execute with AI:`);
    console.log(`   cat .recoder/plans/${plan.id}.ai.md | recoder`);
    console.log(`   # Or paste the AI plan into your AI assistant`);
  },
};
