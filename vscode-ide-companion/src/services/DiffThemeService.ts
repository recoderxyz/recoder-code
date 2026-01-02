/**
 * Diff Theme Service
 * Manages custom themes for diff views in Recoder Code
 */

import * as vscode from 'vscode';

export interface DiffThemeColors {
  addedBackground: string;
  addedForeground: string;
  removedBackground: string;
  removedForeground: string;
  modifiedBackground: string;
  modifiedForeground: string;
  gutter?: string;
  border?: string;
}

export interface DiffTheme {
  name: string;
  colors: DiffThemeColors;
  description: string;
}

export class DiffThemeService {
  private static readonly BUILTIN_THEMES: Record<string, DiffTheme> = {
    github: {
      name: 'GitHub',
      description: 'Classic GitHub diff colors',
      colors: {
        addedBackground: '#0d7a0d',
        addedForeground: '#ffffff',
        removedBackground: '#d73a49',
        removedForeground: '#ffffff',
        modifiedBackground: '#0366d6',
        modifiedForeground: '#ffffff',
        gutter: '#586069',
        border: '#e1e4e8'
      }
    },
    monokai: {
      name: 'Monokai Pro',
      description: 'Dark theme inspired by Monokai Pro',
      colors: {
        addedBackground: '#403e41',
        addedForeground: '#a6e22e',
        removedBackground: '#403e41',
        removedForeground: '#f92672',
        modifiedBackground: '#403e41',
        modifiedForeground: '#66d9ef',
        gutter: '#75715e',
        border: '#49483e'
      }
    },
    solarized: {
      name: 'Solarized',
      description: 'Balanced light/dark solarized colors',
      colors: {
        addedBackground: '#073642',
        addedForeground: '#859900',
        removedBackground: '#073642',
        removedForeground: '#dc322f',
        modifiedBackground: '#073642',
        modifiedForeground: '#268bd2',
        gutter: '#586e75',
        border: '#93a1a1'
      }
    },
    dracula: {
      name: 'Dracula',
      description: 'Dark theme with vibrant colors',
      colors: {
        addedBackground: '#282a36',
        addedForeground: '#50fa7b',
        removedBackground: '#282a36', 
        removedForeground: '#ff5555',
        modifiedBackground: '#282a36',
        modifiedForeground: '#8be9fd',
        gutter: '#6272a4',
        border: '#44475a'
      }
    },
    nord: {
      name: 'Nord',
      description: 'Arctic, north-bluish color palette',
      colors: {
        addedBackground: '#2e3440',
        addedForeground: '#a3be8c',
        removedBackground: '#2e3440',
        removedForeground: '#bf616a',
        modifiedBackground: '#2e3440',
        modifiedForeground: '#88c0d0',
        gutter: '#4c566a',
        border: '#3b4252'
      }
    }
  };

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get the current diff theme based on settings
   */
  getCurrentTheme(): DiffTheme {
    const config = vscode.workspace.getConfiguration('recoderCode');
    const themeId = config.get<string>('diffTheme', 'auto');

    if (themeId === 'auto') {
      return this.getAutoTheme();
    }

    if (themeId === 'custom') {
      return this.getCustomTheme();
    }

    return DiffThemeService.BUILTIN_THEMES[themeId] || this.getAutoTheme();
  }

  /**
   * Get all available themes
   */
  getAvailableThemes(): DiffTheme[] {
    return [
      this.getAutoTheme(),
      ...Object.values(DiffThemeService.BUILTIN_THEMES),
      this.getCustomTheme()
    ];
  }

  /**
   * Apply the current theme to VS Code
   */
  async applyCurrentTheme(): Promise<void> {
    const theme = this.getCurrentTheme();
    await this.applyThemeToWorkbench(theme);
  }

  /**
   * Generate CSS for webview content that shows diffs
   */
  generateDiffCSS(): string {
    const theme = this.getCurrentTheme();
    
    return `
      /* Recoder Code Diff Theme: ${theme.name} */
      .diff-viewer {
        font-family: 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .diff-line-added {
        background-color: ${theme.colors.addedBackground} !important;
        color: ${theme.colors.addedForeground} !important;
      }
      
      .diff-line-removed {
        background-color: ${theme.colors.removedBackground} !important;
        color: ${theme.colors.removedForeground} !important;
      }
      
      .diff-line-modified {
        background-color: ${theme.colors.modifiedBackground} !important;
        color: ${theme.colors.modifiedForeground} !important;
      }
      
      .diff-gutter {
        background-color: ${theme.colors.gutter || theme.colors.addedBackground} !important;
        color: ${theme.colors.addedForeground} !important;
        border-right: 1px solid ${theme.colors.border || theme.colors.gutter || '#666'};
      }
      
      .diff-container {
        border: 1px solid ${theme.colors.border || theme.colors.gutter || '#666'};
        border-radius: 6px;
        overflow: hidden;
      }
      
      /* Added line prefix */
      .diff-line-added::before {
        content: "+ ";
        font-weight: bold;
      }
      
      /* Removed line prefix */
      .diff-line-removed::before {
        content: "- ";
        font-weight: bold;
      }
      
      /* Modified line prefix */
      .diff-line-modified::before {
        content: "~ ";
        font-weight: bold;
      }
    `;
  }

  /**
   * Get auto theme based on VS Code theme
   */
  private getAutoTheme(): DiffTheme {
    const currentTheme = vscode.window.activeColorTheme;
    
    if (currentTheme.kind === vscode.ColorThemeKind.Light) {
      return {
        name: 'Auto (Light)',
        description: 'Automatically matches VS Code light theme',
        colors: {
          addedBackground: '#d4edd4',
          addedForeground: '#0c5e0c',
          removedBackground: '#f8d7da',
          removedForeground: '#721c24',
          modifiedBackground: '#d1ecf1',
          modifiedForeground: '#0c5460'
        }
      };
    }

    // Dark theme
    return {
      name: 'Auto (Dark)',
      description: 'Automatically matches VS Code dark theme',
      colors: {
        addedBackground: '#1e5f2e',
        addedForeground: '#ffffff',
        removedBackground: '#5f1e1e',
        removedForeground: '#ffffff',
        modifiedBackground: '#2e4d5f',
        modifiedForeground: '#ffffff'
      }
    };
  }

  /**
   * Get custom theme from user settings
   */
  private getCustomTheme(): DiffTheme {
    const config = vscode.workspace.getConfiguration('recoderCode');
    const customColors = config.get<Partial<DiffThemeColors>>('diffCustomColors', {});
    
    const defaultColors: DiffThemeColors = {
      addedBackground: '#1e5f2e',
      addedForeground: '#ffffff',
      removedBackground: '#5f1e1e',
      removedForeground: '#ffffff',
      modifiedBackground: '#2e4d5f',
      modifiedForeground: '#ffffff'
    };

    return {
      name: 'Custom',
      description: 'User-defined custom colors',
      colors: { ...defaultColors, ...customColors }
    };
  }

  /**
   * Apply theme colors to VS Code workbench settings
   */
  private async applyThemeToWorkbench(theme: DiffTheme): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    
    // Update VS Code's diff editor colors
    const colorCustomizations = config.get<Record<string, string>>('colorCustomizations', {});
    
    // Set diff editor colors
    colorCustomizations['diffEditor.insertedTextBackground'] = theme.colors.addedBackground + '40'; // 25% opacity
    colorCustomizations['diffEditor.removedTextBackground'] = theme.colors.removedBackground + '40';
    colorCustomizations['diffEditor.insertedLineBackground'] = theme.colors.addedBackground + '20';
    colorCustomizations['diffEditor.removedLineBackground'] = theme.colors.removedBackground + '20';
    
    await config.update('colorCustomizations', colorCustomizations, vscode.ConfigurationTarget.Global);
    
    vscode.window.showInformationMessage(`Applied diff theme: ${theme.name}`);
  }

  /**
   * Reset diff theme to VS Code defaults
   */
  async resetToDefault(): Promise<void> {
    const config = vscode.workspace.getConfiguration('workbench');
    const colorCustomizations = config.get<Record<string, string>>('colorCustomizations', {});
    
    // Remove our diff customizations
    delete colorCustomizations['diffEditor.insertedTextBackground'];
    delete colorCustomizations['diffEditor.removedTextBackground']; 
    delete colorCustomizations['diffEditor.insertedLineBackground'];
    delete colorCustomizations['diffEditor.removedLineBackground'];
    
    await config.update('colorCustomizations', colorCustomizations, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('Reset diff theme to VS Code default');
  }

  /**
   * Open theme customization settings
   */
  async openThemeSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'recoderCode.diffTheme');
  }
}
