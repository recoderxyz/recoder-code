/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'crypto';
import type {
  OAuthConfig,
  PKCETokens,
  OAuthAuthorizationResponse,
  OAuthTokenResponse,
} from './types.js';

/**
 * OAuth PKCE (Proof Key for Code Exchange) implementation for OpenRouter
 * Provides secure authentication without client secrets
 */
export class OAuthPKCEClient {
  private baseUrl: string;
  private clientId: string;
  private redirectUri: string;
  private scope: string;

  constructor(config: OAuthConfig) {
    this.baseUrl = 'https://openrouter.ai';
    this.clientId = config.clientId;
    this.redirectUri = config.redirectUri;
    this.scope = config.scope || 'openid profile email';
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  generatePKCETokens(): PKCETokens {
    // Generate code verifier (random 43-128 character string)
    const codeVerifier = this.base64URLEncode(crypto.randomBytes(32));

    // Generate code challenge (SHA256 hash of verifier)
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = this.base64URLEncode(hash);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  /**
   * Generate authorization URL for user to visit
   */
  getAuthorizationUrl(pkceTokens: PKCETokens, state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      code_challenge: pkceTokens.codeChallenge,
      code_challenge_method: pkceTokens.codeChallengeMethod,
      ...(state && { state }),
    });

    return `${this.baseUrl}/auth/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
  ): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Token exchange failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      const data = await response.json();

      return {
        access_token: data.key,
        token_type: 'Bearer',
        expires_in: data.limit ? undefined : 31536000, // 1 year if no limit
        scope: this.scope,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Token exchange failed: ${String(error)}`);
    }
  }

  /**
   * Refresh access token (if refresh token is available)
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Token refresh failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
        );
      }

      const data = await response.json();

      return {
        access_token: data.key,
        token_type: 'Bearer',
        expires_in: data.limit ? undefined : 31536000,
        scope: this.scope,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Token refresh failed: ${String(error)}`);
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/key`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Token revocation failed: ${String(error)}`);
    }
  }

  /**
   * Base64 URL encode (RFC 4648)
   */
  private base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Start local server to handle OAuth callback
   * Returns a promise that resolves with the authorization code
   */
  async startCallbackServer(
    port: number = 3000,
  ): Promise<OAuthAuthorizationResponse> {
    return new Promise((resolve, reject) => {
      const http = require('http');

      const server = http.createServer((req: any, res: any) => {
        const url = new URL(req.url, `http://localhost:${port}`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Error</h1>
                  <p>${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window and return to your terminal.</p>
                </body>
              </html>
            `);
            server.close();
            resolve({ code, state: state || undefined });
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Invalid Request</h1>
                  <p>No authorization code received.</p>
                </body>
              </html>
            `);
          }
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      server.listen(port, () => {
        console.log(`OAuth callback server listening on http://localhost:${port}`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('OAuth callback timeout'));
      }, 5 * 60 * 1000);
    });
  }
}
