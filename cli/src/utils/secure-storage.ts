/**
 * Secure keychain storage for API keys
 * Uses macOS Keychain on macOS, encrypted file on other platforms
 */

import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const KEYCHAIN_SERVICE = 'xyz.recoder.cli';
const ENCRYPTED_FILE = path.join(os.homedir(), '.recoder-code', '.keys.enc');
const ALGORITHM = 'aes-256-gcm';

function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function getMachineId(): string {
  try {
    if (isMacOS()) {
      return execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf-8' })
        .split('=')[1]
        .trim()
        .replace(/"/g, '');
    }
    return os.hostname() + os.userInfo().username;
  } catch {
    return os.hostname();
  }
}

function getEncryptionKey(): Buffer {
  const machineId = getMachineId();
  return crypto.scryptSync(machineId, 'recoder-salt', 32);
}

export class SecureKeyStorage {
  /**
   * Store API key securely
   */
  static async set(provider: string, apiKey: string): Promise<void> {
    if (isMacOS()) {
      try {
        // Try to delete existing first.
        // execFileSync (argument array, no shell) prevents command injection
        // via attacker-controlled provider/apiKey.
        try {
          execFileSync('security', ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', provider], { stdio: 'ignore' });
        } catch {
          // Ignore if doesn't exist
        }

        // Add new key
        execFileSync('security', ['add-generic-password', '-s', KEYCHAIN_SERVICE, '-a', provider, '-w', apiKey]);
      } catch (err) {
        throw new Error(`Failed to store key in keychain: ${err}`);
      }
    } else {
      // Encrypted file storage for non-macOS
      const keys = this.loadEncryptedFile();
      keys[provider] = apiKey;
      this.saveEncryptedFile(keys);
    }
  }

  /**
   * Retrieve API key
   */
  static async get(provider: string): Promise<string | null> {
    if (isMacOS()) {
      try {
        const result = execFileSync(
          'security',
          ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', provider, '-w'],
          { encoding: 'utf-8' }
        );
        return result.trim();
      } catch {
        return null;
      }
    } else {
      const keys = this.loadEncryptedFile();
      return keys[provider] || null;
    }
  }

  /**
   * Delete API key
   */
  static async delete(provider: string): Promise<void> {
    if (isMacOS()) {
      try {
        execFileSync('security', ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', provider], { stdio: 'ignore' });
      } catch {
        // Ignore if doesn't exist
      }
    } else {
      const keys = this.loadEncryptedFile();
      delete keys[provider];
      this.saveEncryptedFile(keys);
    }
  }

  /**
   * List all stored providers
   */
  static async list(): Promise<string[]> {
    if (isMacOS()) {
      try {
        const result = execSync(
          `security dump-keychain | grep -A 1 "${KEYCHAIN_SERVICE}" | grep "acct" | cut -d'"' -f4`,
          { encoding: 'utf-8' }
        );
        return result.trim().split('\n').filter(Boolean);
      } catch {
        return [];
      }
    } else {
      const keys = this.loadEncryptedFile();
      return Object.keys(keys);
    }
  }

  private static loadEncryptedFile(): Record<string, string> {
    try {
      if (!fs.existsSync(ENCRYPTED_FILE)) return {};
      
      const encrypted = fs.readFileSync(ENCRYPTED_FILE, 'utf-8');
      const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
      
      const key = getEncryptionKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');
      
      return JSON.parse(decrypted);
    } catch {
      return {};
    }
  }

  private static saveEncryptedFile(keys: Record<string, string>): void {
    const dir = path.dirname(ENCRYPTED_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(keys), 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    const output = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    
    fs.writeFileSync(ENCRYPTED_FILE, output, 'utf-8');
    fs.chmodSync(ENCRYPTED_FILE, 0o600); // Owner read/write only
  }
}
