/**
 * Chat Panel WebView
 * Provides AI chat interface with OpenRouter
 */

import * as vscode from 'vscode';
import { OpenRouterService } from '../services/OpenRouterService.js';
import type { RecoderAuthService } from '../services/RecoderAuthService.js';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export class ChatPanel {
  private static currentPanel: ChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private conversationHistory: ChatMessage[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    private authService: RecoderAuthService
  ) {
    this.panel = panel;

    // Load conversation history from storage
    this.conversationHistory =
      this.context.workspaceState.get<ChatMessage[]>('recoder.chatHistory') || [];

    // Set initial HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Send existing history to webview
    if (this.conversationHistory.length > 0) {
      this.panel.webview.postMessage({
        type: 'loadHistory',
        messages: this.conversationHistory,
      });
    }

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'sendMessage':
            await this.handleSendMessage(message.text, message.includeFile);
            break;
          case 'clearHistory':
            await this.clearHistory();
            break;
          case 'copyCode':
            await vscode.env.clipboard.writeText(message.code);
            vscode.window.showInformationMessage('Code copied to clipboard');
            break;
        }
      },
      null,
      this.disposables
    );

    // Save history when panel is closed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    authService: RecoderAuthService
  ): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'recoderChat',
      'Recoder Code Chat',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, context, authService);
  }

  private async handleSendMessage(userMessage: string, includeFile: boolean): Promise<void> {
    const isAuth = await this.authService.isAuthenticated();
    if (!isAuth) {
      this.panel.webview.postMessage({
        type: 'error',
        text: 'Please login first',
      });
      return;
    }

    let fullMessage = userMessage;

    // Include current file context if requested
    if (includeFile) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const selection = editor.selection;
        const selectedText = document.getText(selection);
        const fileContext = selectedText || document.getText();
        const fileName = document.fileName.split('/').pop();
        const language = document.languageId;

        fullMessage = `File: ${fileName} (${language})\n\n\`\`\`${language}\n${fileContext}\n\`\`\`\n\n${userMessage}`;
      }
    }

    const selectedModel =
      this.context.globalState.get<string>('recoder.selectedModel') ||
      'anthropic/claude-3.5-sonnet';

    try {
      // Add user message to history
      const userMsg: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(userMsg);

      // Show user message
      this.panel.webview.postMessage({
        type: 'userMessage',
        text: userMessage,
        includeFile,
      });

      // Show typing indicator
      this.panel.webview.postMessage({ type: 'typing', isTyping: true });

      // Create OpenRouter service
      const apiKey = await this.authService.getOpenRouterApiKey();
      if (!apiKey) {
        this.panel.webview.postMessage({
          type: 'error',
          text: 'No OpenRouter API key available. Please set your API key.',
        });
        this.panel.webview.postMessage({ type: 'typing', isTyping: false });
        return;
      }
      const service = new OpenRouterService(apiKey);

      // Build messages array from conversation history
      const messages = this.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Send request
      const completion = await service.chat(selectedModel, messages, { stream: false });

      // Hide typing indicator
      this.panel.webview.postMessage({ type: 'typing', isTyping: false });

      // Check if it's a non-stream completion
      if ('choices' in completion) {
        const assistantMessage = completion.choices[0]?.message?.content || 'No response';

        // Add assistant message to history
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: assistantMessage,
          timestamp: Date.now(),
          tokens: completion.usage
            ? {
                prompt: completion.usage.prompt_tokens || 0,
                completion: completion.usage.completion_tokens || 0,
                total: completion.usage.total_tokens || 0,
              }
            : undefined,
        };
        this.conversationHistory.push(assistantMsg);

        // Save history
        await this.saveHistory();

        // Show assistant message
        this.panel.webview.postMessage({
          type: 'assistantMessage',
          text: assistantMessage,
          model: selectedModel,
          usage: completion.usage,
        });
      }
    } catch (error) {
      this.panel.webview.postMessage({ type: 'typing', isTyping: false });
      this.panel.webview.postMessage({
        type: 'error',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private async clearHistory(): Promise<void> {
    this.conversationHistory = [];
    await this.context.workspaceState.update('recoder.chatHistory', []);
    this.panel.webview.postMessage({ type: 'historyCleared' });
  }

  private async saveHistory(): Promise<void> {
    await this.context.workspaceState.update('recoder.chatHistory', this.conversationHistory);
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recoder Code Chat</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js"></script>
  <style>
    body {
      padding: 20px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .header h2 {
      margin: 0;
    }
    .header-actions {
      display: flex;
      gap: 10px;
    }
    .header-actions button {
      padding: 5px 10px;
      font-size: 12px;
    }
    #messages {
      height: calc(100vh - 200px);
      overflow-y: auto;
      margin-bottom: 20px;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .message {
      margin-bottom: 20px;
      padding: 12px;
      border-radius: 6px;
      position: relative;
    }
    .user-message {
      background-color: var(--vscode-input-background);
      margin-left: 20%;
      border-left: 3px solid var(--vscode-textLink-foreground);
    }
    .assistant-message {
      background-color: var(--vscode-editor-selectionBackground);
      margin-right: 20%;
      border-left: 3px solid var(--vscode-charts-green);
    }
    .error-message {
      background-color: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-errorForeground);
      border-left: 3px solid var(--vscode-errorForeground);
    }
    .message-header {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 0.9em;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .message-time {
      font-size: 0.8em;
      opacity: 0.7;
      font-weight: normal;
    }
    .message-content {
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.6;
    }
    .message-content pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      position: relative;
    }
    .message-content code {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
    }
    .message-content pre code {
      background: none;
      padding: 0;
    }
    .copy-button {
      position: absolute;
      top: 5px;
      right: 5px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      opacity: 0.7;
    }
    .copy-button:hover {
      opacity: 1;
    }
    .message-meta {
      font-size: 0.8em;
      opacity: 0.7;
      margin-top: 8px;
    }
    .typing-indicator {
      display: none;
      padding: 10px;
      font-style: italic;
      opacity: 0.7;
    }
    .typing-indicator.active {
      display: block;
    }
    .input-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .input-row {
      display: flex;
      gap: 10px;
    }
    #messageInput {
      flex: 1;
      padding: 10px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      resize: vertical;
      min-height: 60px;
      font-family: var(--vscode-font-family);
    }
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9em;
    }
    button {
      padding: 10px 20px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>🤖 Recoder Code Chat</h2>
    <div class="header-actions">
      <button class="secondary" onclick="clearHistory()">Clear History</button>
    </div>
  </div>

  <div id="messages"></div>
  <div class="typing-indicator" id="typingIndicator">AI is typing...</div>

  <div class="input-container">
    <div class="checkbox-row">
      <input type="checkbox" id="includeFileCheckbox" />
      <label for="includeFileCheckbox">Include current file/selection as context</label>
    </div>
    <div class="input-row">
      <textarea
        id="messageInput"
        placeholder="Type your message... (Shift+Enter for new line, Enter to send)"
        onkeypress="handleKeyPress(event)"
      ></textarea>
      <button onclick="sendMessage()">Send</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const typingIndicator = document.getElementById('typingIndicator');
    const includeFileCheckbox = document.getElementById('includeFileCheckbox');

    // Configure marked for better code rendering
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true,
    });

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'loadHistory':
          message.messages.forEach(msg => {
            if (msg.role === 'user') {
              addMessage('You', msg.content, 'user-message', msg.timestamp);
            } else if (msg.role === 'assistant') {
              addMessage('Assistant', msg.content, 'assistant-message', msg.timestamp, msg.tokens);
            }
          });
          break;
        case 'userMessage':
          addMessage('You', message.text, 'user-message');
          break;
        case 'assistantMessage':
          addMessage('Assistant', message.text, 'assistant-message', null, message.usage);
          break;
        case 'error':
          addMessage('Error', message.text, 'error-message');
          break;
        case 'typing':
          typingIndicator.classList.toggle('active', message.isTyping);
          break;
        case 'historyCleared':
          messagesDiv.innerHTML = '';
          break;
      }
    });

    function addMessage(sender, text, className, timestamp, usage) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + className;

      const header = document.createElement('div');
      header.className = 'message-header';

      const senderSpan = document.createElement('span');
      senderSpan.textContent = sender;
      header.appendChild(senderSpan);

      if (timestamp) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = new Date(timestamp).toLocaleTimeString();
        header.appendChild(timeSpan);
      }

      const content = document.createElement('div');
      content.className = 'message-content';

      // Use marked to render markdown with syntax highlighting
      if (sender === 'Assistant') {
        content.innerHTML = marked.parse(text);

        // Add copy buttons to code blocks
        content.querySelectorAll('pre code').forEach(block => {
          const pre = block.parentElement;
          const button = document.createElement('button');
          button.className = 'copy-button';
          button.textContent = 'Copy';
          button.onclick = () => copyCode(block.textContent);
          pre.style.position = 'relative';
          pre.insertBefore(button, pre.firstChild);
        });
      } else {
        content.textContent = text;
      }

      messageDiv.appendChild(header);
      messageDiv.appendChild(content);

      if (usage && usage.total_tokens) {
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        meta.textContent = \`Tokens: \${usage.total_tokens} (prompt: \${usage.prompt_tokens}, completion: \${usage.completion_tokens})\`;
        messageDiv.appendChild(meta);
      }

      messagesDiv.appendChild(messageDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function copyCode(code) {
      vscode.postMessage({
        type: 'copyCode',
        code: code
      });
    }

    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text) return;

      vscode.postMessage({
        type: 'sendMessage',
        text: text,
        includeFile: includeFileCheckbox.checked
      });

      messageInput.value = '';
      includeFileCheckbox.checked = false;
    }

    function clearHistory() {
      if (confirm('Are you sure you want to clear the conversation history?')) {
        vscode.postMessage({ type: 'clearHistory' });
      }
    }

    function handleKeyPress(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }

    // Focus input on load
    messageInput.focus();
  </script>
</body>
</html>`;
  }

  public dispose(): void {
    ChatPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
