# ⚙️ Recoder Code Core

**Core Library for AI-Powered Coding Assistant**

The core library powering Recoder Code - provides AI model integrations, context management, and intelligent code assistance capabilities.

[![Version](https://img.shields.io/npm/v/recoder-code-core)](https://www.npmjs.com/package/recoder-code-core)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Overview

Recoder Code Core is the foundational library that provides:
- Multiple AI provider integrations (OpenAI, Anthropic, Google, etc.)
- Model Context Protocol (MCP) support
- Token counting and management
- Code parsing and analysis
- Context tracking and management
- OpenTelemetry observability

## 📦 Installation

```bash
npm install recoder-code-core
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { RecoderCore } from 'recoder-code-core';

// Initialize core
const recoder = new RecoderCore({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

// Get AI response
const response = await recoder.chat('How do I sort an array in JavaScript?');
console.log(response);
```

### With Context

```typescript
import { RecoderCore, FileContext } from 'recoder-code-core';

const recoder = new RecoderCore({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229'
});

// Add file context
const context = new FileContext();
await context.addFile('src/index.ts');
await context.addFile('src/utils.ts');

// Chat with context
const response = await recoder.chat(
  'Review the code in index.ts',
  { context }
);
```

## 🏗️ Architecture

```
recoder-code-core/
├── AI Providers Layer
│   ├── OpenAI
│   ├── Anthropic (Claude)
│   ├── Google (Gemini)
│   └── Custom Providers
├── Context Management
│   ├── File Context
│   ├── Project Context
│   └── Conversation History
├── Code Analysis
│   ├── Tree-sitter Parsing
│   ├── Syntax Analysis
│   └── Code Understanding
├── Token Management
│   ├── Token Counting
│   ├── Context Windows
│   └── Optimization
└── Observability
    ├── OpenTelemetry
    ├── Metrics
    └── Logging
```

## 🔧 API Reference

### RecoderCore

Main class for interacting with AI models.

```typescript
class RecoderCore {
  constructor(options: RecoderOptions);
  chat(message: string, options?: ChatOptions): Promise<string>;
  streamChat(message: string, options?: ChatOptions): AsyncIterator<string>;
  setModel(model: string): void;
  setProvider(provider: string): void;
}
```

#### Options

```typescript
interface RecoderOptions {
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  baseURL?: string;
}
```

### FileContext

Manage file context for AI conversations.

```typescript
class FileContext {
  addFile(path: string): Promise<void>;
  removeFile(path: string): void;
  getFiles(): string[];
  getContent(path: string): string;
  clear(): void;
}
```

### TokenCounter

Count tokens for different models.

```typescript
class TokenCounter {
  static count(text: string, model: string): number;
  static estimate(text: string): number;
  static truncate(text: string, maxTokens: number, model: string): string;
}
```

## 🎯 Supported AI Providers

### OpenAI

```typescript
const recoder = new RecoderCore({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4' // or gpt-3.5-turbo, gpt-4-turbo, etc.
});
```

**Supported Models:**
- gpt-4
- gpt-4-turbo
- gpt-3.5-turbo
- gpt-4o

### Anthropic (Claude)

```typescript
const recoder = new RecoderCore({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229'
});
```

**Supported Models:**
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307
- claude-2.1

### Google (Gemini)

```typescript
const recoder = new RecoderCore({
  provider: 'google',
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-pro'
});
```

**Supported Models:**
- gemini-pro
- gemini-pro-vision
- gemini-1.5-pro

### Custom Providers

```typescript
const recoder = new RecoderCore({
  provider: 'custom',
  apiKey: 'your-key',
  model: 'custom-model',
  baseURL: 'https://your-api.com'
});
```

## 📊 Usage Examples

### Example 1: Simple Chat

```typescript
import { RecoderCore } from 'recoder-code-core';

const recoder = new RecoderCore({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

const answer = await recoder.chat('What is the time complexity of quicksort?');
console.log(answer);
```

### Example 2: Streaming Response

```typescript
const stream = recoder.streamChat('Explain async/await in JavaScript');

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

### Example 3: Code Analysis with Context

```typescript
import { RecoderCore, FileContext } from 'recoder-code-core';

const recoder = new RecoderCore({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229'
});

const context = new FileContext();
await context.addFile('src/index.ts');
await context.addFile('src/utils.ts');

const review = await recoder.chat(
  'Review the code for potential issues',
  { context }
);

console.log(review);
```

### Example 4: Multi-Turn Conversation

```typescript
const recoder = new RecoderCore({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

// First message
const response1 = await recoder.chat('Create a user authentication system');

// Follow-up (maintains context)
const response2 = await recoder.chat('Add password hashing to that');

// Another follow-up
const response3 = await recoder.chat('How do I test this?');
```

### Example 5: Token Management

```typescript
import { TokenCounter } from 'recoder-code-core';

const code = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
`;

const tokens = TokenCounter.count(code, 'gpt-4');
console.log(`Tokens: ${tokens}`);

// Truncate if too long
const truncated = TokenCounter.truncate(code, 100, 'gpt-4');
```

### Example 6: Custom Configuration

```typescript
const recoder = new RecoderCore({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  maxTokens: 2000,
  temperature: 0.7,
  baseURL: 'https://custom-endpoint.com/v1'
});
```

## 🔍 Advanced Features

### Model Context Protocol (MCP)

Recoder Core supports MCP for enhanced AI capabilities:

```typescript
import { MCPClient } from 'recoder-code-core';

const mcp = new MCPClient({
  serverUrl: 'http://localhost:3000'
});

await mcp.connect();
const tools = await mcp.listTools();
const result = await mcp.callTool('search_files', { pattern: '**/*.ts' });
```

### OpenTelemetry Integration

Built-in observability with OpenTelemetry:

```typescript
import { RecoderCore, setupTelemetry } from 'recoder-code-core';

// Setup telemetry
setupTelemetry({
  serviceName: 'my-recoder-app',
  endpoint: 'http://localhost:4318'
});

const recoder = new RecoderCore({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

// All operations are automatically traced
await recoder.chat('Hello');
```

### Tree-sitter Code Parsing

Parse and analyze code structure:

```typescript
import { CodeParser } from 'recoder-code-core';

const parser = new CodeParser('typescript');
const ast = parser.parse(sourceCode);

const functions = parser.findFunctions(ast);
const imports = parser.findImports(ast);
const exports = parser.findExports(ast);
```

## ⚙️ Configuration

### Environment Variables

```bash
# AI Provider Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# OpenTelemetry (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=recoder-core

# Logging
LOG_LEVEL=info
```

### Configuration File

Create `recoder.config.js`:

```javascript
export default {
  provider: 'openai',
  model: 'gpt-4',
  maxTokens: 4000,
  temperature: 0.7,
  telemetry: {
    enabled: true,
    endpoint: 'http://localhost:4318'
  }
};
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:ci

# Type checking
npm run typecheck
```

## 📊 Performance

### Token Optimization

Recoder Core automatically optimizes token usage:
- Intelligent context pruning
- Smart truncation strategies
- Efficient prompt construction

### Caching

Built-in caching for:
- Model responses
- File contents
- Parsed syntax trees

### Streaming

Supports streaming responses for:
- Real-time feedback
- Reduced latency
- Better UX

## 🔒 Security

- API keys never logged or exposed
- No telemetry data collection by default
- Secure token management
- Input sanitization
- Rate limiting support

## 📚 Dependencies

**Core Dependencies:**
- `@google/genai` - Google AI integration
- `@modelcontextprotocol/sdk` - MCP support
- `anthropic` - Anthropic Claude integration  
- `openai` - OpenAI integration
- `tree-sitter` - Code parsing
- `zod` - Schema validation
- `@opentelemetry/*` - Observability

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🔗 Links

- **GitHub:** https://github.com/recoderxyz/recoder-code
- **CLI Package:** [recoder-code-cli](https://www.npmjs.com/package/recoder-code-cli)
- **VSCode Extension:** [Recoder Code Companion](https://marketplace.visualstudio.com/items?itemName=recoder.recoder-code-vscode-companion)
- **Website:** https://recoder.xyz
- **Documentation:** https://recoder.xyz/docs

## 📞 Support

- **Issues:** https://github.com/recoderxyz/recoder-code/issues
- **Email:** support@recoder.xyz
- **Website:** https://recoder.xyz

## 🎓 Learn More

- [CLI Usage Guide](../cli/README.md)
- [VSCode Extension Guide](../vscode-ide-companion/README.md)
- [MCP Eternos Tools](../mcp-eternos/README.md)

---

**Built with ❤️ by the Recoder Code Team**

*Empowering developers with AI*
