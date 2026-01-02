# 🚀 Eternos MCP Server

**The Ultimate Developer Toolkit for AI Assistants**

Eternos is a powerful Model Context Protocol (MCP) server that provides AI assistants with advanced capabilities for web scraping, web crawling, file operations, data processing, security tools, system utilities, and comprehensive developer info gathering. Built for developers who want their AI to do more.

**✨ NEW in v2.4:** 11 new tools including DynamoDB, Redis, MySQL, AWS EC2/SQS, GCP Storage/BigQuery, and AI model integrations (OpenAI, Anthropic, Groq)! **81 total tools** - most without requiring API keys!

## 🚀 Quick Install

```bash
# Install globally
npm install -g recoder-mcp-eternos

# Or run directly with npx
npx recoder-mcp-eternos
```

## 🔗 Integration with Recoder

### recoder-code CLI
Eternos is automatically available in recoder-code CLI. The MCP client in core connects to Eternos for tool calling.

```bash
# Install recoder-code CLI
npm install -g recoder-code

# Eternos tools are available automatically
recoder-code
```

### recoder-web
Add Eternos to your MCP servers in Settings → MCP Servers:
- **Name**: Eternos
- **Command**: npx
- **Args**: -y recoder-mcp-eternos

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "eternos": {
      "command": "npx",
      "args": ["-y", "recoder-mcp-eternos"]
    }
  }
}
```

## 📑 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Connection Guide](#-connection-guide)
  - [Claude Desktop](#1-claude-desktop-recommended)
  - [Cursor IDE](#2-cursor-ide)
  - [Other MCP Clients](#3-other-mcp-clients)
- [Usage Examples](#-usage-examples)
- [Tool Categories](#-tool-categories)
- [Documentation](#-documentation)
- [Troubleshooting](#-troubleshooting)
- [Publishing](#-publishing)

## ✨ Features

### 🌐 Web & API Tools
- **fetch_url** - Advanced HTTP client with full control over headers, methods, and authentication
- **scrape_webpage** - Extract structured data from any webpage using CSS selectors
- **crawl_webpage** - 🆕 Crawl websites with depth control and content extraction
- **extract_links** - 🆕 Extract and filter links from webpages

### 🔍 Developer Info Gathering (21 NEW TOOLS!)
- **Package Registries:**
  - **search_npm** / **get_npm_package** - npm packages
  - **search_pypi** / **get_pypi_package** - 🆕 Python PyPI packages
  - **search_crates_io** / **get_crate** - 🆕 Rust crates
  - **search_packagist** - 🆕 PHP packages
  - **search_maven** - 🆕 Java Maven artifacts
  - **search_go_packages** - 🆕 Go packages

- **Container & Images:**
  - **search_docker_hub** / **get_docker_image** - 🆕 Docker images

- **AI/ML Models:**
  - **search_openrouter** / **get_model_info** - 🆕 OpenRouter AI models
  - **search_huggingface** - 🆕 Hugging Face models, datasets, spaces

- **Developer Content:**
  - **search_devto** - 🆕 Dev.to articles
  - **search_medium** - 🆕 Medium articles  
  - **search_awesome_lists** - 🆕 GitHub awesome lists
  - **get_github_trending** - 🆕 Trending GitHub repos

- **Code & APIs:**
  - **search_github** - GitHub repositories, code, issues, users
  - **get_github_repo** / **get_github_issues** - GitHub repo details
  - **search_stackoverflow** - Stack Overflow Q&A
  - **search_reddit** - Reddit discussions
  - **search_docs** - MDN, DevDocs, Node.js, Python, React
  - **get_api_info** - 🆕 Public API discovery

### 📁 File System Operations
- **search_files** - Powerful glob-based file search with ignore patterns and depth control
- **read_file_content** - Smart file reading with auto-parsing for JSON, YAML, and Markdown
- **write_file_content** - Safe file writing with automatic directory creation and backup support
- **watch_directory** - Monitor directories for file changes in real-time

### 🔄 Data Processing
- **process_json** - Query, validate, transform, and merge JSON data
- **convert_format** - Convert between JSON, YAML, CSV, XML, and Markdown formats

### 🔐 Security & Cryptography
- **hash_data** - Generate cryptographic hashes (MD5, SHA1, SHA256, SHA512, SHA3)
- **encrypt_decrypt** - AES-256-GCM encryption with secure key derivation

### 💻 Developer Utilities
- **generate_code** - Generate UUIDs, API keys, passwords, mock data, and more
- **analyze_code** - Analyze code for imports, exports, functions, and complexity
- **execute_command** - Safely execute shell commands with timeout and output capture

### 🗄️ Database Tools
- **query_sqlite** - Execute SQLite queries with prepared statement support

### ⏰ Time & Date
- **time_operations** - Advanced time operations including timezone conversions, formatting, and calculations

### 🖥️ System Information
- **get_system_info** - Retrieve OS, CPU, memory, disk, and network information

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Installation

```bash
# Navigate to the package
cd packages/mcp-eternos

# Install dependencies
npm install

# Build the project
npm run build

# Verify it works
npm start
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║   🚀 Eternos MCP Server v2.2 - Advanced Developer Tools   ║
║   📦 68 Powerful Tools for AI Assistants                  ║
║   🌟 By Recoder - https://recoder.xyz                     ║
╚════════════════════════════════════════════════════════════╝
📡 Connected via stdio transport
✨ Ready to assist!
```

Press `Ctrl+C` to stop. Now you're ready to connect it to your AI assistant!

## 🔌 Connection Guide

### 1. Claude Desktop (Recommended)

#### Step 1: Find Your Config File

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

#### Step 2: Get Absolute Path

```bash
cd /path/to/recoder-code/packages/mcp-eternos
pwd
# Copy the output - this is your absolute path
```

#### Step 3: Edit Config File

Open (or create) `claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "eternos": {
      "command": "node",
      "args": [
        "/PASTE_YOUR_ABSOLUTE_PATH_HERE/dist/index.js"
      ]
    }
  }
}
```

**Example Configuration:**
```json
{
  "mcpServers": {
    "eternos": {
      "command": "node",
      "args": [
        "/Users/yourname/code/recoder-code/packages/mcp-eternos/dist/index.js"
      ]
    }
  }
}
```

#### Step 4: Restart Claude Desktop

1. **Completely quit** Claude Desktop (⌘+Q on Mac, not just closing the window)
2. Reopen Claude Desktop
3. Look for the 🔨 (hammer) icon in the input area
4. Click it - you should see all **68 Eternos tools**!

#### Step 5: Test It!

Try asking Claude:
```
Use the get_system_info tool to show me my system information
```

Or:
```
Search npm for "react" using the search_npm tool
```

### 2. Cursor IDE

#### Option A: Via Settings UI

1. Open Cursor IDE
2. Go to Settings (`Cmd+,` or `Ctrl+,`)
3. Search for "MCP" or "Model Context Protocol"
4. Add the server configuration (see below)
5. Restart Cursor

#### Option B: Manual Configuration

Edit `~/.cursor/mcp_config.json`:

```json
{
  "mcpServers": {
    "eternos": {
      "command": "node",
      "args": [
        "/absolute/path/to/recoder-code/packages/mcp-eternos/dist/index.js"
      ]
    }
  }
}
```

**Restart Cursor** and the tools will be available in the AI assistant!

### 3. Other MCP Clients

Any MCP-compatible client can use Eternos with this standard configuration:

```json
{
  "command": "node",
  "args": ["/path/to/mcp-eternos/dist/index.js"],
  "transport": "stdio"
}
```

### 4. Global Install (After Publishing to npm)

Once published to npm, you can use:

```bash
npm install -g @recoder-code/mcp-eternos
```

Then in your config:
```json
{
  "mcpServers": {
    "eternos": {
      "command": "mcp-eternos"
    }
  }
}
```

Or use npx:
```json
{
  "mcpServers": {
    "eternos": {
      "command": "npx",
      "args": ["@recoder-code/mcp-eternos"]
    }
  }
}
```

## 📚 Usage Examples

### New in v2.2: Web Crawling

Crawl a website and extract content:

```json
{
  "name": "crawl_webpage",
  "arguments": {
    "url": "https://docs.python.org",
    "maxDepth": 2,
    "maxPages": 20,
    "sameDomain": true,
    "extractContent": true
  }
}
```

Extract links from a page:

```json
{
  "name": "extract_links",
  "arguments": {
    "url": "https://example.com",
    "filter": "internal",
    "pattern": ".*docs.*"
  }
}
```

### New in v2.2: Package Search

Search Python packages:
```json
{
  "name": "search_pypi",
  "arguments": {
    "query": "fastapi",
    "limit": 10
  }
}
```

Search Rust crates:
```json
{
  "name": "search_crates_io",
  "arguments": {
    "query": "tokio",
    "limit": 10
  }
}
```

Search Docker images:
```json
{
  "name": "search_docker_hub",
  "arguments": {
    "query": "nginx",
    "limit": 10
  }
}
```

### New in v2.2: AI Model Discovery

Find AI models on OpenRouter:
```json
{
  "name": "search_openrouter",
  "arguments": {
    "category": "chat",
    "query": "claude"
  }
}
```

Search Hugging Face:
```json
{
  "name": "search_huggingface",
  "arguments": {
    "query": "bert",
    "type": "models",
    "limit": 10
  }
}
```

### New in v2.2: Developer Content

Get trending GitHub repos:
```json
{
  "name": "get_github_trending",
  "arguments": {
    "language": "python",
    "since": "daily"
  }
}
```

Search Dev.to articles:
```json
{
  "name": "search_devto",
  "arguments": {
    "tag": "javascript",
    "limit": 10
  }
}
```

Find awesome lists:
```json
{
  "name": "search_awesome_lists",
  "arguments": {
    "topic": "machine-learning",
    "limit": 10
  }
}
```

### Web Scraping

Extract article titles and links from a news site:

```json
{
  "name": "scrape_webpage",
  "arguments": {
    "url": "https://news.ycombinator.com",
    "selectors": {
      "titles": ".titleline > a",
      "links": ".titleline > a"
    },
    "extract": "attr",
    "attribute": "href"
  }
}
```

### File Search

Find all TypeScript files excluding tests:

```json
{
  "name": "search_files",
  "arguments": {
    "pattern": "**/*.ts",
    "ignore": ["**/*.test.ts", "**/*.spec.ts", "node_modules/**"]
  }
}
```

### API Requests

Make authenticated API calls:

```json
{
  "name": "fetch_url",
  "arguments": {
    "url": "https://api.github.com/user/repos",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN",
      "Accept": "application/vnd.github.v3+json"
    }
  }
}
```

### Data Conversion

Convert YAML to JSON:

```json
{
  "name": "convert_format",
  "arguments": {
    "input": "name: John\nage: 30\ncity: NYC",
    "from": "yaml",
    "to": "json"
  }
}
```

### Generate Secure Passwords

```json
{
  "name": "generate_code",
  "arguments": {
    "type": "password",
    "count": 5,
    "options": {
      "length": 24
    }
  }
}
```

### Hash Data

```json
{
  "name": "hash_data",
  "arguments": {
    "data": "sensitive-data",
    "algorithm": "sha256",
    "encoding": "hex"
  }
}
```

### System Information

```json
{
  "name": "get_system_info",
  "arguments": {
    "info": ["os", "cpu", "memory"]
  }
}
```

### Time Operations

```json
{
  "name": "time_operations",
  "arguments": {
    "operation": "now",
    "timezone": "America/New_York"
  }
}
```

## 🎯 Use Cases

### For Developers
- **API Testing**: Quickly test REST APIs with custom headers and authentication
- **Web Scraping**: Extract data from websites for analysis or monitoring
- **File Management**: Search, read, and write files with advanced patterns
- **Code Generation**: Generate UUIDs, API keys, and secure passwords
- **Data Transformation**: Convert between different data formats seamlessly

### For DevOps
- **System Monitoring**: Get real-time system information
- **Log Analysis**: Search and process log files
- **Configuration Management**: Read and write config files in various formats
- **Security**: Hash and encrypt sensitive data

### For Data Scientists
- **Data Processing**: Transform and validate JSON/YAML data
- **File Operations**: Batch process files with glob patterns
- **Format Conversion**: Convert between CSV, JSON, and other formats

## 🏗️ Architecture

```
eternos/
├── Web & API Layer
│   ├── HTTP Client (axios)
│   └── Web Scraper (cheerio)
├── File System Layer
│   ├── Glob Search (fast-glob)
│   └── File Watcher (chokidar)
├── Data Processing Layer
│   ├── JSON/YAML Parser
│   └── Format Converter (marked, js-yaml)
├── Security Layer
│   ├── Crypto (Node.js crypto)
│   └── Hash Functions
└── System Layer
    ├── OS Information
    └── Command Execution
```

## 🔒 Security

- **Safe Command Execution**: Commands run with timeout protection
- **Input Validation**: All inputs validated with Zod schemas
- **Secure Encryption**: AES-256-GCM with proper key derivation
- **No Arbitrary Code Execution**: Controlled tool execution only

## 🚀 Performance

- **Async/Await**: Non-blocking operations throughout
- **Streaming**: Large file support with streaming
- **Caching**: Smart caching for repeated operations
- **Timeout Protection**: All network operations have configurable timeouts

## 📊 Tool Categories

| Category | Tool Count | Use Cases |
|----------|------------|-----------|
| **Web** | 4 | fetch_url, scrape_webpage, crawl_webpage, extract_links |
| **Files** | 4 | search_files, read_file_content, write_file_content, watch_directory |
| **Data** | 6 | process_json, convert_format, analyze_csv, merge_datasets, data_validation |
| **Security** | 2 | hash_data, encrypt_decrypt |
| **Dev Utils** | 5 | generate_code, analyze_code, find_functions, count_loc, complexity_analysis |
| **System** | 2 | get_system_info, execute_command |
| **Database** | 1 | query_sqlite |
| **Time** | 1 | time_operations |
| **Git** | 9 | clone, status, add, commit, diff, log, branch, push, pull |
| **Batch Ops** | 4 | batch_read_files, batch_process, find_duplicates, download_file |
| **Text** | 2 | text_search, text_replace |
| **Images** | 3 | resize_image, optimize_image, get_image_metadata |
| **Developer Info** | 29 | npm, PyPI, crates.io, Docker Hub, OpenRouter, Hugging Face, GitHub, Stack Overflow, Reddit, Dev.to, Medium, Maven, Packagist, Go packages, APIs, and more |

**Total: 68 Tools** 🎉

## 📖 Documentation

### Complete Guides

- **[CONNECTION_GUIDE.md](CONNECTION_GUIDE.md)** - Detailed connection instructions for Claude Desktop, Cursor, and other clients
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick syntax reference for all 68 tools
- **[NEW_FEATURES.md](NEW_FEATURES.md)** - What's new in v2.2 with detailed examples
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Complete installation and troubleshooting guide
- **[TOOLS_OVERVIEW.md](TOOLS_OVERVIEW.md)** - Complete tool catalog with use cases
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

### Tool Documentation

- **[TOOL_SPECIFICATIONS.md](TOOL_SPECIFICATIONS.md)** - Complete tool schemas and parameters
- **[examples/](examples/)** - Configuration examples and usage patterns

## 🔧 Troubleshooting

### Tools Not Showing in Claude Desktop?

1. **Check path is absolute** - Must start with `/` (Mac/Linux) or `C:\` (Windows)
2. **Did you save the config?** - Make sure `claude_desktop_config.json` is saved
3. **Did you restart?** - Must completely quit Claude Desktop (⌘+Q), not just close
4. **Check logs** - Look in `~/Library/Logs/Claude/mcp*.log` (Mac)

### "Command not found" Error?

```bash
# Find your node path
which node

# Use full path in config
"command": "/usr/local/bin/node"
```

### "Module not found" Error?

```bash
cd /path/to/mcp-eternos
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Permission Denied?

```bash
chmod +x /path/to/mcp-eternos/dist/index.js
```

### Check Node.js Version

```bash
node --version  # Must be >= 18.0.0
```

### Test Server Directly

```bash
cd /path/to/mcp-eternos
npm start
# Should show the v2.2 banner with 68 tools
```

### Use MCP Inspector for Testing

```bash
npx @modelcontextprotocol/inspector node /path/to/mcp-eternos/dist/index.js
```

This opens a web interface to test all tools interactively.

### More Help

- See [SETUP_GUIDE.md](SETUP_GUIDE.md) for comprehensive troubleshooting
- Check [CONNECTION_GUIDE.md](CONNECTION_GUIDE.md) for platform-specific instructions
- Review [examples/](examples/) for working configurations

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode (watch)
npm run dev

# Run
npm start
```

## 📝 Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

## 📦 Publishing

Ready to publish to npm! See [PUBLISHING_GUIDE.md](PUBLISHING_GUIDE.md) for details.

**Quick publish:**
```bash
npm login
npm publish
```

## ✨ What Makes Eternos Special

### 🆓 No API Keys Required
Every single tool works without requiring API keys or paid services. Completely free forever.

### 🌍 Comprehensive Coverage
- **6 Package Ecosystems**: npm, PyPI, Crates.io, Maven, Packagist, Go
- **3 AI/ML Platforms**: OpenRouter, Hugging Face, model info
- **5 Developer Platforms**: GitHub, Stack Overflow, Dev.to, Medium, Reddit
- **All Major Languages**: JavaScript, Python, Rust, PHP, Java, Go

### 🔒 Privacy & Security
- No data collection or telemetry
- All operations run locally
- Input validation on all tools
- Safe command execution
- Open source MIT license

### 🚀 Production Ready
- TypeScript with full type safety
- Comprehensive error handling
- Timeout protection on all network requests
- 68 thoroughly tested tools
- Extensive documentation

### 🎯 Built for AI Assistants
- Designed for Claude Desktop and Cursor
- Compatible with any MCP client
- Follows MCP protocol standards
- Clean JSON-RPC 2.0 interface

## 🎓 Example Workflows

### Research a New Technology

1. **Find awesome list**: `search_awesome_lists` for curated resources
2. **Check trending**: `get_github_trending` to see what's popular
3. **Read articles**: `search_devto` for tutorials
4. **Explore packages**: `search_npm`, `search_pypi`, etc.

### Compare AI Models

1. **Browse models**: `search_openrouter` by category
2. **Get details**: `get_model_info` for pricing and specs
3. **Check alternatives**: `search_huggingface` for open source options

### Analyze a Codebase

1. **Find files**: `search_files` with glob patterns
2. **Count LOC**: `count_loc` for statistics
3. **Find functions**: `find_functions` to extract all functions
4. **Check complexity**: `complexity_analysis` for code health

### Web Research

1. **Search**: `search_web` across multiple engines
2. **Crawl**: `crawl_webpage` to extract content
3. **Extract links**: `extract_links` for navigation
4. **Scrape data**: `scrape_webpage` with CSS selectors

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Recoder Code](https://recoder.xyz)

## 💡 Tips

1. **Combine Tools**: Chain multiple tools together for complex workflows
2. **Use Glob Patterns**: Master glob patterns for powerful file searches
3. **Secure Your Data**: Always use encryption for sensitive information
4. **Monitor Performance**: Use system info tools to track resource usage
5. **Automate Tasks**: Combine file watching with command execution for automation
6. **Research Efficiently**: Use package search tools to find libraries across ecosystems
7. **Stay Updated**: Use trending and search tools to discover new technologies

## ℹ️ Version Information

**Current Version:** 2.2.0

**What's New in v2.2:**
- ✅ 17 new tools added (51 → 68 tools)
- ✅ Web crawling with `crawl_webpage` and `extract_links`
- ✅ Python PyPI package search
- ✅ Rust Crates.io search
- ✅ Docker Hub image search
- ✅ OpenRouter AI model discovery
- ✅ Hugging Face integration
- ✅ Dev.to and Medium article search
- ✅ GitHub trending repos
- ✅ Maven, Packagist, Go package search
- ✅ Public API discovery
- ✅ Enhanced web search with better parsing
- ✅ Zero breaking changes - fully backward compatible

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## ✅ Verification

To verify your installation is working:

```bash
# 1. Check build
cd /path/to/mcp-eternos
npm run build
# Should complete without errors

# 2. Test server
npm start
# Should show:
# 🚀 Eternos MCP Server v2.2 - Advanced Developer Tools
# 📦 68 Powerful Tools for AI Assistants

# 3. Test with MCP Inspector (optional)
npx @modelcontextprotocol/inspector node dist/index.js
# Opens web interface to test tools

# 4. Check in Claude Desktop
# Look for 🔨 icon - should show 68 tools
```

## 📊 Statistics

- **Package Size**: 78.9 KB (compressed)
- **Unpacked Size**: 392.5 KB
- **Total Tools**: 68
- **Dependencies**: 13
- **Documentation Files**: 13
- **Lines of Code**: ~3,500
- **TypeScript**: 100%
- **Test Coverage**: Extensive
- **License**: MIT

## 🎓 Examples Repository

Check out the `examples/` directory for more advanced usage patterns and real-world scenarios.

---

**Built with ❤️ by the Recoder Code Team**

*Eternos - Empowering AI assistants with developer superpowers*
