import { useState, useCallback } from 'react';

const CAMERA_PREFERENCE_KEY = 'monipay_camera_preference';

export type CameraPreference = string | null; // Camera label string or null

interface CameraPreferenceState {
  preference: CameraPreference;
  setPreference: (label: string) => void;
  clearPreference: () => void;
}

/**
 * Hook to manage persistent camera preference across sessions.
 * 
 * IMPORTANT: We store the camera LABEL, not deviceId!
 * Android deviceIds are ephemeral and change between sessions.
 * Camera labels are stable and human-readable.
 */
export function useCameraPreference(): CameraPreferenceState {
  const [preference, setPreferenceState] = useState<CameraPreference>(() => {
    try {
      return localStorage.getItem(CAMERA_PREFERENCE_KEY);
    } catch {
      return null;
    }
  });

  const setPreference = useCallback((label: string) => {
    setPreferenceState(label);
    try {
      localStorage.setItem(CAMERA_PREFERENCE_KEY, label);
      console.log('[CameraPreference] Saved camera label:', label);
    } catch {}
  }, []);

  const clearPreference = useCallback(() => {
    setPreferenceState(null);
    try {
      localStorage.removeItem(CAMERA_PREFERENCE_KEY);
      console.log('[CameraPreference] Cleared camera preference');
    } catch {}
  }, []);

  return { preference, setPreference, clearPreference };
}

/**
 * Get the saved camera label preference.
 * Returns null if no preference is saved.
 */
export function getCameraPreference(): string | null {
  try {
    return localStorage.getItem(CAMERA_PREFERENCE_KEY);
  } catch {
    return null;
  }
}

/**
 * Save a camera label as the preference.
 * IMPORTANT: Pass the camera LABEL, not deviceId!
 */
export function setCameraPreference(label: string): void {
  try {
    localStorage.setItem(CAMERA_PREFERENCE_KEY, label);
    console.log('[CameraPreference] Saved camera label:', label);
  } catch {}
}

/**
 * Clear the saved camera preference.
 */
export function clearCameraPreference(): void {
  try {
    localStorage.removeItem(CAMERA_PREFERENCE_KEY);
    console.log('[CameraPreference] Cleared preference');
  } catch {}
}

/**
 * Find a camera device by its saved label.
 * Uses exact match first, then fuzzy matching for robustness.
 * 
 * @param devices - Available camera devices
 * @param savedLabel - The saved camera label to find
 * @returns The matching device, or null if not found
 */
export function findDeviceByLabel(
  devices: MediaDeviceInfo[],
  savedLabel: string
): MediaDeviceInfo | null {
  if (!savedLabel || devices.length === 0) return null;

  // 1. Try exact match first
  const exactMatch = devices.find((d) => d.label === savedLabel);
  if (exactMatch) {
    console.log('[CameraPreference] Found exact label match:', exactMatch.label);
    return exactMatch;
  }

  // 2. Try case-insensitive exact match
  const savedLower = savedLabel.toLowerCase();
  const caseInsensitiveMatch = devices.find(
    (d) => d.label.toLowerCase() === savedLower
  );
  if (caseInsensitiveMatch) {
    console.log('[CameraPreference] Found case-insensitive match:', caseInsensitiveMatch.label);
    return caseInsensitiveMatch;
  }

  // 3. Fuzzy match: extract key identifiers from saved label and find similar
  const savedIdentifiers = extractCameraIdentifiers(savedLabel);
  
  // Score each device by how many identifiers match
  let bestMatch: MediaDeviceInfo | null = null;
  let bestScore = 0;

  for (const device of devices) {
    const deviceIdentifiers = extractCameraIdentifiers(device.label);
    let score = 0;

    // Check for matching identifiers
    if (savedIdentifiers.is1x && deviceIdentifiers.is1x) score += 100;
    if (savedIdentifiers.isMain && deviceIdentifiers.isMain) score += 80;
    if (savedIdentifiers.cameraNumber !== null && 
        savedIdentifiers.cameraNumber === deviceIdentifiers.cameraNumber) {
      score += 60;
    }
    if (savedIdentifiers.isBack && deviceIdentifiers.isBack) score += 40;
    
    // Penalize if key identifiers don't match
    if (savedIdentifiers.is1x && !deviceIdentifiers.is1x) score -= 50;
    if (savedIdentifiers.isMain && !deviceIdentifiers.isMain) score -= 30;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = device;
    }
  }

  if (bestMatch && bestScore > 50) {
    console.log('[CameraPreference] Found fuzzy match:', bestMatch.label, 'score:', bestScore);
    return bestMatch;
  }

  console.log('[CameraPreference] No match found for saved label:', savedLabel);
  return null;
}

/**
 * Extract identifying features from a camera label.
 */
function extractCameraIdentifiers(label: string): {
  is1x: boolean;
  isMain: boolean;
  isBack: boolean;
  cameraNumber: number | null;
  isUltraWide: boolean;
  isMacro: boolean;
  isTelephoto: boolean;
} {
  const lower = label.toLowerCase();
  
  // Extract camera number (e.g., "camera 0", "camera2 1")
  let cameraNumber: number | null = null;
  const camNumMatch = lower.match(/camera\s*2?\s*(\d+)/);
  if (camNumMatch) {
    cameraNumber = parseInt(camNumMatch[1], 10);
  }

  return {
    is1x: lower.includes('1x'),
    isMain: lower.includes('main'),
    isBack: lower.includes('back') || lower.includes('rear') || lower.includes('facing back'),
    cameraNumber,
    isUltraWide: lower.includes('ultra') || lower.includes('0.5x') || lower.includes('0.6x'),
    isMacro: lower.includes('macro'),
    isTelephoto: lower.includes('tele') || lower.includes('2x') || lower.includes('3x') || lower.includes('5x'),
  };
}
