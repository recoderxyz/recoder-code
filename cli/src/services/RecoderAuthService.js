/**
 * Recoder.xyz Authentication Service
 * Handles user authentication with recoder.xyz backend
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import open from 'open';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const RECODER_API_BASE = process.env['RECODER_API_URL'] || 'https://recoder.xyz';
const CLIENT_ID = 'recoder-code';
const CALLBACK_PORT = 8080;
export class RecoderAuthService {
    authFilePath;
    constructor() {
        const homeDir = os.homedir();
        const recoderDir = path.join(homeDir, '.recoder');
        this.authFilePath = path.join(recoderDir, 'auth.json');
    }
    /**
     * Check if user is authenticated
     */
    async isAuthenticated() {
        try {
            const session = await this.getSession();
            if (!session)
                return false;
            // Check if token is expired
            const expiresAt = new Date(session.expires_at);
            const now = new Date();
            if (now >= expiresAt) {
                // Try to refresh token
                try {
                    await this.refreshToken();
                    return true;
                }
                catch {
                    return false;
                }
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Authenticate using Web OAuth flow (recommended)
     */
    async loginWithWeb() {
        const state = randomBytes(32).toString('hex');
        const redirectUri = `http://localhost:${CALLBACK_PORT}/auth/callback`;
        console.log('🔐 Starting authentication with recoder.xyz...');
        console.log('🌐 Opening browser for authentication...');
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
        console.log('⏳ Waiting for authentication in browser...');
        // Wait for callback
        const code = await codePromise;
        // Exchange code for tokens
        const authData = await this.exchangeCodeForTokens(code, redirectUri);
        // Save session
        await this.saveSession(authData);
        console.log('✅ Successfully authenticated!');
        console.log(`📧 Logged in as: ${authData.user.email}`);
        console.log(`📋 Plan: ${authData.user.subscription_plan.toUpperCase()}`);
        console.log(`🔒 Session synced across all platforms`);
        // Check if user needs to provide API key
        if (authData.user.subscription_plan === 'free' && !authData.user.has_own_api_key) {
            console.log('\n⚠️  Free tier requires your own OpenRouter API key');
            console.log('💡 Please visit https://openrouter.ai to get your API key');
            console.log('💡 Then run: recoder auth set-api-key');
        }
        return authData;
    }
    /**
     * Authenticate using Device Flow (for SSH/headless environments)
     */
    async loginWithDeviceFlow() {
        console.log('🔐 Starting device flow authentication...');
        // Request device code
        const deviceData = await this.requestDeviceCode();
        console.log('\n📱 Device Authorization Required');
        console.log('1. Open this URL in your browser:');
        console.log(`   ${deviceData.verification_uri}`);
        console.log('2. Enter this code:');
        console.log(`   ${deviceData.user_code}`);
        console.log('\nOr visit:');
        console.log(`   ${deviceData.verification_uri_complete}`);
        console.log('\n⏳ Waiting for authorization...');
        console.log('(This will expire in 15 minutes)\n');
        // Poll for authorization
        const authData = await this.pollDeviceAuthorization(deviceData.device_code, deviceData.interval);
        // Save session
        await this.saveSession(authData);
        console.log('✅ Device authorized successfully!');
        console.log(`👤 Logged in as: ${authData.user.email}`);
        console.log(`📋 Plan: ${authData.user.subscription_plan.toUpperCase()}`);
        // Check if user needs to provide API key
        if (authData.user.subscription_plan === 'free' && !authData.user.has_own_api_key) {
            console.log('\n⚠️  Free tier requires your own OpenRouter API key');
            console.log('💡 Please visit https://openrouter.ai to get your API key');
            console.log('💡 Then run: recoder auth set-api-key');
        }
        return authData;
    }
    /**
     * Authenticate using API key
     */
    async loginWithApiKey(apiKey) {
        console.log('🔐 Authenticating with API key...');
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
        const data = await response.json();
        const authData = {
            access_token: apiKey,
            refresh_token: '',
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
            user: data.user,
        };
        await this.saveSession(authData);
        console.log('✅ API key authentication successful!');
        console.log(`👤 Authenticated as: ${authData.user.email}`);
        console.log(`📋 Plan: ${authData.user.subscription_plan.toUpperCase()}`);
        return authData;
    }
    /**
     * Get current session
     */
    async getSession() {
        try {
            const content = await fs.readFile(this.authFilePath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    /**
     * Get user info
     */
    async getUser() {
        const session = await this.getSession();
        return session?.user || null;
    }
    /**
     * Get access token
     */
    async getAccessToken() {
        const session = await this.getSession();
        if (!session)
            return null;
        // Check if token is expired
        const expiresAt = new Date(session.expires_at);
        const now = new Date();
        // Refresh if expires in less than 5 minutes
        if (now >= new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
            try {
                await this.refreshToken();
                const newSession = await this.getSession();
                return newSession?.access_token || null;
            }
            catch {
                return null;
            }
        }
        return session.access_token;
    }
    /**
     * Refresh access token
     */
    async refreshToken() {
        const session = await this.getSession();
        if (!session?.refresh_token) {
            throw new Error('No refresh token available');
        }
        const response = await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'refresh_token',
                refresh_token: session.refresh_token,
                client_id: CLIENT_ID,
            }),
        });
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        const data = await response.json();
        await this.saveSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token || session.refresh_token,
            expires_at: data.expires_at,
            user: session.user,
        });
    }
    /**
     * Logout
     */
    async logout() {
        const session = await this.getSession();
        if (session) {
            // Revoke token on server
            try {
                await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'revoke_token',
                        token: session.access_token,
                    }),
                });
            }
            catch {
                // Ignore errors
            }
        }
        // Delete local session
        try {
            await fs.unlink(this.authFilePath);
        }
        catch {
            // Ignore errors
        }
        console.log('✅ Logged out successfully');
    }
    /**
     * Set OpenRouter API key (for free users)
     */
    async setOpenRouterApiKey(apiKey) {
        const token = await this.getAccessToken();
        if (!token) {
            throw new Error('Not authenticated. Please login first.');
        }
        // Validate format
        if (!apiKey.startsWith('sk-or-')) {
            throw new Error('Invalid OpenRouter API key format. Must start with "sk-or-"');
        }
        const response = await fetch(`${RECODER_API_BASE}/api/user/openrouter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                openRouterApiKey: apiKey,
            }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save API key');
        }
        // Update local session
        const session = await this.getSession();
        if (session) {
            session.user.has_own_api_key = true;
            await this.saveSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
                user: session.user,
            });
        }
        console.log('✅ OpenRouter API key saved successfully!');
        console.log('🎉 You can now use all AI features');
    }
    /**
     * Get user's quota info
     */
    async getQuota() {
        const token = await this.getAccessToken();
        if (!token)
            return null;
        try {
            const response = await fetch(`${RECODER_API_BASE}/api/user/quota`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok)
                return null;
            const data = await response.json();
            return data.data;
        }
        catch {
            return null;
        }
    }
    /**
     * Check if user has exceeded quota
     */
    async checkQuota() {
        const quota = await this.getQuota();
        if (!quota) {
            return { allowed: false, reason: 'Unable to fetch quota' };
        }
        if (quota.requests_remaining <= 0) {
            return {
                allowed: false,
                reason: 'Monthly quota exceeded. Please upgrade your plan.',
            };
        }
        return { allowed: true };
    }
    // Private helper methods
    async startCallbackServer(expectedState) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                server.close();
                reject(new Error('Authentication timeout'));
            }, 5 * 60 * 1000); // 5 minutes
            const server = http.createServer((req, res) => {
                const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
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
              <p>You can close this window and return to your terminal.</p>
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
    async exchangeCodeForTokens(code, redirectUri) {
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
        const data = await response.json();
        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            user: data.user,
        };
    }
    async requestDeviceCode() {
        const response = await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'device_flow',
                client_id: CLIENT_ID,
                scope: 'cli:full profile',
            }),
        });
        if (!response.ok) {
            throw new Error('Failed to request device code');
        }
        return await response.json();
    }
    async pollDeviceAuthorization(deviceCode, interval) {
        const maxAttempts = 180; // 15 minutes with 5-second intervals
        let attempts = 0;
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, interval * 1000));
            try {
                const response = await fetch(`${RECODER_API_BASE}/api/auth/cli`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'device_token',
                        device_code: deviceCode,
                        client_id: CLIENT_ID,
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                    }),
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    return {
                        access_token: data.access_token,
                        refresh_token: data.refresh_token,
                        expires_at: data.expires_at,
                        user: data.user,
                    };
                }
                if (data.error === 'authorization_pending') {
                    attempts++;
                    continue;
                }
                throw new Error(data.error || 'Authorization failed');
            }
            catch (error) {
                if (error.message === 'authorization_pending') {
                    attempts++;
                    continue;
                }
                throw error;
            }
        }
        throw new Error('Device authorization timeout');
    }
    async saveSession(authData) {
        const session = {
            user_id: authData.user.id,
            access_token: authData.access_token,
            refresh_token: authData.refresh_token,
            expires_at: authData.expires_at,
            user: authData.user,
        };
        // Ensure directory exists
        const dir = path.dirname(this.authFilePath);
        await fs.mkdir(dir, { recursive: true });
        // Write session file
        await fs.writeFile(this.authFilePath, JSON.stringify(session, null, 2), { mode: 0o600 } // Read/write for owner only
        );
    }
}
