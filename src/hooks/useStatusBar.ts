import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

interface UseStatusBarOptions {
  /** Current app mode */
  mode: 'merchant' | 'user';
}

// Mode colors
const MERCHANT_COLOR = '#0052FF'; // Base Blue
const PERSONAL_COLOR = '#000000'; // Black

/**
 * Hook to control native status bar appearance
 * - Merchant mode: Blue background
 * - Personal mode: Black background
 * - Always uses light (white) text/icons
 */
export function useStatusBar({ mode }: UseStatusBarOptions) {
  useEffect(() => {
    // Only apply on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const updateStatusBar = async () => {
      try {
        const backgroundColor = mode === 'merchant' ? MERCHANT_COLOR : PERSONAL_COLOR;
        
        // Set background color
        await StatusBar.setBackgroundColor({ color: backgroundColor });
        
        // Use dark style (light/white icons and text)
        await StatusBar.setStyle({ style: Style.Dark });
        
        // Ensure status bar is visible
        await StatusBar.show();
      } catch (error) {
        console.warn('[StatusBar] Failed to update:', error);
      }
    };

    updateStatusBar();
  }, [mode]);
}
