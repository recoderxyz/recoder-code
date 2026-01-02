/**
 * Code Lens Commands
 * Handles actions triggered from CodeLens clicks
 */

import * as vscode from 'vscode';
import { ProviderService } from '../../services/ProviderService.js';
import { AIService } from '../../services/AIService.js';

/**
 * Register all CodeLens commands
 */
export function registerCodeLensCommands(
  context: vscode.ExtensionContext
): vscode.Disposable[] {
  const providerService = new ProviderService(context);
  const aiService = new AIService(providerService);

  return [
    // 🤖 Explain command
    vscode.commands.registerCommand(
      'recoder.codelens.explain',
      async (uri: vscode.Uri, range: vscode.Range, symbolName: string) => {
        await executeCodeLensAction(uri, range, symbolName, 'explain', aiService, providerService);
      }
    ),

    // ⚡ Refactor command
    vscode.commands.registerCommand(
      'recoder.codelens.refactor',
      async (uri: vscode.Uri, range: vscode.Range, symbolName: string) => {
        await executeCodeLensAction(uri, range, symbolName, 'refactor', aiService, providerService);
      }
    ),

    // 🧪 Generate Tests command
    vscode.commands.registerCommand(
      'recoder.codelens.generateTests',
      async (uri: vscode.Uri, range: vscode.Range, symbolName: string) => {
        await executeCodeLensAction(uri, range, symbolName, 'generateTests', aiService, providerService);
      }
    ),

    // 📝 Add Comments command
    vscode.commands.registerCommand(
      'recoder.codelens.addComments',
      async (uri: vscode.Uri, range: vscode.Range, symbolName: string) => {
        await executeCodeLensAction(uri, range, symbolName, 'addComments', aiService, providerService);
      }
    ),

    // 💬 Ask AI command
    vscode.commands.registerCommand(
      'recoder.codelens.askAI',
      async (uri: vscode.Uri, range: vscode.Range, symbolName: string) => {
        // Ask user for custom question
        const question = await vscode.window.showInputBox({
          prompt: `Ask AI about "${symbolName}"`,
          placeHolder: 'What would you like to know about this code?'
        });

        if (question) {
          await executeCodeLensAction(uri, range, symbolName, 'askAI', aiService, providerService, question);
        }
      }
    ),

    // Toggle CodeLens
    vscode.commands.registerCommand('recoder.codelens.toggle', async () => {
      const config = vscode.workspace.getConfiguration('recoderCode');
      const currentValue = config.get('enableCodeLens', true);
      await config.update('enableCodeLens', !currentValue, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Recoder Code Lens ${!currentValue ? 'enabled' : 'disabled'}`
      );
    })
  ];
}

/**
 * Execute a CodeLens action
 */
async function executeCodeLensAction(
  uri: vscode.Uri,
  range: vscode.Range,
  symbolName: string,
  action: 'explain' | 'refactor' | 'generateTests' | 'addComments' | 'askAI',
  aiService: AIService,
  providerService: ProviderService,
  customQuestion?: string
): Promise<void> {
  const document = await vscode.workspace.openTextDocument(uri);
  
  // Get the full symbol content (expand range to include full body)
  const fullRange = await getFullSymbolRange(document, range);
  const code = document.getText(fullRange);
  const language = document.languageId;
  const fileName = document.fileName.split('/').pop() || 'unknown';

  // Check if provider is configured
  const config = providerService.getAIConfiguration();
  const providers = providerService.getAllProviders();
  const currentProvider = providers.find(p => p.id === config.defaultProvider);

  if (currentProvider && !currentProvider.isLocal && !providerService.hasApiKey(currentProvider)) {
    const configureNow = await vscode.window.showWarningMessage(
      `No API key configured for ${currentProvider.name}. Configure now?`,
      'Open Settings',
      'Cancel'
    );
    if (configureNow === 'Open Settings') {
      await vscode.commands.executeCommand('recoder.settings.open');
    }
    return;
  }

  const actionTitles: Record<string, string> = {
    explain: '🤖 Explaining',
    refactor: '⚡ Refactoring',
    generateTests: '🧪 Generating Tests',
    addComments: '📝 Adding Comments',
    askAI: '💬 Asking AI'
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `${actionTitles[action]} "${symbolName}"...`,
      cancellable: false
    },
    async () => {
      try {
        const prompt = buildPrompt(action, code, language, symbolName, fileName, customQuestion);
        
        const completion = await aiService.chat([
          { role: 'user', content: prompt }
        ]);

        const response = completion.choices[0]?.message?.content || 'No response generated';

        // Handle the response based on action type
        await handleResponse(action, response, document, fullRange, symbolName, currentProvider?.name || config.defaultProvider);

      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to ${action}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

/**
 * Build the AI prompt based on action type
 */
function buildPrompt(
  action: string,
  code: string,
  language: string,
  symbolName: string,
  fileName: string,
  customQuestion?: string
): string {
  const codeBlock = `\`\`\`${language}\n${code}\n\`\`\``;

  switch (action) {
    case 'explain':
      return `Explain the following ${language} code "${symbolName}" from ${fileName}:

${codeBlock}

Provide a clear, concise explanation covering:
1. What this code does (purpose)
2. How it works (implementation details)
3. Key patterns or techniques used
4. Any potential issues or improvements`;

    case 'refactor':
      return `Refactor the following ${language} code "${symbolName}" from ${fileName} to improve:
- Code readability
- Performance (if applicable)
- Best practices adherence
- Maintainability

${codeBlock}

Provide:
1. The refactored code
2. Explanation of changes made
3. Why each change improves the code`;

    case 'generateTests':
      return `Generate comprehensive unit tests for the following ${language} function "${symbolName}" from ${fileName}:

${codeBlock}

Create tests that cover:
1. Normal/happy path cases
2. Edge cases
3. Error conditions
4. Boundary values

Use appropriate testing framework for ${language} (Jest for JS/TS, pytest for Python, etc.)`;

    case 'addComments':
      return `Add clear, helpful comments to the following ${language} code "${symbolName}" from ${fileName}:

${codeBlock}

Add:
1. JSDoc/docstring style documentation at the top
2. Inline comments for complex logic
3. Parameter and return value descriptions
4. Any important notes or warnings

Return the fully commented code.`;

    case 'askAI':
      return `About this ${language} code "${symbolName}" from ${fileName}:

${codeBlock}

User question: ${customQuestion}

Please provide a helpful, detailed answer.`;

    default:
      return `Analyze the following code:\n\n${codeBlock}`;
  }
}

/**
 * Handle AI response based on action type
 */
async function handleResponse(
  action: string,
  response: string,
  document: vscode.TextDocument,
  range: vscode.Range,
  symbolName: string,
  providerName: string
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('Recoder Code');

  switch (action) {
    case 'explain':
      // Show explanation in output channel
      outputChannel.clear();
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.appendLine(`🤖 Explanation of "${symbolName}" (via ${providerName})`);
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.appendLine('');
      outputChannel.appendLine(response);
      outputChannel.appendLine('');
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.show();
      break;

    case 'refactor':
    case 'addComments':
      // Extract code from response and offer to apply
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeMatch) {
        const newCode = codeMatch[1].trim();
        const apply = await vscode.window.showInformationMessage(
          `${action === 'refactor' ? 'Refactored' : 'Commented'} code ready. Apply changes?`,
          'Apply',
          'Preview',
          'Cancel'
        );

        if (apply === 'Apply') {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, range, newCode);
          await vscode.workspace.applyEdit(edit);
          vscode.window.showInformationMessage('Changes applied!');
        } else if (apply === 'Preview') {
          outputChannel.clear();
          outputChannel.appendLine('═'.repeat(80));
          outputChannel.appendLine(`Preview: ${action === 'refactor' ? 'Refactored' : 'Commented'} "${symbolName}"`);
          outputChannel.appendLine('═'.repeat(80));
          outputChannel.appendLine('');
          outputChannel.appendLine(response);
          outputChannel.appendLine('');
          outputChannel.show();
        }
      } else {
        // No code block found, show full response
        outputChannel.clear();
        outputChannel.appendLine(response);
        outputChannel.show();
      }
      break;

    case 'generateTests':
      // Show tests and offer to create file
      outputChannel.clear();
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.appendLine(`🧪 Generated Tests for "${symbolName}" (via ${providerName})`);
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.appendLine('');
      outputChannel.appendLine(response);
      outputChannel.appendLine('');
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.show();

      // Offer to create test file
      const createFile = await vscode.window.showInformationMessage(
        'Tests generated! Create test file?',
        'Create File',
        'Copy to Clipboard',
        'Cancel'
      );

      if (createFile === 'Create File') {
        const testCode = response.match(/```[\w]*\n([\s\S]*?)```/)?.[1] || response;
        const testUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(document.fileName.replace(/\.(ts|js|py|java)$/, '.test.$1')),
          filters: { 'Test Files': ['ts', 'js', 'py', 'java'] }
        });
        if (testUri) {
          await vscode.workspace.fs.writeFile(testUri, Buffer.from(testCode));
          await vscode.window.showTextDocument(testUri);
        }
      } else if (createFile === 'Copy to Clipboard') {
        const testCode = response.match(/```[\w]*\n([\s\S]*?)```/)?.[1] || response;
        await vscode.env.clipboard.writeText(testCode);
        vscode.window.showInformationMessage('Tests copied to clipboard!');
      }
      break;

    case 'askAI':
      // Show answer in output channel
      outputChannel.clear();
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.appendLine(`💬 AI Response about "${symbolName}" (via ${providerName})`);
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.appendLine('');
      outputChannel.appendLine(response);
      outputChannel.appendLine('');
      outputChannel.appendLine('═'.repeat(80));
      outputChannel.show();
      break;
  }
}

/**
 * Get the full range of a symbol (including its body)
 */
async function getFullSymbolRange(
  document: vscode.TextDocument,
  startRange: vscode.Range
): Promise<vscode.Range> {
  const text = document.getText();
  const startOffset = document.offsetAt(startRange.start);
  
  // Find the opening brace/colon and matching closing brace
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let foundStart = false;
  let endOffset = startOffset;

  // Determine language-specific block delimiters
  const languageId = document.languageId;
  const useIndentation = languageId === 'python' || languageId === 'yaml';

  if (useIndentation) {
    // Python/YAML: use indentation-based detection
    const lines = text.split('\n');
    const startLine = startRange.start.line;
    const startIndent = lines[startLine].search(/\S/);
    
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.search(/\S/);
      
      // Skip empty lines
      if (indent === -1) continue;
      
      // If we hit a line with same or less indentation, we're done
      if (indent <= startIndent) {
        endOffset = document.offsetAt(new vscode.Position(i - 1, lines[i - 1].length));
        break;
      }
      
      // Keep tracking the end
      endOffset = document.offsetAt(new vscode.Position(i, line.length));
    }
  } else {
    // Brace-based languages
    for (let i = startOffset; i < text.length; i++) {
      const char = text[i];
      
      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && text[i - 1] !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          endOffset = i + 1;
          break;
        }
      }
    }
  }

  return new vscode.Range(
    startRange.start,
    document.positionAt(endOffset)
  );
}
