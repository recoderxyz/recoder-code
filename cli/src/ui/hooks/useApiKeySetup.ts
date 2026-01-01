/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';

interface UseApiKeySetupReturn {
  isApiKeySetupDialogOpen: boolean;
  openApiKeySetupDialog: () => void;
  closeApiKeySetupDialog: () => void;
}

export const useApiKeySetup = (): UseApiKeySetupReturn => {
  const [isApiKeySetupDialogOpen, setIsApiKeySetupDialogOpen] = useState(false);

  const openApiKeySetupDialog = useCallback(() => {
    console.log('🔍 [HOOK] useApiKeySetup.openApiKeySetupDialog() called');
    console.log('🔍 [HOOK] Setting state to true');
    setIsApiKeySetupDialogOpen(true);
    console.log('🔍 [HOOK] State update queued');
  }, []); // Remove dependency to prevent stale closures

  const closeApiKeySetupDialog = useCallback(() => {
    console.log('🔍 [HOOK] useApiKeySetup.closeApiKeySetupDialog() called');
    setIsApiKeySetupDialogOpen(false);
  }, []);

  console.log('🔍 [HOOK] useApiKeySetup render - isApiKeySetupDialogOpen:', isApiKeySetupDialogOpen);

  return {
    isApiKeySetupDialogOpen,
    openApiKeySetupDialog,
    closeApiKeySetupDialog,
  };
};
