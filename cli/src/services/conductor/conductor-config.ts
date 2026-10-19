/**
 * Recoder conductor CLI config + token resolution.
 *
 * Single source of truth for "where is the backend" and "what credential do we
 * present" for the conductor client and device-flow auth. Resolution is
 * env-first, then the on-disk token store, then a safe default. No secrets are
 * ever hardcoded — keys come only from the environment or the device-flow store
 * at `~/.recoder/auth.json` (the canonical path also used by RecoderAuthService).
 *
 * Ported into recoder-code from the legacy packages/cli conductor command set.
 * Uses Node's built-in fs/os/path (no fs-extra) to match recoder-code conventions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/** On-disk auth store written by the device-flow login (RFC 8628). */
export interface RecoderAuthData {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    subscription_plan?: string;
  };
}

/** Canonical token store path: `~/.recoder/auth.json`. */
export function authFilePath(): string {
  return path.join(os.homedir(), '.recoder', 'auth.json');
}

/**
 * Resolve the Recoder backend base URL.
 *
 * Precedence: explicit override → RECODER_BACKEND_URL → RECODER_API_URL →
 * NEXTAUTH_URL → production default. The conductor + device-flow endpoints are
 * mounted under this origin (`/api/conductor`, `/api/auth/cli`).
 */
export function resolveBackendUrl(override?: string): string {
  const url =
    override ||
    process.env['RECODER_BACKEND_URL'] ||
    process.env['RECODER_API_URL'] ||
    process.env['NEXTAUTH_URL'] ||
    'https://recoder.xyz';
  return url.replace(/\/+$/, '');
}

/** Read + parse the device-flow auth store. Returns null when absent/corrupt. */
export function readAuthData(): RecoderAuthData | null {
  try {
    const file = authFilePath();
    if (!fs.existsSync(file)) {
      return null;
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RecoderAuthData;
    if (!raw || typeof raw.access_token !== 'string' || raw.access_token.length === 0) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** Persist the device-flow auth store (mode 0600). */
export async function writeAuthData(data: RecoderAuthData): Promise<void> {
  const file = authFilePath();
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    await fs.promises.chmod(file, 0o600);
  } catch {
    // Best-effort on platforms without POSIX modes.
  }
}

/** Remove the device-flow auth store (logout). */
export async function clearAuthData(): Promise<void> {
  const file = authFilePath();
  try {
    await fs.promises.rm(file, { force: true });
  } catch {
    // Already absent — logout is idempotent.
  }
}

export interface ResolvedCredential {
  /** Header name to set: 'Authorization' (Bearer) or 'x-api-key'. */
  header: 'Authorization' | 'x-api-key';
  value: string;
  /** How the credential was sourced (for truthful diagnostics). */
  source: 'env-api-key' | 'env-token' | 'auth-store';
}

/**
 * Resolve the credential to present to authenticated backend routes.
 *
 * Precedence:
 *  1. RECODER_API_KEY  → `x-api-key: sk_...` (first-party platform key)
 *  2. RECODER_TOKEN    → `Authorization: Bearer <token>` (explicit override)
 *  3. auth store token → `Authorization: Bearer <access_token>` (device-flow)
 *
 * Returns null when nothing is configured — callers must surface "not
 * authenticated" rather than calling protected routes blindly.
 */
export function resolveCredential(): ResolvedCredential | null {
  const apiKey = process.env['RECODER_API_KEY'];
  if (apiKey && apiKey.length > 0) {
    return { header: 'x-api-key', value: apiKey, source: 'env-api-key' };
  }

  const envToken = process.env['RECODER_TOKEN'] || process.env['RECODER_ACCESS_TOKEN'];
  if (envToken && envToken.length > 0) {
    return { header: 'Authorization', value: `Bearer ${envToken}`, source: 'env-token' };
  }

  const auth = readAuthData();
  if (auth?.access_token) {
    return { header: 'Authorization', value: `Bearer ${auth.access_token}`, source: 'auth-store' };
  }

  return null;
}
