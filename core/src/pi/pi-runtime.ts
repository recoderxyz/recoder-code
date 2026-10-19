/**
 * Recoder Code ↔ pi runtime bridge.
 *
 * Runs a coding task through the Recoder-owned @recoder/pi-coding-agent runtime
 * (merged from earendil-works/pi) against the local filesystem. This makes pi a
 * first-class engine inside Recoder Code (the CLI), alongside the Gemini-based
 * core — not just a vendored package.
 *
 * pi is ESM-only with an exports map; load it via a dynamic import that survives
 * CJS output (mirrors backend's A2A pi runtime adapter).
 *
 * Type-only `import('@recoder/pi-coding-agent')` references the real declarations
 * (emitted to dist/index.d.ts) without producing a static runtime import, so the
 * CJS dynamic-import survival trick in `loadPi()` is preserved while the boundary
 * is fully typed instead of `any`.
 */

/** The runtime module shape, taken straight from the package's emitted .d.ts. */
type PiModule = typeof import('@recoder/pi-coding-agent');
type PiAgentSessionEvent = import('@recoder/pi-coding-agent').AgentSessionEvent;

export interface RunPiCodingTaskOptions {
  prompt: string;
  /** Working directory the agent operates in (defaults to process.cwd()). */
  cwd?: string;
  /** "provider/modelId", e.g. "anthropic/claude-sonnet-4". Defaults to first available. */
  model?: string;
  /** Provider API keys; falls back to env vars when omitted. */
  providerKeys?: {
    openai?: string;
    anthropic?: string;
    google?: string;
    openrouter?: string;
  };
}

export interface RunPiCodingTaskResult {
  success: boolean;
  text: string;
  filesChanged: string[];
}

async function loadPi(): Promise<PiModule> {
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<PiModule>;
  return dynamicImport('@recoder/pi-coding-agent');
}

export async function isPiRuntimeAvailable(): Promise<boolean> {
  try {
    await loadPi();
    return true;
  } catch {
    return false;
  }
}

export async function runPiCodingTask(options: RunPiCodingTaskOptions): Promise<RunPiCodingTaskResult> {
  const pi = await loadPi();
  const { AuthStorage, ModelRegistry, createAgentSession } = pi;
  const SessionManager = pi.SessionManager;

  const authStorage = AuthStorage.inMemory();
  const keys: Record<string, string | undefined> = {
    openrouter: options.providerKeys?.openrouter ?? process.env.OPENROUTER_API_KEY,
    openai: options.providerKeys?.openai ?? process.env.OPENAI_API_KEY,
    anthropic: options.providerKeys?.anthropic ?? process.env.ANTHROPIC_API_KEY,
    google: options.providerKeys?.google ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
  };
  for (const [provider, key] of Object.entries(keys)) {
    if (key?.trim()) {
      authStorage.set(provider, { type: 'api_key', key: key.trim() });
    }
  }

  const modelRegistry = ModelRegistry.create(authStorage);
  let model: ReturnType<typeof modelRegistry.find>;
  const requested = options.model?.trim();
  if (requested) {
    const slash = requested.indexOf('/');
    if (slash > 0 && slash < requested.length - 1) {
      model = modelRegistry.find(requested.slice(0, slash), requested.slice(slash + 1));
    }
  }
  if (!model) {
    model = modelRegistry.getAvailable()[0];
  }
  if (!model) {
    return {
      success: false,
      text: 'No pi model available — set a provider API key (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY / OPENROUTER_API_KEY).',
      filesChanged: [],
    };
  }

  const { session } = await createAgentSession({
    cwd: options.cwd ?? process.cwd(),
    authStorage,
    modelRegistry,
    model,
    sessionManager: SessionManager?.inMemory?.() ?? undefined,
  });

  const textParts: string[] = [];
  const filesChanged: string[] = [];
  const unsubscribe = session.subscribe((event: PiAgentSessionEvent) => {
    if (event.type === 'message_end' && event.message?.role === 'assistant') {
      for (const content of event.message.content ?? []) {
        if (content.type === 'text') {
          textParts.push(content.text);
        }
      }
    }
    if (event.type === 'tool_execution_end') {
      if (event.toolName === 'write' || event.toolName === 'edit') {
        // pi types the tool result as `any`; write/edit results carry the path.
        const path = event.result?.path;
        if (typeof path === 'string' && path.length > 0) {
          filesChanged.push(path);
        }
      }
    }
  });

  try {
    await session.prompt(options.prompt);
    return { success: true, text: textParts.join('\n\n'), filesChanged };
  } catch (err: any) {
    return { success: false, text: `Error: ${err?.message ?? String(err)}`, filesChanged };
  } finally {
    try {
      unsubscribe();
    } catch {
      /* best effort */
    }
    try {
      session.dispose?.();
    } catch {
      /* best effort */
    }
  }
}
