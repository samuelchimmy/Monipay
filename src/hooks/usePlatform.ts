import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

interface PlatformInfo {
  platform: 'web' | 'ios' | 'android';
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
}

/**
 * Hook to detect the current platform (web, iOS, or Android)
 * Uses Capacitor's native detection
 */
export function usePlatform(): PlatformInfo {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => {
    // Initial detection
    const platform = Capacitor.getPlatform() as 'web' | 'ios' | 'android';
    return {
      platform,
      isNative: Capacitor.isNativePlatform(),
      isIOS: platform === 'ios',
      isAndroid: platform === 'android',
      isWeb: platform === 'web',
    };
  });

  useEffect(() => {
    // Re-check on mount (shouldn't change, but ensures consistency)
    const platform = Capacitor.getPlatform() as 'web' | 'ios' | 'android';
    setPlatformInfo({
      platform,
      isNative: Capacitor.isNativePlatform(),
      isIOS: platform === 'ios',
      isAndroid: platform === 'android',
      isWeb: platform === 'web',
    });
  }, []);

  return platformInfo;
}
