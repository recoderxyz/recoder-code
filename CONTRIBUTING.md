# Contributing to Recoder

Thank you for your interest in contributing to Recoder! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Coding Standards](#coding-standards)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How to Contribute

### 🐛 Reporting Bugs

- Use the GitHub Issues tracker
- Check if the bug has already been reported
- Include detailed information about the bug:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Environment details (OS, Node.js version, etc.)

### 🚀 Suggesting Features

- Use the GitHub Issues tracker with the "enhancement" label
- Clearly describe the feature and its benefits
- Include examples of how the feature would be used

### 💻 Code Contributions

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test your changes
5. Commit with a clear message
6. Push to your fork
7. Create a Pull Request

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- VS Code (for extension development)

### Getting Started

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/recoder-code.git
   cd recoder-code
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build all packages:
   ```bash
   npm run build
   ```

### Package Structure

- `cli/` - Command-line interface
- `core/` - Core functionality and shared utilities
- `vscode-ide-companion/` - VS Code extension

### Running Tests

```bash
# Run tests for all packages
npm test

# Run tests for specific package
cd cli && npm test
cd core && npm test
cd vscode-ide-companion && npm test
```

### Building Packages

```bash
# Build all packages
npm run build

# Build specific package
cd cli && npm run build
cd core && npm run build
cd vscode-ide-companion && npm run build
```

## Pull Request Process

1. **Update Documentation**: Ensure any new features are documented
2. **Update Tests**: Add tests for new functionality
3. **Update Changelog**: Add an entry to the CHANGELOG.md (if applicable)
4. **Code Review**: Your PR will be reviewed by maintainers
5. **Continuous Integration**: Ensure all CI checks pass

### PR Title Format

Use conventional commit format:
- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `test: add tests`
- `refactor: improve code structure`

## Issue Guidelines

### Bug Reports

Use this template for bug reports:

```markdown
**Bug Description**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., macOS, Windows, Linux]
- Node.js version: [e.g., 18.0.0]
- Package version: [e.g., 1.0.0]
```

### Feature Requests

Use this template for feature requests:

```markdown
**Feature Description**
A clear description of what you want to happen.

**Use Case**
Describe the use case for this feature.

**Alternatives**
Describe alternatives you've considered.

**Additional Context**
Add any other context or screenshots.
```

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for new code
- Follow ESLint configuration
- Use meaningful variable names
- Write JSDoc comments for public APIs
- Prefer async/await over Promises
- Use strict type checking

### Git Commit Messages

Follow conventional commit format:

```
type(scope): short description

Longer description if needed

Fixes #issue-number
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in objects and arrays
- Maximum line length: 100 characters
- Use meaningful function and variable names

### Testing

- Write unit tests for new functionality
- Maintain test coverage above 80%
- Use descriptive test names
- Group related tests using `describe` blocks

## Package-Specific Guidelines

### CLI Package (`cli/`)

- Commands should be intuitive and follow Unix conventions
- Include help text for all commands
- Handle errors gracefully with meaningful messages
- Support common flags like `--verbose`, `--help`, `--version`

### Core Package (`core/`)

- Keep dependencies minimal
- Write comprehensive JSDoc comments
- Export types and interfaces
- Maintain backward compatibility when possible

### VS Code Extension (`vscode-ide-companion/`)

- Follow VS Code extension guidelines
- Test on multiple VS Code versions
- Update `package.json` with proper categories and keywords
- Include proper activation events

## Getting Help

- Check existing issues and documentation first
- Join our community discussions
- Reach out to maintainers for complex questions

## Recognition

Contributors will be recognized in:
- CHANGELOG.md
- README.md contributors section
- Release notes

Thank you for contributing to Recoder! 🎉
