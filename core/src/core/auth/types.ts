/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OAuth PKCE authentication types
 */

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export interface PKCETokens {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface OAuthAuthorizationResponse {
  code: string;
  state?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * BYOK (Bring Your Own Key) types
 */

export interface BYOKProvider {
  name: string;
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  enabled: boolean;
}

export interface BYOKConfig {
  providers: Record<string, BYOKProvider>;
  defaultProvider?: string;
}

export interface ProviderCredentials {
  openai?: {
    apiKey: string;
    baseUrl?: string;
    organization?: string;
  };
  anthropic?: {
    apiKey: string;
    baseUrl?: string;
  };
  google?: {
    apiKey: string;
    baseUrl?: string;
  };
  cohere?: {
    apiKey: string;
    baseUrl?: string;
  };
  together?: {
    apiKey: string;
    baseUrl?: string;
  };
  perplexity?: {
    apiKey: string;
    baseUrl?: string;
  };
  mistral?: {
    apiKey: string;
    baseUrl?: string;
  };
  groq?: {
    apiKey: string;
    baseUrl?: string;
  };
}

/**
 * Combined auth state
 */
export interface AuthState {
  /** OpenRouter OAuth access token */
  openrouterToken?: string;

  /** OpenRouter API key (non-OAuth) */
  openrouterApiKey?: string;

  /** BYOK provider credentials */
  byokCredentials?: ProviderCredentials;

  /** Timestamp when tokens expire */
  expiresAt?: number;

  /** Refresh token for OAuth */
  refreshToken?: string;
}

/**
 * Auth mode
 */
export type AuthMode =
  | 'openrouter-oauth' // OAuth PKCE flow with OpenRouter
  | 'openrouter-apikey' // Direct API key for OpenRouter
  | 'byok' // Bring your own keys from providers
  | 'mixed'; // Mix of OpenRouter + BYOK
