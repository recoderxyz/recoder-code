/**
 * Hook for managing Recoder.xyz authentication
 */

import { useState, useCallback, useEffect } from 'react';
import { RecoderAuthService } from '../../services/RecoderAuthService.js';

export interface RecoderAuthState {
  isAuthenticated: boolean;
  userEmail: string | null;
  userPlan: 'free' | 'pro' | 'enterprise' | null;
  hasOwnApiKey: boolean;
  quota: {
    remaining: number;
    limit: number;
  } | null;
}

export const useRecoderAuth = () => {
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [authState, setAuthState] = useState<RecoderAuthState>({
    isAuthenticated: false,
    userEmail: null,
    userPlan: null,
    hasOwnApiKey: false,
    quota: null,
  });
  const [isChecking, setIsChecking] = useState(true);

  const authService = new RecoderAuthService();

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsChecking(true);
    try {
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        const user = await authService.getUser();
        const quota = await authService.getQuota();

        setAuthState({
          isAuthenticated: true,
          userEmail: user?.email || null,
          userPlan: user?.subscription_plan || null,
          hasOwnApiKey: user?.has_own_api_key || false,
          quota: quota ? {
            remaining: quota.requests_remaining,
            limit: quota.requests_limit,
          } : null,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          userEmail: null,
          userPlan: null,
          hasOwnApiKey: false,
          quota: null,
        });
      }
    } catch (error) {
      // Silent fail - user not authenticated
      setAuthState({
        isAuthenticated: false,
        userEmail: null,
        userPlan: null,
        hasOwnApiKey: false,
        quota: null,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const openLoginDialog = useCallback(() => {
    setIsLoginDialogOpen(true);
  }, []);

  const closeLoginDialog = useCallback(() => {
    setIsLoginDialogOpen(false);
  }, []);

  const handleLoginSuccess = useCallback(async (userEmail: string, plan: string) => {
    // Refresh auth state after successful login
    await checkAuthStatus();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
      setAuthState({
        isAuthenticated: false,
        userEmail: null,
        userPlan: null,
        hasOwnApiKey: false,
        quota: null,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  const setApiKey = useCallback(async (apiKey: string) => {
    try {
      await authService.setOpenRouterApiKey(apiKey);
      // Refresh state
      await checkAuthStatus();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  const checkQuota = useCallback(async () => {
    return await authService.checkQuota();
  }, []);

  return {
    authState,
    isChecking,
    isLoginDialogOpen,
    openLoginDialog,
    closeLoginDialog,
    handleLoginSuccess,
    handleLogout,
    setApiKey,
    checkQuota,
    refreshAuthState: checkAuthStatus,
  };
};
