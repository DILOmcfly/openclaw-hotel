import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { config } from '../config.js';
import { validateToken } from '../services/auth.js';
import { generateKeypair, sign, verify } from '../utils/crypto.js';

describe('auth service', () => {
  it('validateToken returns payload for valid token', () => {
    const payload = {
      agentId: 'agent-123',
      publicKey: 'deadbeef'
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: 60 });

    expect(validateToken(token)).toEqual(payload);
  });

  it('validateToken throws for expired token', () => {
    const payload = {
      agentId: 'agent-123',
      publicKey: 'deadbeef'
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: -1 });

    expect(() => validateToken(token)).toThrow('Invalid or expired token');
  });

  it('validateToken throws for invalid token', () => {
    expect(() => validateToken('not-a-token')).toThrow('Invalid or expired token');
  });

  it('crypto sign and verify interoperate', () => {
    const { publicKey, secretKey } = generateKeypair();
    const challenge = 'challenge-abc-123';

    const signature = sign(challenge, secretKey);

    expect(verify(challenge, signature, publicKey)).toBe(true);
  });
});
