/**
 * Provider health monitoring
 */

import chalk from 'chalk';
import { getProviderRegistry } from '../../providers/registry.js';

interface HealthStatus {
  provider: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  responseTime?: number;
  error?: string;
}

async function checkProviderHealth(provider: any): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    let endpoint = provider.baseUrl;
    if (provider.engine === 'openai') {
      endpoint = `${provider.baseUrl}/models`;
    } else if (provider.engine === 'ollama') {
      endpoint = `${provider.baseUrl}/api/tags`;
    }
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...provider.headers,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    
    if (response.ok) {
      return {
        provider: provider.id,
        name: provider.name,
        status: 'online',
        responseTime,
      };
    } else {
      return {
        provider: provider.id,
        name: provider.name,
        status: 'error',
        error: `HTTP ${response.status}`,
      };
    }
  } catch (err: any) {
    return {
      provider: provider.id,
      name: provider.name,
      status: 'offline',
      error: err.message || 'Connection failed',
    };
  }
}

export async function monitorProviders(): Promise<void> {
  console.log(chalk.bold.cyan('\n🏥 Provider Health Monitor\n'));
  console.log(chalk.gray('Checking all providers...\n'));

  const registry = getProviderRegistry();
  const providers = registry.getAllProviders();

  const results: HealthStatus[] = [];

  for (const provider of providers) {
    const status = await checkProviderHealth(provider);
    results.push(status);
  }

  // Display results
  console.log(chalk.bold('Status Report:'));
  console.log(chalk.gray('─'.repeat(60)));

  const online = results.filter(r => r.status === 'online');
  const offline = results.filter(r => r.status === 'offline');
  const errors = results.filter(r => r.status === 'error');

  online.forEach(r => {
    console.log(
      chalk.green('✓') + ' ' +
      chalk.bold(r.name) + ' ' +
      chalk.gray(`(${r.responseTime}ms)`)
    );
  });

  errors.forEach(r => {
    console.log(
      chalk.yellow('⚠') + ' ' +
      chalk.bold(r.name) + ' ' +
      chalk.gray(`- ${r.error}`)
    );
  });

  offline.forEach(r => {
    console.log(
      chalk.red('✗') + ' ' +
      chalk.bold(r.name) + ' ' +
      chalk.gray(`- ${r.error}`)
    );
  });

  console.log(chalk.gray('─'.repeat(60)));
  console.log(
    chalk.green(`${online.length} online`) + ' | ' +
    chalk.yellow(`${errors.length} errors`) + ' | ' +
    chalk.red(`${offline.length} offline`)
  );
  console.log();
}
