/**
 * Recoder.xyz Authentication Service
 * Handles user authentication with recoder.xyz backend
 */
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
export interface RecoderSession extends RecoderAuthData {
    user_id: string;
}
export declare class RecoderAuthService {
    private authFilePath;
    constructor();
    /**
     * Check if user is authenticated
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Authenticate using Web OAuth flow (recommended)
     */
    loginWithWeb(): Promise<RecoderAuthData>;
    /**
     * Authenticate using Device Flow (for SSH/headless environments)
     */
    loginWithDeviceFlow(): Promise<RecoderAuthData>;
    /**
     * Authenticate using API key
     */
    loginWithApiKey(apiKey: string): Promise<RecoderAuthData>;
    /**
     * Get current session
     */
    getSession(): Promise<RecoderSession | null>;
    /**
     * Get user info
     */
    getUser(): Promise<RecoderUser | null>;
    /**
     * Get access token
     */
    getAccessToken(): Promise<string | null>;
    /**
     * Refresh access token
     */
    refreshToken(): Promise<void>;
    /**
     * Logout
     */
    logout(): Promise<void>;
    /**
     * Set OpenRouter API key (for free users)
     */
    setOpenRouterApiKey(apiKey: string): Promise<void>;
    /**
     * Get user's quota info
     */
    getQuota(): Promise<RecoderUser['quota'] | null>;
    /**
     * Check if user has exceeded quota
     */
    checkQuota(): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    private startCallbackServer;
    private exchangeCodeForTokens;
    private requestDeviceCode;
    private pollDeviceAuthorization;
    private saveSession;
}
