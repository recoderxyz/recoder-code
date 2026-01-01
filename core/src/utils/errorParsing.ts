/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  isProQuotaExceededError,
  isGenericQuotaExceededError,
  isApiError,
  isStructuredError,
} from './quotaErrorDetection.js';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
} from '../config/models.js';
import { UserTierId } from '../code_assist/types.js';
import { AuthType } from '../core/contentGenerator.js';

// Free Tier message functions
const getRateLimitErrorMessageGoogleFree = (
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nPossible quota limitations in place or slow response times detected. Switching to the ${fallbackModel} model for the rest of this session.`;

const getRateLimitErrorMessageGoogleProQuotaFree = (
  currentModel: string = DEFAULT_GEMINI_MODEL,
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nYou have reached your daily ${currentModel} quota limit. You will be switched to the ${fallbackModel} model for the rest of this session. To increase your limits, upgrade to a Gemini Code Assist Standard or Enterprise plan with higher limits at https://goo.gle/set-up-gemini-code-assist, or use /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;

const getRateLimitErrorMessageGoogleGenericQuotaFree = () =>
  `\nYou have reached your daily quota limit. To increase your limits, upgrade to a Gemini Code Assist Standard or Enterprise plan with higher limits at https://goo.gle/set-up-gemini-code-assist, or use /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;

// Legacy/Standard Tier message functions
const getRateLimitErrorMessageGooglePaid = (
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nPossible quota limitations in place or slow response times detected. Switching to the ${fallbackModel} model for the rest of this session. We appreciate you for choosing Gemini Code Assist and the Gemini CLI.`;

const getRateLimitErrorMessageGoogleProQuotaPaid = (
  currentModel: string = DEFAULT_GEMINI_MODEL,
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nYou have reached your daily ${currentModel} quota limit. You will be switched to the ${fallbackModel} model for the rest of this session. We appreciate you for choosing Gemini Code Assist and the Gemini CLI. To continue accessing the ${currentModel} model today, consider using /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;

const getRateLimitErrorMessageGoogleGenericQuotaPaid = (
  currentModel: string = DEFAULT_GEMINI_MODEL,
) =>
  `\nYou have reached your daily quota limit. We appreciate you for choosing Gemini Code Assist and the Gemini CLI. To continue accessing the ${currentModel} model today, consider using /auth to switch to using a paid API key from AI Studio at https://aistudio.google.com/apikey`;
const RATE_LIMIT_ERROR_MESSAGE_USE_GEMINI =
  '\nPlease wait and try again later. To increase your limits, request a quota increase through AI Studio, or switch to another /auth method';
const RATE_LIMIT_ERROR_MESSAGE_VERTEX =
  '\nPlease wait and try again later. To increase your limits, request a quota increase through Vertex, or switch to another /auth method';
const getRateLimitErrorMessageDefault = (
  fallbackModel: string = DEFAULT_GEMINI_FLASH_MODEL,
) =>
  `\nPossible quota limitations in place or slow response times detected. Switching to the ${fallbackModel} model for the rest of this session.`;

function getRateLimitMessage(
  authType?: AuthType,
  error?: unknown,
  userTier?: UserTierId,
  currentModel?: string,
  fallbackModel?: string,
): string {
  switch (authType) {
    case AuthType.LOGIN_WITH_GOOGLE: {
      // Determine if user is on a paid tier (Legacy or Standard) - default to FREE if not specified
      const isPaidTier =
        userTier === UserTierId.LEGACY || userTier === UserTierId.STANDARD;

      if (isProQuotaExceededError(error)) {
        return isPaidTier
          ? getRateLimitErrorMessageGoogleProQuotaPaid(
              currentModel || DEFAULT_GEMINI_MODEL,
              fallbackModel,
            )
          : getRateLimitErrorMessageGoogleProQuotaFree(
              currentModel || DEFAULT_GEMINI_MODEL,
              fallbackModel,
            );
      } else if (isGenericQuotaExceededError(error)) {
        return isPaidTier
          ? getRateLimitErrorMessageGoogleGenericQuotaPaid(
              currentModel || DEFAULT_GEMINI_MODEL,
            )
          : getRateLimitErrorMessageGoogleGenericQuotaFree();
      } else {
        return isPaidTier
          ? getRateLimitErrorMessageGooglePaid(fallbackModel)
          : getRateLimitErrorMessageGoogleFree(fallbackModel);
      }
    }
    case AuthType.USE_GEMINI:
      return RATE_LIMIT_ERROR_MESSAGE_USE_GEMINI;
    case AuthType.USE_VERTEX_AI:
      return RATE_LIMIT_ERROR_MESSAGE_VERTEX;
    default:
      return getRateLimitErrorMessageDefault(fallbackModel);
  }
}

export function parseAndFormatApiError(
  error: unknown,
  authType?: AuthType,
  userTier?: UserTierId,
  currentModel?: string,
  fallbackModel?: string,
): string {
  if (isStructuredError(error)) {
    let text = `[API Error: ${error.message}]`;
    if (error.status === 401) {
      text += getAuthenticationErrorMessage(authType);
    } else if (error.status === 429) {
      text += getRateLimitMessage(
        authType,
        error,
        userTier,
        currentModel,
        fallbackModel,
      );
    }
    return text;
  }

  // The error message might be a string containing a JSON object.
  if (typeof error === 'string') {
    const jsonStart = error.indexOf('{');
    if (jsonStart === -1) {
      // Check if it's a 401 auth error
      if (error.includes('401') || error.toLowerCase().includes('no auth credentials')) {
        return `[API Error: ${error}]${getAuthenticationErrorMessage(authType)}`;
      }
      return `[API Error: ${error}]`; // Not a JSON error, return as is.
    }

    const jsonString = error.substring(jsonStart);

    try {
      const parsedError = JSON.parse(jsonString) as unknown;
      if (isApiError(parsedError)) {
        let finalMessage = parsedError.error.message;
        try {
          // See if the message is a stringified JSON with another error
          const nestedError = JSON.parse(finalMessage) as unknown;
          if (isApiError(nestedError)) {
            finalMessage = nestedError.error.message;
          }
        } catch (_e) {
          // It's not a nested JSON error, so we just use the message as is.
        }
        let text = `[API Error: ${finalMessage} (Status: ${parsedError.error.status})]`;
        if (parsedError.error.code === 401 || parsedError.error.status === '401') {
          text += getAuthenticationErrorMessage(authType);
        } else if (parsedError.error.code === 429) {
          text += getRateLimitMessage(
            authType,
            parsedError,
            userTier,
            currentModel,
            fallbackModel,
          );
        }
        return text;
      }
    } catch (_e) {
      // Not a valid JSON, fall through and return the original message.
    }
    // Check if it's a 401 auth error
    if (error.includes('401') || error.toLowerCase().includes('no auth credentials')) {
      return `[API Error: ${error}]${getAuthenticationErrorMessage(authType)}`;
    }
    return `[API Error: ${error}]`;
  }

  return '[API Error: An unknown error occurred.]';
}

function getAuthenticationErrorMessage(authType?: AuthType): string {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
    case AuthType.RECODER_AUTH:
      return '\n\nTo use Recoder Code, you need to authenticate:\n' +
        '1. Run the /auth command or restart the CLI\n' +
        '2. Select "Recoder Code (Recommended)"\n' +
        '3. Visit https://recoder.xyz to complete authentication\n' +
        '\nNote: You need to create an account at https://recoder.xyz and ensure you have valid API credentials configured.';
    case AuthType.USE_OPENAI:
      return '\n\nOpenRouter API authentication failed. Please ensure:\n' +
        '1. You have a valid OpenRouter API key from https://openrouter.ai\n' +
        '2. Your API key is correctly set in the environment or via /auth command\n' +
        '3. Run /auth to reconfigure your OpenRouter API credentials\n' +
        '\nTo use OpenRouter, you need to:\n' +
        '- Create an account at https://openrouter.ai\n' +
        '- Generate an API key from your dashboard\n' +
        '- Configure it via the /auth command in Recoder Code';
    case AuthType.USE_GEMINI:
      return '\n\nGoogle Gemini API authentication failed. Please ensure:\n' +
        '1. You have a valid Gemini API key from https://aistudio.google.com/apikey\n' +
        '2. Your API key is correctly set via the GEMINI_API_KEY environment variable\n' +
        '3. Run /auth to switch to a different authentication method';
    default:
      return '\n\nAuthentication failed. Please run the /auth command to configure your API credentials.';
  }
}
