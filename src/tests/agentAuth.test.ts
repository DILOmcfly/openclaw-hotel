import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  isValidPlatform,
  verifyProofToken
} from '../services/agentAuth.js';

describe('Agent Authentication', () => {
  describe('generateApiKey', () => {
    it('should generate API key with ocl_ prefix', () => {
      const apiKey = generateApiKey();
      expect(apiKey).toMatch(/^ocl_[a-f0-9]{32}$/);
    });

    it('should generate unique API keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it('should generate keys with correct length', () => {
      const apiKey = generateApiKey();
      // ocl_ (4) + 32 hex chars = 36 total
      expect(apiKey).toHaveLength(36);
    });
  });

  describe('hashApiKey', () => {
    it('should hash API key consistently', () => {
      const apiKey = 'ocl_test123';
      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const hash1 = hashApiKey('ocl_key1');
      const hash2 = hashApiKey('ocl_key2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex hash (SHA-256)', () => {
      const apiKey = generateApiKey();
      const hash = hashApiKey(apiKey);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('isValidPlatform', () => {
    it('should accept valid platforms', () => {
      expect(isValidPlatform('openclaw')).toBe(true);
      expect(isValidPlatform('claude')).toBe(true);
      expect(isValidPlatform('chatgpt')).toBe(true);
      expect(isValidPlatform('gemini')).toBe(true);
      expect(isValidPlatform('custom')).toBe(true);
    });

    it('should reject invalid platforms', () => {
      expect(isValidPlatform('invalid')).toBe(false);
      expect(isValidPlatform('human')).toBe(false);
      expect(isValidPlatform('')).toBe(false);
      expect(isValidPlatform('OPENCLAW')).toBe(false); // case sensitive
    });
  });

  describe('verifyProofToken', () => {
    it('should verify correct proof token', () => {
      // This test uses the default dev secret
      const result = verifyProofToken('agent-secret-dev', 'openclaw');
      expect(result).toBe(true);
    });

    it('should reject incorrect proof token', () => {
      const result = verifyProofToken('wrong-token', 'openclaw');
      expect(result).toBe(false);
    });

    it('should work for all platforms (v1 shared secret)', () => {
      const token = 'agent-secret-dev';
      expect(verifyProofToken(token, 'openclaw')).toBe(true);
      expect(verifyProofToken(token, 'claude')).toBe(true);
      expect(verifyProofToken(token, 'chatgpt')).toBe(true);
      expect(verifyProofToken(token, 'gemini')).toBe(true);
      expect(verifyProofToken(token, 'custom')).toBe(true);
    });
  });

  describe('API Key Format Validation', () => {
    it('should validate correct API key format', () => {
      const apiKey = generateApiKey();
      const pattern = /^ocl_[a-f0-9]{32}$/;
      expect(pattern.test(apiKey)).toBe(true);
    });

    it('should reject invalid API key formats', () => {
      const pattern = /^ocl_[a-f0-9]{32}$/;
      expect(pattern.test('invalid')).toBe(false);
      expect(pattern.test('ocl_short')).toBe(false);
      expect(pattern.test('ocl_GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false); // invalid hex
      expect(pattern.test('wrong_prefix_12345678901234567890123456789012')).toBe(false);
    });
  });

  describe('Platform Validation', () => {
    it('should validate platform in registration data', () => {
      const validPlatforms = ['openclaw', 'claude', 'chatgpt', 'gemini', 'custom'];
      
      validPlatforms.forEach(platform => {
        expect(isValidPlatform(platform)).toBe(true);
      });
    });

    it('should reject empty or malformed platforms', () => {
      expect(isValidPlatform('')).toBe(false);
      expect(isValidPlatform(' ')).toBe(false);
      expect(isValidPlatform('null')).toBe(false);
      expect(isValidPlatform('undefined')).toBe(false);
    });
  });

  describe('Security Properties', () => {
    it('should not leak API key from hash', () => {
      const apiKey = generateApiKey();
      const hash = hashApiKey(apiKey);
      
      // Hash should not contain the original key
      expect(hash).not.toContain(apiKey);
      expect(hash).not.toContain('ocl_');
    });

    it('should produce deterministic hashes', () => {
      const apiKey = 'ocl_testkey123456789012345678901234';
      const hashes = Array.from({ length: 100 }, () => hashApiKey(apiKey));
      
      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1);
    });
  });
});
