import crypto from 'crypto';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-please-change-in-production';
const ALGORITHM = 'aes-256-gcm';

export function encryptRefreshToken(token: string): string {
  try {
    // Using crypto-js for AES encryption
    const encrypted = CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    throw new Error('Failed to encrypt refresh token');
  }
}

export function decryptRefreshToken(encryptedToken: string): string {
  try {
    // Using crypto-js for AES decryption
    const decrypted = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
    const token = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!token) {
      throw new Error('Failed to decrypt token - encryption key may have changed');
    }
    
    return token;
  } catch (error) {
    console.warn('Encryption key mismatch detected. This usually happens when the ENCRYPTION_KEY environment variable changes.');
    console.warn('Users will need to reconnect their Spotify accounts.');
    throw new Error('Failed to decrypt refresh token - encryption key may have changed');
  }
}

export function hashIP(ip: string): string {
  // Create a hash of the IP address for privacy
  return crypto.createHash('sha256')
    .update(ip + ENCRYPTION_KEY) // Add salt using encryption key
    .digest('hex');
}