import { useEffect, useCallback } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface UseBackButtonOptions {
  /** Check if any modal/dialog is open */
  isModalOpen: boolean;
  /** Function to close the modal */
  closeModal: () => void;
  /** Check if on main dashboard (should minimize app) */
  isOnDashboard: boolean;
  /** Navigate back function */
  navigateBack: () => void;
}

/**
 * Hook to handle Android hardware back button
 * - If modal open -> close modal
 * - If on dashboard -> exit/minimize app
 * - Otherwise -> navigate back
 */
export function useBackButton({
  isModalOpen,
  closeModal,
  isOnDashboard,
  navigateBack,
}: UseBackButtonOptions) {
  const handleBackButton = useCallback(() => {
    if (isModalOpen) {
      // Close any open modal/dialog
      closeModal();
    } else if (isOnDashboard) {
      // Minimize app on dashboard
      App.minimizeApp();
    } else {
      // Navigate back
      navigateBack();
    }
  }, [isModalOpen, closeModal, isOnDashboard, navigateBack]);

  useEffect(() => {
    // Only register on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listener = App.addListener('backButton', handleBackButton);

    return () => {
      listener.then(l => l.remove());
    };
  }, [handleBackButton]);
}
