# Recoder Code for VS Code

**AI-Powered Coding Assistant with 12+ Providers**

The official VS Code extension for Recoder Code - brings AI assistance directly into your editor with support for OpenRouter, OpenAI, Anthropic, Ollama, and 9+ more providers.

[![Version](https://img.shields.io/visual-studio-marketplace/v/recoder.recoder-code-vscode-companion)](https://marketplace.visualstudio.com/items?itemName=recoder.recoder-code-vscode-companion)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/recoder.recoder-code-vscode-companion)](https://marketplace.visualstudio.com/items?itemName=recoder.recoder-code-vscode-companion)
[![GitHub stars](https://img.shields.io/github/stars/recoderxyz/recoder-code?style=social)](https://github.com/recoderxyz/recoder-code)

## Supported Providers

### Cloud Providers
| Provider | Models | Free Tier |
|----------|--------|-----------|
| **OpenRouter** | 200+ models | Yes |
| **OpenAI** | GPT-4, GPT-4o, o1 | No |
| **Anthropic** | Claude 3.5, Claude 4 | No |
| **Groq** | Llama, Mixtral (fast) | Yes |
| **DeepSeek** | DeepSeek V3, Coder | Yes |
| **Mistral** | Mistral, Codestral | Yes |
| **Together AI** | Open-source models | Yes |
| **Fireworks AI** | Fast inference | Yes |
| **Google Gemini** | Gemini Pro, Flash | Yes |

### Local Providers (Free, Private)
| Provider | Description |
|----------|-------------|
| **Ollama** | Run open-source models locally |
| **LM Studio** | Desktop app for local LLMs |
| **llama.cpp** | High-performance C++ inference |

## Features

### Smart File Context
- All open files tracked automatically
- Selected text sent as context
- Project structure awareness

### Native Diff Viewing
- Side-by-side code changes
- Accept/reject with one click
- Edit suggestions before accepting
- Keyboard shortcuts (Cmd+S / Ctrl+S)

### Provider Management
- Quick switch between providers
- Auto-detect local AI servers
- Configure API keys in VS Code

### Code Actions
- Explain selected code
- Refactor code
- Add comments
- Generate tests

## Quick Start

### 1. Install Extension
Search "Recoder Code" in VS Code Extensions or:
```bash
code --install-extension recoder.recoder-code-vscode-companion
```

### 2. Install CLI
```bash
npm install -g recoder-code-cli
```

### 3. Configure Provider

**Option A: Use OpenRouter (Recommended)**
1. Get free API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Run `Recoder Code: Configure Provider API Key` from Command Palette
3. Select OpenRouter and enter your key

**Option B: Use Local AI (Free, Private)**
1. Install [Ollama](https://ollama.ai) or [LM Studio](https://lmstudio.ai)
2. Run `Recoder Code: Detect Local AI`
3. Select a model

### 4. Start Coding
- Press `Cmd+Shift+P` / `Ctrl+Shift+P`
- Type "Recoder Code: Run"
- Ask the AI to help with your code

## Commands

| Command | Description |
|---------|-------------|
| `Recoder Code: Run` | Start AI session |
| `Recoder Code: List All Providers` | View all 12+ providers |
| `Recoder Code: Detect Local AI` | Find Ollama, LM Studio |
| `Recoder Code: Configure Provider` | Set API keys |
| `Recoder Code: Login` | Login to recoder.xyz |
| `Recoder Code: Browse Models` | Explore available models |
| `Recoder Code: Explain This` | Explain selected code |
| `Recoder Code: Refactor This` | Refactor selected code |
| `Recoder Code: Generate Tests` | Generate tests for code |

## Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Accept Diff | `Cmd+S` | `Ctrl+S` |
| Close Diff | `Esc` | `Esc` |

## Requirements

- VS Code 1.99.0+
- Node.js 18.0.0+
- Recoder Code CLI

## Privacy & Security

- **Local Processing:** Extension runs entirely locally
- **No Data Collection:** No telemetry or tracking
- **Local AI Option:** Use Ollama for 100% private coding
- **Open Source:** [View source code](https://github.com/recoderxyz/recoder-code)

## Links

- **Website:** [recoder.xyz](https://recoder.xyz)
- **GitHub:** [github.com/recoderxyz/recoder-code](https://github.com/recoderxyz/recoder-code)
- **Twitter:** [@recoderxyz](https://twitter.com/recoderxyz)
- **CLI Package:** [npm/recoder-code-cli](https://www.npmjs.com/package/recoder-code-cli)
- **Issues:** [Report a bug](https://github.com/recoderxyz/recoder-code/issues)
- **Discussions:** [Ask questions](https://github.com/recoderxyz/recoder-code/discussions)

## Support

- **Documentation:** [recoder.xyz/docs](https://recoder.xyz/docs)
- **Email:** support@recoder.xyz
- **Discord:** Coming soon

## Show Your Support

If you find this extension helpful:
- [Star on GitHub](https://github.com/recoderxyz/recoder-code)
- [Review on Marketplace](https://marketplace.visualstudio.com/items?itemName=recoder.recoder-code-vscode-companion)
- [Follow on Twitter](https://twitter.com/recoderxyz)

## License

Apache 2.0 - see [LICENSE](LICENSE)

---

**Built by [Recoder](https://recoder.xyz)**

*AI-powered coding for everyone*
