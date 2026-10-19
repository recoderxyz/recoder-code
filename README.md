#  Recoder Code - AI-Powered Development Tools

[![npm version](https://badge.fury.io/js/recoder-code.svg)](https://www.npmjs.com/package/recoder-code)
[![License: Apache-2.0 / MIT](https://img.shields.io/badge/License-Apache--2.0%20%2F%20MIT-yellow.svg)](./NOTICE)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://marketplace.visualstudio.com/items?itemName=recoder.vscode-ide-companion)

## Overview

Recoder Code is an open-source AI-powered development toolkit that brings the best AI models directly to your terminal and IDE. Unlike other AI coding assistants, Recoder Code offers:

### Relationship to recoder.xyz

Recoder Code (this repo) is the free, standalone agent harness: a terminal CLI plus
core library that talks directly to the AI provider of your choice (OpenRouter, your
own Anthropic/OpenAI/Google keys, or a local Ollama) with no account required. It has
no dependency on any hosted service.

[recoder.xyz](https://recoder.xyz) is a separate, hosted product built on top of this
harness — parallel agent workspaces, governed merges, team policy and audit, and a
desktop app. `recoder auth login` is optional and only needed if you want to use that
hosted layer; everything else in this repo runs fully standalone, BYOK, local-first.

- **🌐 Universal AI Support**: OpenRouter (350+ models), Anthropic Claude, OpenAI, Gemini, Groq, Ollama, and custom providers
- **🔧 Local AI Ready**: Built-in Ollama support for privacy-focused local AI
- **🎯 Agent System**: Specialized AI agents (explorer, planner, coder, reviewer, tester, documenter)
- **💻 Terminal + IDE**: Seamless CLI experience with optional VS Code integration
- **🔐 BYOK (Bring Your Own Key)**: Use your own API keys, no vendor lock-in

## 📦 Packages

This monorepo contains three main packages:

### 1. 🖥️ CLI (`cli/`) 
**The main user-facing terminal application**
- React/Ink-based interactive terminal UI
- 50+ slash commands and built-in tools
- Multi-provider AI support with automatic fallbacks
- Vim mode, themes, and full customization
- Project sync with web platform

**Install:**
```bash
npm install -g recoder-code
recoder auth login  # Optional: sync with recoder.xyz
```

### 2. ⚙️ Core (`core/`) 
**Shared foundation library**
- AI provider abstraction layer
- Tool system (20+ built-in tools: file ops, shell, git, web-fetch, MCP)
- Agent framework for autonomous task execution
- OAuth PKCE authentication
- Model Context Protocol (MCP) integration

### 3. 🔌 VS Code Extension (`vscode-ide-companion/`)
**IDE integration (coming to marketplace soon)**
- Native VS Code diff views for AI changes
- Sidebar for model selection and usage tracking
- Code actions: explain, refactor, add comments, generate tests
- Chat panel with conversation history
- Bridge between CLI and IDE context

## 🚀 Quick Start

### Terminal CLI
```bash
# Install globally
npm install -g recoder-code

# Start interactive session
recoder

# Quick AI query
recoder "explain this function" --file ./src/utils.js

# Use specific model
recoder /model claude-3-5-sonnet-20241022 "refactor this code"

# Local AI with Ollama
recoder /ollama llama3.2 "help me debug this"
```

### Adding Custom Providers
```bash
# Interactive provider setup
recoder /connect

# Configure LM Studio (local)
recoder /connect lmstudio http://localhost:1234/v1

# Add custom OpenAI-compatible API
recoder /connect custom https://my-api.com/v1 your-api-key
```

### Agent System
```bash
# List available agents
recoder /agents

# Use explorer agent for codebase analysis
recoder /agent explorer "analyze this React project structure"

# Create custom agent
recoder /agent create --name "security-reviewer" --prompt "Focus on security vulnerabilities"
```

## 🛠️ Development

### Setup
```bash
# Clone the repository
git clone https://github.com/recoderxyz/recoder-code.git
cd recoder-code

# Install dependencies
npm install

# Build all packages
npm run build

# Test the CLI locally
cd cli && npm link
recoder --version
```

### Package Scripts
```bash
# Build all packages
npm run build

# Run tests
npm test

# Development mode
npm run dev

# Lint and format
npm run lint
npm run format
```

## 🔧 Configuration

Recoder Code stores configuration in `~/.recoder-code/`:

```
~/.recoder-code/
├── config.json          # Main configuration
├── auth.json            # Authentication tokens (encrypted)
├── providers/           # Custom provider configurations
│   ├── lmstudio.json
│   ├── vllm.json
│   └── custom-api.json
└── agents/              # Custom agent definitions
    └── my-agent.json
```

### Provider Configuration Example
```json
{
  "name": "LM Studio",
  "type": "openai-compatible",
  "baseUrl": "http://localhost:1234/v1",
  "apiKey": "lm-studio",
  "models": ["llama-3.2-3b-instruct"]
}
```

## 🌟 Features

### AI Providers Supported
- **OpenRouter**: 350+ models (Claude, GPT-4, Gemini, Llama, etc.)
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5
- **Google**: Gemini Pro, Gemini Ultra
- **Groq**: Fast inference for Llama, Mistral, Gemma
- **Ollama**: Local models (Llama 3.2, CodeLlama, Mistral, etc.)
- **Custom**: Any OpenAI-compatible API

### Built-in Tools
- **File Operations**: read, write, edit files with intelligent diffs
- **Shell Integration**: Execute commands with approval system
- **Git Operations**: Commit, status, diff, branch management
- **Web Tools**: Fetch URLs, search the web
- **Code Analysis**: Grep, find, analyze project structure
- **MCP Support**: Model Context Protocol for external integrations

### Agent System
- **Explorer**: Analyze codebases and provide insights
- **Planner**: Break down complex tasks into steps
- **Coder**: Focus on code implementation
- **Reviewer**: Review code for best practices and bugs
- **Tester**: Generate and improve test coverage
- **Documenter**: Create and maintain documentation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Areas where we need help:
1. **Provider Integrations**: Add support for new AI providers
2. **Agent Templates**: Create specialized agents for different use cases
3. **VS Code Features**: Enhance the IDE integration
4. **Documentation**: Improve guides and examples
5. **Testing**: Expand test coverage

## 📄 License

This repo is multi-licensed per package, matching how it was built:

- `cli/` and `core/` — **Apache-2.0**. Both are built on top of (and retain the
  original per-file `@license` headers from) Google's
  [gemini-cli](https://github.com/google-gemini/gemini-cli) (Code Assist /
  Gemini OAuth integration) and Alibaba's
  [qwen-code](https://github.com/QwenLM/qwen-code) (Qwen OAuth device-flow
  integration). See [NOTICE](NOTICE) for the full attribution.
- `vscode-ide-companion/` — **Apache-2.0**, same lineage.
- `mcp-eternos/` — **MIT**, original Recoder work.
- This top-level `LICENSE` file (MIT) covers Recoder's own original aggregate
  work (CLI UX, provider routing, agent system, docs) and does not relicense
  the Apache-2.0 files above — their own headers and `NOTICE` govern them.

## 🔗 Links

- **Website**: [recoder.xyz](https://recoder.xyz)
- **GitHub**: [recoderxyz/recoder-code](https://github.com/recoderxyz/recoder-code)
- **Documentation**: [docs.recoder.xyz](https://docs.recoder.xyz) 
- **Discord**: [Join our community](https://discord.gg/recoder)
- **NPM Package**: [recoder-code](https://www.npmjs.com/package/recoder-code)
- **VS Code Extension**: [Coming Soon](https://marketplace.visualstudio.com/)

## 🙏 Acknowledgments

Recoder Code is built on real open-source foundations, credited honestly (full
detail in [NOTICE](NOTICE)):

- [**gemini-cli**](https://github.com/google-gemini/gemini-cli) (Google, Apache-2.0)
  — the Code Assist / Gemini OAuth integration in `core/src/code_assist/`.
- [**qwen-code**](https://github.com/QwenLM/qwen-code) (Alibaba/Qwen, Apache-2.0)
  — the Qwen OAuth device-flow integration in `core/src/qwen/`.
- The ~85% of `core/` and `cli/` beyond those two integrations, `mcp-eternos/`,
  and the VS Code companion's Recoder-specific commands are original Recoder
  work.
- Contributors and users who help make this project better.

---

**Ready to supercharge your coding with AI?** ⚡

```bash
npm install -g recoder-code
recoder
```
