# Recoder Code CLI

> AI-powered coding assistant that generates production-ready code

[![npm version](https://img.shields.io/npm/v/recoder-code-cli.svg)](https://www.npmjs.com/package/recoder-code-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

### Quick Install (Recommended)

```bash
# One-line installer (macOS/Linux)
curl -fsSL https://recoder.xyz/api/install | bash
```

### Package Managers

#### npm (All platforms)
```bash
npm install -g recoder-code-cli
```

#### Homebrew (macOS/Linux)
```bash
brew install https://recoder.xyz/api/brew/recoder-code.rb
```

#### pnpm
```bash
pnpm add -g recoder-code-cli
```

#### yarn
```bash
yarn global add recoder-code-cli
```

### Manual Installation

```bash
# Clone repository
git clone https://github.com/recoder-team/recoder.git
cd recoder/packages/recoder-code/packages/cli

# Install dependencies and build
npm install
npm run build

# Link globally
npm link
```

### Docker

```bash
docker run -it --rm -v $(pwd):/workspace ghcr.io/recoder-team/recoder-code:latest
```

## Requirements

- Node.js 20+
- npm, pnpm, or yarn

## Quick Start

```bash
# Start interactive mode
recoder

# Initialize project configuration
recoder init

# Create a project plan
recoder plan create "My App" -t web-app

# Get help
recoder --help
```

## Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `recoder` | Start interactive AI chat |
| `recoder init` | Initialize `.recoder` folder |
| `recoder plan` | Project planning module |

### Planning Commands

```bash
recoder plan create <name>           # Create new plan
recoder plan create <name> -t web-app # Use template
recoder plan create <name> -i        # Interactive mode
recoder plan list                    # List all plans
recoder plan show <id>               # View plan
recoder plan scaffold <id>           # Generate folder structure
```

**Templates:** `web-app`, `api`, `cli`

### MCP Server Management

```bash
recoder mcp list                     # List configured servers
recoder mcp add <name> <cmd>         # Add server
recoder mcp remove <name>            # Remove server
recoder mcp detect                   # Auto-detect from other tools
recoder mcp detect --add             # Detect and add servers
```

### Web IDE Integration

```bash
recoder web launch                   # Open recoder.xyz
recoder web launch -n                # Create new project
recoder web list                     # List your projects
recoder web open <id>                # Open project in browser
recoder web sync <id>                # Sync local ↔ web
recoder web push <id>                # Push local to web
recoder web download <id>            # Download from web
```

### Authentication

```bash
recoder auth login                   # Login to recoder.xyz
recoder auth logout                  # Logout
recoder auth status                  # Check auth status
recoder auth whoami                  # Show current user
```

### AI Commands

```bash
recoder ai chat                      # Start AI chat
recoder ai models                    # List available models
recoder ai usage                     # Show usage stats
```

## Configuration

### `.recoder` Folder

Initialize with `recoder init`:

```
.recoder/
├── config.json    # Project configuration
├── plans/         # Project plans
├── context/       # Context files (rules, instructions)
└── cache/         # Temporary cache
```

### Settings File

Create `settings.json` in `.recoder/` or `~/.recoder/`:

```json
{
  "defaultModel": "claude-3-sonnet",
  "theme": "dark",
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

## Project Planning

Create comprehensive AI-executable plans:

```bash
# Create plan with template
recoder plan create "My SaaS" -t web-app -d "A SaaS with auth and billing"

# Generated files:
# .recoder/plans/plan-xxx.json   - Full plan data
# .recoder/plans/plan-xxx.md     - Human-readable
# .recoder/plans/plan-xxx.ai.md  - AI-executable instructions
```

Plans include:
- Technical architecture with diagrams
- Technology stack with versions
- Folder/file structure
- Implementation phases with tasks
- API design and database schema
- Dependencies and environment variables
- Step-by-step AI execution instructions

## Environment Variables

```bash
# API Keys (optional - for direct API access)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Configuration
RECODER_MODEL=claude-3-sonnet
RECODER_THEME=dark
```

## Examples

### Interactive Development

```bash
$ recoder
> Build a REST API with Express and PostgreSQL

🤖 I'll create a production-ready REST API...
```

### Project Planning

```bash
$ recoder plan create "E-commerce API" -t api
✅ Created plan: E-commerce API
   Files: .recoder/plans/plan-xxx.md

$ recoder plan scaffold plan-xxx
🏗️ Created 12 directories and files
```

### MCP Server Detection

```bash
$ recoder mcp detect
🔍 Found 3 MCP servers:
  📦 claude-server (Claude Desktop)
  📦 cursor-mcp (Cursor)
  📦 custom-tools (Project)

💡 Use --add to add all servers
```

## Troubleshooting

### Command not found

```bash
# Ensure npm global bin is in PATH
export PATH="$PATH:$(npm config get prefix)/bin"

# Or reinstall
npm install -g recoder-code-cli
```

### Node.js version

```bash
# Check version (requires 20+)
node --version

# Install with fnm
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20
fnm use 20
```

### Permission errors

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
npm install -g recoder-code-cli
```

## Links

- **Website:** https://recoder.xyz
- **Documentation:** https://recoder.xyz/docs
- **GitHub:** https://github.com/recoder-team/recoder
- **npm:** https://www.npmjs.com/package/recoder-code-cli

## License

MIT © Recoder Team
