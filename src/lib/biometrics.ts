// Biometric authentication using Web Authentication API

const BIOMETRIC_CREDENTIAL_KEY = 'monipay_biometric_credential';
const BIOMETRIC_ENABLED_KEY = 'monipay_biometric_enabled';
const BIOMETRIC_PIN_KEY = 'monipay_biometric_pin';

// Get stored raw PIN for biometric unlock
export function getStoredPin(): string | null {
  return localStorage.getItem(BIOMETRIC_PIN_KEY);
}

// Store raw PIN for biometric unlock (called during registration)
export function storePin(pin: string): void {
  localStorage.setItem(BIOMETRIC_PIN_KEY, pin);
}

// Clear stored PIN
export function clearStoredPin(): void {
  localStorage.removeItem(BIOMETRIC_PIN_KEY);
}

// Check if WebAuthn is supported
export function isBiometricsAvailable(): boolean {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

// Check if biometrics is enabled for this user
export function isBiometricsEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
}

// Enable biometrics
export function setBiometricsEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
  } else {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
    clearStoredPin();
  }
}

// Generate a random challenge
function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Register biometric credential
export async function registerBiometric(userId: string): Promise<boolean> {
  if (!isBiometricsAvailable()) {
    throw new Error('Biometrics not supported on this device');
  }

  try {
    const challenge = generateChallenge();
    const userIdArray = new TextEncoder().encode(userId);
    
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: challenge.buffer as ArrayBuffer,
      rp: {
        name: 'MoniPay',
        id: window.location.hostname,
      },
      user: {
        id: userIdArray.buffer as ArrayBuffer,
        name: userId,
        displayName: `@${userId}`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    if (credential) {
      // Store the credential ID for later authentication
      const credentialId = arrayBufferToBase64(credential.rawId);
      localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
      setBiometricsEnabled(true);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Biometric registration failed:', error);
    throw error;
  }
}

// Authenticate with biometric
export async function authenticateBiometric(): Promise<boolean> {
  if (!isBiometricsAvailable()) {
    throw new Error('Biometrics not supported on this device');
  }

  const storedCredentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!storedCredentialId) {
    throw new Error('No biometric credential registered');
  }

  try {
    const challenge = generateChallenge();
    
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge.buffer as ArrayBuffer,
      allowCredentials: [
        {
          id: base64ToArrayBuffer(storedCredentialId),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    return !!assertion;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    throw error;
  }
}
