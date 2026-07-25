// Device ID generator for rate limiting
// Creates a persistent device fingerprint stored in localStorage

const DEVICE_ID_KEY = 'monipay_device_id';

/**
 * Generates a unique device ID using crypto.randomUUID
 * Falls back to timestamp + random if not available
 */
function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Gets or creates a persistent device ID
 * Stored in localStorage for persistence across sessions
 */
export function getDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch {
    // If localStorage is not available, generate a temporary ID
    return generateDeviceId();
  }
}
