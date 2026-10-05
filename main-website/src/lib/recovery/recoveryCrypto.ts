import CryptoJS from 'crypto-js';

// Base32 character set excluding ambiguous characters (0, O, 1, I, L)
const RECOVERY_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates an unpredictable, cryptographically secure recovery code.
 * Example format: LNL-7K4P-92XM
 */
export function generateEmergencyRecoveryCode(): string {
  const segment1 = generateRandomSegment(4);
  const segment2 = generateRandomSegment(4);
  return `LNL-${segment1}-${segment2}`;
}

function generateRandomSegment(length: number): string {
  let result = '';
  // Use crypto-js WordArray for cryptographic randomness across Node & browser
  const randomWords = CryptoJS.lib.WordArray.random(length);
  const hex = randomWords.toString();
  for (let i = 0; i < length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    result += RECOVERY_CHARSET[byte % RECOVERY_CHARSET.length];
  }
  return result;
}

/**
 * Normalizes and hashes the recovery code using SHA-256.
 * Ensures consistent comparison even if user enters lowercase or omits hyphens.
 */
export function hashEmergencyRecoveryCode(code: string): string {
  const normalized = (code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return CryptoJS.SHA256(normalized).toString();
}

/**
 * Verifies if user input matches the stored hash
 */
export function verifyEmergencyRecoveryCode(inputCode: string, storedHash: string): boolean {
  if (!inputCode || !storedHash) return false;
  return hashEmergencyRecoveryCode(inputCode) === storedHash;
}

/**
 * Generates a cryptographically secure 4-digit temporary PIN (1000 - 9999)
 */
export function generateTemporaryPin(): string {
  const randomWords = CryptoJS.lib.WordArray.random(2);
  const rawNum = Math.abs(randomWords.words[0]) % 9000;
  return (1000 + rawNum).toString();
}
