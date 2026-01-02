# 🎛️ Settings UI - Complete Configuration Management

The Recoder Code VS Code extension now includes a comprehensive **Settings UI** that makes configuration easy and user-friendly!

## 🚀 How to Access

### 1. **Command Palette**
- Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Type `Recoder Code: Open Settings`
- Press Enter

### 2. **Keyboard Shortcut**
- **Windows/Linux**: `Ctrl+,` (when not in terminal)
- **macOS**: `Cmd+,` (when not in terminal)

### 3. **Sidebar Button**
- Open the Recoder Code sidebar (click the icon in Activity Bar)
- Click the ⚙️ Settings button in the Authentication view

## ✨ Features

### 🎯 **Provider & Model Configuration**
- **Default Provider**: Choose from OpenRouter, OpenAI, Anthropic, Groq, Ollama, DeepSeek, Mistral, or Google
- **Default Model**: Set your preferred model (e.g., `gpt-4o`, `claude-3-5-sonnet`, `llama3.2`)
- **Provider Testing**: Test API connections with one click

### 🤖 **AI Behavior Settings**
- **Max Tokens**: Control response length (256-32,768)
- **Temperature**: Adjust creativity level (0-2, where 0=deterministic, 2=very creative)
- **Features**: Toggle inline suggestions, code lens, auto-completion

### 🏠 **Local AI Support**
- **Ollama Integration**: Configure Ollama server URL (default: `http://localhost:11434`)
- **LM Studio Support**: Configure LM Studio server URL (default: `http://localhost:1234`)
- **Auto-Detection**: Automatically find running local AI servers
- **Connection Testing**: Verify local AI servers are accessible

### 🔐 **Secure API Key Management**
- **Multiple Providers**: OpenAI, Anthropic, Groq, DeepSeek, Google, Mistral
- **Secure Storage**: API keys stored in VS Code's encrypted secret storage
- **Key Testing**: Validate API keys with real API calls
- **Privacy**: Keys never appear in settings files or exports

### 🛠️ **Custom Providers**
- **Add Any Provider**: Support for any OpenAI-compatible API
- **Custom Endpoints**: LM Studio, vLLM, llama.cpp, corporate APIs
- **Model Discovery**: Automatically fetch available models
- **Flexible Configuration**: Name, base URL, API key, custom models

### 🎨 **User Experience**
- **Theme Support**: Auto, Light, Dark themes
- **Telemetry Control**: Privacy-focused telemetry toggle
- **Chat Settings**: Auto-save conversations
- **Import/Export**: Backup and restore settings (excluding API keys for security)

## 📊 Configuration Schema

All settings are stored in VS Code's configuration system under `recoderCode.*`:

```json
{
  "recoderCode.defaultProvider": "openrouter",
  "recoderCode.defaultModel": "",
  "recoderCode.enableInlineSuggestions": false,
  "recoderCode.enableCodeLens": true,
  "recoderCode.enableAutoCompletion": true,
  "recoderCode.maxTokens": 4096,
  "recoderCode.temperature": 0.7,
  "recoderCode.enableTelemetry": false,
  "recoderCode.autoSaveChats": true,
  "recoderCode.theme": "auto",
  "recoderCode.ollamaHost": "http://localhost:11434",
  "recoderCode.lmStudioHost": "http://localhost:1234",
  "recoderCode.apiKeys": {},
  "recoderCode.customProviders": []
}
```

## 🔧 Advanced Features

### **Custom Provider Example**
```json
{
  "name": "My Corporate API",
  "baseURL": "https://api.company.com/v1",
  "apiKey": "your-key-here",
  "models": ["custom-gpt-4", "custom-claude"]
}
```

### **Local AI Detection**
The Settings UI can automatically detect:
- Running Ollama servers
- LM Studio instances 
- Other OpenAI-compatible servers on common ports

### **Import/Export**
- **Export**: Save all non-sensitive settings to JSON
- **Import**: Restore settings from JSON file
- **Security**: API keys are excluded from exports for security

## 🎯 Benefits

### **For Users**
- ✅ **Easy Setup**: No more config file editing
- ✅ **Visual Interface**: User-friendly web UI
- ✅ **Real-time Testing**: Validate settings immediately
- ✅ **Secure**: API keys encrypted and protected
- ✅ **Flexible**: Support any AI provider or model

### **For IT/Enterprise**
- ✅ **Standardization**: Consistent configuration across teams
- ✅ **Security**: No plaintext API keys in config files
- ✅ **Auditability**: All settings visible and manageable
- ✅ **Scalability**: Easy to add custom corporate AI endpoints

## 🚀 Getting Started

1. **Open Settings**: Use `Cmd+,` (macOS) or `Ctrl+,` (Windows/Linux)
2. **Choose Provider**: Select your preferred AI provider
3. **Add API Key**: Enter your API key and test the connection
4. **Configure Models**: Set your default model and preferences
5. **Test Local AI**: If using Ollama/LM Studio, configure and test endpoints
6. **Save & Use**: Settings are applied immediately!

---

This Settings UI transforms the Recoder Code extension from requiring manual configuration to providing a **modern, user-friendly setup experience** that rivals the best AI coding tools! 🎉
