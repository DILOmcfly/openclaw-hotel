import { describe, expect, test } from 'vitest';
import { AuthService } from '../services/auth.js';
import { generateKeypair, hexToBytes, sign, verify } from '../utils/crypto.js';

describe('crypto utils', () => {
  test('generateKeypair + sign + verify', () => {
    const { publicKey, privateKey } = generateKeypair();
    const msg = 'hello-openclaw';
    const signature = sign(msg, hexToBytes(privateKey));

    expect(verify(msg, hexToBytes(signature), hexToBytes(publicKey))).toBe(true);
    expect(verify('tampered', hexToBytes(signature), hexToBytes(publicKey))).toBe(false);
  });
});

describe('auth flow', () => {
  test('register -> challenge -> verify -> validate token', () => {
    const authService = new AuthService();
    const { publicKey, privateKey } = generateKeypair();

    const timestamp = new Date().toISOString();
    const proof = sign(`REGISTER:${publicKey}:${timestamp}`, hexToBytes(privateKey));

    const agent = authService.registerAgent({
      publicKey,
      displayName: 'Aura',
      proof,
      timestamp,
    });

    expect(agent.id).toBeTruthy();

    const challenge = authService.createChallenge(publicKey);
    expect(challenge.challenge).toHaveLength(64);

    const challengeSig = sign(hexToBytes(challenge.challenge), hexToBytes(privateKey));
    const verified = authService.verifyChallenge(publicKey, challenge.challenge, challengeSig);

    expect(verified.token).toBeTruthy();
    expect(verified.expiresAt).toBeTruthy();

    const payload = authService.validateToken(verified.token);
    expect(payload.sub).toBe(agent.id);
    expect(payload.publicKey).toBe(publicKey);
  });
});
