/**
 * Authentication API client
 * Implements Ed25519 challenge-response authentication
 */

import {
  generateKeyPair,
  signMessage,
  saveKeys,
  loadKeys,
  saveToken,
  loadToken,
  clearKeys,
  clearToken
} from '../crypto/ed25519.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface AuthResult {
  success: boolean;
  agentId?: string;
  token?: string;
  error?: string;
}

/**
 * Register new agent with generated keypair
 */
export async function register(displayName: string): Promise<AuthResult> {
  try {
    // Generate new keypair
    const keys = generateKeyPair();
    const timestamp = Date.now().toString();
    
    // Sign registration message
    const message = `REGISTER:${keys.publicKey}:${timestamp}`;
    const proof = signMessage(message, keys.privateKey);

    // Call registration endpoint
    const response = await fetch(`${API_BASE}/api/v1/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: keys.publicKey,
        displayName,
        proof,
        timestamp
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    // Save keys locally
    saveKeys(keys);

    // Auto-login after registration
    return await login();
  } catch (error) {
    console.error('[AuthAPI] Registration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Login with stored keypair (challenge-response)
 */
export async function login(): Promise<AuthResult> {
  try {
    // Load stored keys
    const stored = loadKeys();
    if (!stored) {
      return {
        success: false,
        error: 'No keypair found. Please register first.'
      };
    }

    // Step 1: Request challenge
    const challengeResponse = await fetch(`${API_BASE}/api/v1/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: stored.publicKey })
    });

    if (!challengeResponse.ok) {
      const error = await challengeResponse.json();
      return {
        success: false,
        error: error.error || 'Failed to get challenge'
      };
    }

    const { challenge } = await challengeResponse.json();

    // Step 2: Sign challenge
    const signature = signMessage(challenge, stored.privateKey);

    // Step 3: Verify signature and get JWT
    const verifyResponse = await fetch(`${API_BASE}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: stored.publicKey,
        challenge,
        signature
      })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return {
        success: false,
        error: error.error || 'Challenge verification failed'
      };
    }

    const { token, expiresAt } = await verifyResponse.json();

    // Decode JWT to get agentId (no verification, just extract payload)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const agentId = payload.agentId;

    // Save token with expiration
    saveToken(token, agentId, expiresAt);

    console.log('[AuthAPI] Login successful:', { agentId, expiresAt });

    return {
      success: true,
      agentId,
      token
    };
  } catch (error) {
    console.error('[AuthAPI] Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Logout (clear local storage)
 */
export async function logout(): Promise<void> {
  try {
    const stored = loadToken();
    if (stored?.token) {
      // Call logout endpoint (optional, for future blacklist support)
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stored.token}`
        }
      });
    }
  } catch (error) {
    console.warn('[AuthAPI] Logout endpoint error (non-critical):', error);
  } finally {
    // Always clear local storage
    clearToken();
  }
}

/**
 * Get current session info from localStorage
 */
export function getCurrentSession(): { agentId: string; token: string } | null {
  return loadToken();
}

/**
 * Check if user has valid session (with token expiration check)
 */
export function isAuthenticated(): boolean {
  const session = loadToken();
  if (!session) return false;

  // Check token expiration
  if (session.expiresAt) {
    const expiresAtMs = new Date(session.expiresAt).getTime();
    const nowMs = Date.now();
    
    if (nowMs >= expiresAtMs) {
      // Token expired — clear it
      console.warn('[AuthAPI] Token expired, clearing session');
      clearToken();
      return false;
    }
  }

  return true;
}

/**
 * Delete account (clear keys + token)
 */
export function deleteLocalAccount(): void {
  clearKeys();
  clearToken();
}
