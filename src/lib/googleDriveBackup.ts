// Google Drive Backup Manager for MoniPay Wallet
// Uses Web Crypto API for AES-GCM encryption and Google Drive API v3

const BACKUP_FILENAME = 'monipay_wallet_backup.json';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface BackupData {
  encryptedData: string;
  iv: string;
  timestamp: number;
  payTag?: string;
}

export interface BackupResult {
  success: boolean;
  timestamp?: number;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  privateKey?: string;
  error?: string;
}

// Convert string to ArrayBuffer
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

// Derive a cryptographic key from PIN using PBKDF2
async function deriveKeyFromPin(pin: string, salt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const useSalt = salt || crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToArrayBuffer(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: useSalt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, salt: useSalt };
}

// Encrypt private key with PIN using AES-GCM
export async function encryptForBackup(privateKey: string, pin: string): Promise<{ encryptedData: string; iv: string; salt: string }> {
  const { key, salt } = await deriveKeyFromPin(pin);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    stringToArrayBuffer(privateKey)
  );

  return {
    encryptedData: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

// Decrypt private key with PIN using AES-GCM
export async function decryptFromBackup(encryptedData: string, iv: string, salt: string, pin: string): Promise<string> {
  const saltBuffer = new Uint8Array(base64ToArrayBuffer(salt));
  const { key } = await deriveKeyFromPin(pin, saltBuffer);
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));
  const encryptedBuffer = base64ToArrayBuffer(encryptedData);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Search for existing backup file in appDataFolder
async function findBackupFile(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${BACKUP_FILENAME}'`,
    fields: 'files(id,name,modifiedTime)',
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to search Google Drive');
  }

  const data = await response.json();
  return data.files?.[0]?.id || null;
}

// Upload backup to Google Drive
export async function uploadBackup(
  accessToken: string,
  encryptedData: string,
  iv: string,
  salt: string,
  payTag?: string
): Promise<BackupResult> {
  try {
    const backupContent: BackupData & { salt: string } = {
      encryptedData,
      iv,
      salt,
      timestamp: Date.now(),
      payTag,
    };

    const metadata = {
      name: BACKUP_FILENAME,
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    };

    // Check if file already exists
    const existingFileId = await findBackupFile(accessToken);

    if (existingFileId) {
      // Update existing file
      const response = await fetch(`${DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupContent),
      });

      if (!response.ok) {
        throw new Error('Failed to update backup');
      }
    } else {
      // Create new file using multipart upload
      const boundary = 'backup_boundary_' + Date.now();
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        JSON.stringify(backupContent),
        `--${boundary}--`,
      ].join('\r\n');

      const response = await fetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });

      if (!response.ok) {
        throw new Error('Failed to create backup');
      }
    }

    return { success: true, timestamp: backupContent.timestamp };
  } catch (error) {
    console.error('[GoogleDrive] Upload failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Download backup from Google Drive
export async function downloadBackup(accessToken: string): Promise<(BackupData & { salt: string }) | null> {
  try {
    const fileId = await findBackupFile(accessToken);
    
    if (!fileId) {
      return null;
    }

    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download backup');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[GoogleDrive] Download failed:', error);
    return null;
  }
}

// Check if backup exists
export async function checkBackupExists(accessToken: string): Promise<{ exists: boolean; timestamp?: number }> {
  try {
    const fileId = await findBackupFile(accessToken);
    
    if (!fileId) {
      return { exists: false };
    }

    // Get file metadata for timestamp
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=modifiedTime`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return { exists: true };
    }

    const data = await response.json();
    return { 
      exists: true, 
      timestamp: new Date(data.modifiedTime).getTime() 
    };
  } catch {
    return { exists: false };
  }
}
