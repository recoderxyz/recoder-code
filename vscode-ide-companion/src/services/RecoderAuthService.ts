/**
 * Recoder.xyz Authentication Service for VSCode Extension
 * Handles user authentication with recoder.xyz backend
 */

import * as vscode from 'vscode';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import open from 'open';

const RECODER_API_BASE = process.env['RECODER_API_URL'] || 'https://api.recoder.xyz';
const CLIENT_ID = 'recoder-code-vscode';
const CALLBACK_PORT = 8080;

export interface RecoderUser {
  id: string;
  email: string;
  name: string;
  subscription_plan: 'free' | 'pro' | 'enterprise';
  has_own_api_key: boolean;
  quota: {
    requests_remaining: number;
    requests_limit: number;
    reset_date: string;
  };
}

export interface RecoderAuthData {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: RecoderUser;
}

export class RecoderAuthService {
  private static readonly AUTH_KEY = 'recoder.authData';

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const authData = await this.getAuthData();
      if (!authData) return false;

      // Check if token is expired
      const expiresAt = new Date(authData.expires_at);
      const now = new Date();

      if (now >= expiresAt) {
        // Try to refresh token
        try {
          await this.refreshToken();
          return true;
        } catch {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Authenticate using Web OAuth flow (recommended)
   */
  async loginWithWeb(): Promise<RecoderAuthData> {
    const state = randomBytes(32).toString('hex');
    const redirectUri = `http://localhost:${CALLBACK_PORT}/auth/callback`;

    vscode.window.showInformationMessage('🔐 Opening browser for authentication...');

    // Start local server to receive callback
    const codePromise = this.startCallbackServer(state);

    // Build authorization URL
    const authUrl = new URL(`${RECODER_API_BASE}/api/auth/cli`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'cli:full profile');

    // Open browser
    await open(authUrl.toString());

    // Wait for callback
    const code = await codePromise;

    // Exchange code for tokens
    const authData = await this.exchangeCodeForTokens(code, redirectUri);

    // Save session
    await this.saveAuthData(authData);

    return authData;
  }

  /**
   * Authenticate using Device Flow (for SSH/headless environments)
   */
  async loginWithDeviceFlow(): Promise<RecoderAuthData> {
    // Request device code
    const deviceData = await this.requestDeviceCode();

    // Show device code to user
    const message = [
      '📱 Device Authorization Required',
      '',
      `1. Open: ${deviceData.verification_uri}`,
      `2. Enter code: ${deviceData.user_code}`,
      '',
      'Or visit the complete URL:',
      deviceData.verification_uri_complete,
    ].join('\n');

    await vscode.window.showInformationMessage(message, { modal: true });

    // Show progress while polling
    const authData = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Waiting for device authorization...',
        cancellable: true,
      },
      async (progress, token) => {
        return await this.pollDeviceAuthorization(
          deviceData.device_code,
          deviceData.interval,
          token
        );
      }
    );

    // Save session
    await this.saveAuthData(authData);

    return authData;
  }

  /**
   * Authenticate using API key (for free users with BYOK)
   */
  async loginWithApiKey(apiKey: string): Promise<RecoderAuthData> {
    const response = await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate_token',
        token: apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    const data = (await response.json()) as { user: RecoderUser };

    const authData: RecoderAuthData = {
      access_token: apiKey,
      refresh_token: '',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      user: data.user,
    };

    await this.saveAuthData(authData);
    return authData;
  }

  /**
   * Get current auth data
   */
  async getAuthData(): Promise<RecoderAuthData | null> {
    return this.context.globalState.get<RecoderAuthData>(RecoderAuthService.AUTH_KEY) || null;
  }

  /**
   * Get user info
   */
  async getUser(): Promise<RecoderUser | null> {
    const authData = await this.getAuthData();
    return authData?.user || null;
  }

  /**
   * Get access token (for making API requests)
   */
  async getAccessToken(): Promise<string | null> {
    const authData = await this.getAuthData();
    if (!authData) return null;

    // Check if token is expired
    const expiresAt = new Date(authData.expires_at);
    const now = new Date();

    // Refresh if expires in less than 5 minutes
    if (now >= new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
      try {
        await this.refreshToken();
        const newAuthData = await this.getAuthData();
        return newAuthData?.access_token || null;
      } catch {
        return null;
      }
    }

    return authData.access_token;
  }

  /**
   * Get OpenRouter API key (either from user's BYOK or backend for premium users)
   */
  async getOpenRouterApiKey(): Promise<string | null> {
    const user = await this.getUser();
    if (!user) return null;

    // If user has their own API key
    if (user.has_own_api_key) {
      // For free users with BYOK, the access_token IS the OpenRouter key
      const authData = await this.getAuthData();
      return authData?.access_token || null;
    }

    // For premium users, get API key from backend
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`${RECODER_API_BASE}/api/user/openrouter/key`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { apiKey: string };
      return data.apiKey;
    } catch {
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<void> {
    const authData = await this.getAuthData();
    if (!authData?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh_token',
        refresh_token: authData.refresh_token,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_at: string;
    };

    await this.saveAuthData({
      access_token: data.access_token,
      refresh_token: data.refresh_token || authData.refresh_token,
      expires_at: data.expires_at,
      user: authData.user,
    });
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    const authData = await this.getAuthData();
    if (authData) {
      // Revoke token on server
      try {
        await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'revoke_token',
            token: authData.access_token,
          }),
        });
      } catch {
        // Ignore errors
      }
    }

    // Clear local session
    await this.context.globalState.update(RecoderAuthService.AUTH_KEY, undefined);
  }

  /**
   * Set OpenRouter API key (for free users)
   */
  async setOpenRouterApiKey(apiKey: string): Promise<void> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated. Please login first.');
    }

    // Validate format
    if (!apiKey.startsWith('sk-or-')) {
      throw new Error('Invalid OpenRouter API key format. Must start with "sk-or-"');
    }

    const response = await fetch(`${RECODER_API_BASE}/api/user/openrouter`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        openRouterApiKey: apiKey,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error || 'Failed to save API key');
    }

    // Update local session
    const authData = await this.getAuthData();
    if (authData) {
      authData.user.has_own_api_key = true;
      await this.saveAuthData(authData);
    }
  }

  // Private helper methods

  private async startCallbackServer(expectedState: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout'));
      }, 5 * 60 * 1000); // 5 minutes

      const server = http.createServer((req, res) => {
        const url = new URL(req.url!, `http://localhost:${CALLBACK_PORT}`);

        if (url.pathname === '/auth/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');

          if (state !== expectedState) {
            res.writeHead(400);
            res.end('Invalid state parameter');
            reject(new Error('Invalid state parameter'));
            return;
          }

          if (!code) {
            res.writeHead(400);
            res.end('No authorization code received');
            reject(new Error('No authorization code received'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: system-ui; text-align: center; padding: 50px;">
              <h1>✅ Authentication Successful!</h1>
              <p>You can close this window and return to VS Code.</p>
            </body>
            </html>
          `);

          clearTimeout(timeout);
          server.close();
          resolve(code);
        }
      });

      server.listen(CALLBACK_PORT, () => {
        // Server started
      });
    });
  }

  private async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<RecoderAuthData> {
    const response = await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'exchange_code',
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_at: string;
      user: RecoderUser;
    };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: data.user,
    };
  }

  private async requestDeviceCode(): Promise<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    interval: number;
  }> {
    const response = await fetch(`${RECODER_API_BASE}/api/auth/cli/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        scope: 'cli:full profile',
        deviceInfo: {
          platform: process.platform,
          hostname: 'vscode-extension',
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to request device code');
    }

    return (await response.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete: string;
      interval: number;
    };
  }

  private async pollDeviceAuthorization(
    deviceCode: string,
    interval: number,
    token: vscode.CancellationToken
  ): Promise<RecoderAuthData> {
    const maxAttempts = 180; // 15 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts && !token.isCancellationRequested) {
      await new Promise(resolve => setTimeout(resolve, interval * 1000));

      try {
        const response = await fetch(`${RECODER_API_BASE}/api/auth/cli/token`, {
          method: 'GET',
          headers: {
            'X-Device-Code': deviceCode,
            'X-Client-Id': CLIENT_ID,
          },
        });

        const data = (await response.json()) as {
          token?: {
            accessToken: string;
            refreshToken: string;
            expiresAt: string;
          };
          user?: RecoderUser;
          error?: string;
          status?: string;
        };

        if (response.ok && data.token && data.user) {
          return {
            access_token: data.token.accessToken,
            refresh_token: data.token.refreshToken,
            expires_at: data.token.expiresAt,
            user: data.user,
          };
        }

        if (data.error === 'authorization_pending' || data.status === 'pending') {
          attempts++;
          continue;
        }

        if (data.status === 'denied') {
          throw new Error('Authorization denied by user');
        }

        throw new Error(data.error || 'Authorization failed');
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'authorization_pending') {
          attempts++;
          continue;
        }
        throw error;
      }
    }

    if (token.isCancellationRequested) {
      throw new Error('Authorization cancelled');
    }

    throw new Error('Device authorization timeout');
  }

  private async saveAuthData(authData: RecoderAuthData): Promise<void> {
    await this.context.globalState.update(RecoderAuthService.AUTH_KEY, authData);
  }
}
