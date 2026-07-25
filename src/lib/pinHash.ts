// PIN hashing utility for secure storage

const DEVICE_SALT_KEY = 'monipay_device_salt';

/**
 * Get or create a device-specific salt for PIN hashing.
 * This salt is unique to each device/browser and persists across sessions.
 */
function getDeviceSalt(): string {
  let salt = localStorage.getItem(DEVICE_SALT_KEY);
  
  if (!salt) {
    // Generate a random 32-byte salt
    const saltArray = new Uint8Array(32);
    crypto.getRandomValues(saltArray);
    salt = Array.from(saltArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(DEVICE_SALT_KEY, salt);
  }
  
  return salt;
}

/**
 * Hash a PIN with device-specific salt using SHA-256.
 * This is used for secure storage and comparison.
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = getDeviceSalt();
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against a stored hash.
 */
export async function verifyPinHash(pin: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPin(pin);
  return inputHash === storedHash;
}

/**
 * Check if a stored PIN value is hashed (64 hex chars) or plain text (4 digits).
 * Used for migration from plain text to hashed PINs.
 */
export function isPinHashed(storedPin: string): boolean {
  // SHA-256 produces 64 hex characters
  return storedPin.length === 64 && /^[0-9a-f]+$/i.test(storedPin);
}
