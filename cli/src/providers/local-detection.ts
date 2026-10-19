/**
 * Local Provider Detection - Auto-detect running local AI servers
 */

import type { AIProvider } from './types.js';

const LOCAL_PROVIDERS = [
  {
    id: 'lmstudio',
    name: 'LM Studio',
    port: 1234,
    baseUrl: 'http://localhost:1234/v1',
    engine: 'openai' as const,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    port: 11434,
    baseUrl: 'http://localhost:11434',
    engine: 'ollama' as const,
  },
  {
    id: 'llamacpp',
    name: 'llama.cpp',
    port: 8080,
    baseUrl: 'http://localhost:8080/v1',
    engine: 'openai' as const,
  },
  {
    id: 'vllm',
    name: 'vLLM',
    port: 8000,
    baseUrl: 'http://localhost:8000/v1',
    engine: 'openai' as const,
  },
];

async function checkServer(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export async function detectLocalProviders(): Promise<AIProvider[]> {
  const detected: AIProvider[] = [];

  for (const provider of LOCAL_PROVIDERS) {
    const isRunning = await checkServer(provider.baseUrl);
    
    if (isRunning) {
      detected.push({
        id: provider.id,
        name: provider.name,
        engine: provider.engine,
        baseUrl: provider.baseUrl,
        isLocal: true,
        isEnabled: true,
        isBuiltin: false,
        supportsStreaming: true,
      });
    }
  }

  return detected;
}

export async function detectAndReport(): Promise<void> {
  console.log('🔍 Detecting local AI servers...\n');
  
  const detected = await detectLocalProviders();
  
  if (detected.length === 0) {
    console.log('❌ No local AI servers detected');
    console.log('\n💡 Start one of these:');
    LOCAL_PROVIDERS.forEach(p => {
      console.log(`   • ${p.name} (port ${p.port})`);
    });
  } else {
    console.log('✅ Detected local servers:\n');
    detected.forEach(p => {
      console.log(`   • ${p.name} - ${p.baseUrl}`);
    });
    console.log('\n💡 Use with: recoder --provider ' + detected[0].id);
  }
  console.log();
}
