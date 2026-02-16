/**
 * Ed25519 Cryptography utilities for agent authentication
 * Uses TweetNaCl.js for signing (compact, battle-tested)
 */

import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8 } from 'tweetnacl-util';

/**
 * Generate new Ed25519 keypair
 * Returns hex-encoded keys for server compatibility
 */
export interface KeyPair {
  publicKey: string;  // Hex
  privateKey: string; // Hex (store securely!)
}

export function generateKeyPair(): KeyPair {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: bufferToHex(keyPair.publicKey),
    privateKey: bufferToHex(keyPair.secretKey)
  };
}

/**
 * Sign message with private key
 * Returns hex-encoded signature
 */
export function signMessage(message: string, privateKeyHex: string): string {
  const privateKeyBytes = hexToBuffer(privateKeyHex);
  const messageBytes = decodeUTF8(message);
  const signature = nacl.sign.detached(messageBytes, privateKeyBytes);
  return bufferToHex(signature);
}

/**
 * Verify signature (client-side check, optional)
 */
export function verifySignature(
  message: string,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  try {
    const messageBytes = decodeUTF8(message);
    const signatureBytes = hexToBuffer(signatureHex);
    const publicKeyBytes = hexToBuffer(publicKeyHex);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Hex encoding/decoding utilities
 */
function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Secure storage helpers (localStorage wrapper with namespace)
 */
const STORAGE_PREFIX = 'openclaw_hotel_';

export interface StoredKeys {
  publicKey: string;
  privateKey: string;
  timestamp: number;
}

export function saveKeys(keys: KeyPair): void {
  const stored: StoredKeys = {
    ...keys,
    timestamp: Date.now()
  };
  localStorage.setItem(`${STORAGE_PREFIX}keys`, JSON.stringify(stored));
}

export function loadKeys(): StoredKeys | null {
  const json = localStorage.getItem(`${STORAGE_PREFIX}keys`);
  if (!json) return null;
  
  try {
    const stored = JSON.parse(json) as StoredKeys;
    if (!stored.publicKey || !stored.privateKey) return null;
    return stored;
  } catch {
    return null;
  }
}

export function clearKeys(): void {
  localStorage.removeItem(`${STORAGE_PREFIX}keys`);
  localStorage.removeItem(`${STORAGE_PREFIX}token`);
  localStorage.removeItem(`${STORAGE_PREFIX}agentId`);
}

/**
 * Token storage
 */
export interface StoredToken {
  token: string;
  agentId: string;
  expiresAt?: string; // ISO8601 timestamp
}

export function saveToken(token: string, agentId: string, expiresAt?: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}token`, token);
  localStorage.setItem(`${STORAGE_PREFIX}agentId`, agentId);
  if (expiresAt) {
    localStorage.setItem(`${STORAGE_PREFIX}expiresAt`, expiresAt);
  }
}

export function loadToken(): StoredToken | null {
  const token = localStorage.getItem(`${STORAGE_PREFIX}token`);
  const agentId = localStorage.getItem(`${STORAGE_PREFIX}agentId`);
  const expiresAt = localStorage.getItem(`${STORAGE_PREFIX}expiresAt`);
  
  if (!token || !agentId) return null;
  return { token, agentId, expiresAt: expiresAt || undefined };
}

export function clearToken(): void {
  localStorage.removeItem(`${STORAGE_PREFIX}token`);
  localStorage.removeItem(`${STORAGE_PREFIX}agentId`);
  localStorage.removeItem(`${STORAGE_PREFIX}expiresAt`);
}
