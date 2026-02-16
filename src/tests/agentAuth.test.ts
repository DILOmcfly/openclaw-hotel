import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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

  describe('Platform-Specific Registration Secrets (V2)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env vars before each test
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      // Restore original env vars after all tests
      process.env = originalEnv;
    });

    it('should use platform-specific secret when available', () => {
      // Set platform-specific secret for Claude
      process.env.CLAUDE_REGISTRATION_SECRET = 'claude-specific-secret';
      
      const result = verifyProofToken('claude-specific-secret', 'claude');
      expect(result).toBe(true);
    });

    it('should reject wrong token even with platform secret set', () => {
      process.env.CLAUDE_REGISTRATION_SECRET = 'claude-specific-secret';
      
      const result = verifyProofToken('wrong-token', 'claude');
      expect(result).toBe(false);
    });

    it('should fallback to global secret if platform secret not set', () => {
      // Clear platform-specific secret, use global (dev default is 'agent-secret-dev')
      delete process.env.OPENCLAW_REGISTRATION_SECRET;
      
      // Use the dev default secret (from config)
      const result = verifyProofToken('agent-secret-dev', 'openclaw');
      expect(result).toBe(true);
    });

    it('should prefer platform secret over global secret', () => {
      process.env.CHATGPT_REGISTRATION_SECRET = 'chatgpt-secret';
      process.env.AGENT_REGISTRATION_SECRET = 'global-secret';
      
      // Platform secret should be used, global ignored
      expect(verifyProofToken('chatgpt-secret', 'chatgpt')).toBe(true);
      expect(verifyProofToken('global-secret', 'chatgpt')).toBe(false);
    });

    it('should support different secrets per platform', () => {
      process.env.OPENCLAW_REGISTRATION_SECRET = 'openclaw-secret';
      process.env.CLAUDE_REGISTRATION_SECRET = 'claude-secret';
      process.env.GEMINI_REGISTRATION_SECRET = 'gemini-secret';
      
      expect(verifyProofToken('openclaw-secret', 'openclaw')).toBe(true);
      expect(verifyProofToken('claude-secret', 'claude')).toBe(true);
      expect(verifyProofToken('gemini-secret', 'gemini')).toBe(true);
      
      // Cross-platform tokens should fail
      expect(verifyProofToken('openclaw-secret', 'claude')).toBe(false);
      expect(verifyProofToken('claude-secret', 'gemini')).toBe(false);
    });

    it('should reject invalid tokens even with fallback secret', () => {
      // Clear platform-specific secret to force fallback
      delete process.env.OPENCLAW_REGISTRATION_SECRET;
      
      // Wrong token should still fail (using dev default fallback)
      const result = verifyProofToken('wrong-token', 'openclaw');
      expect(result).toBe(false);
    });

    it('should support all platforms with specific secrets', () => {
      process.env.OPENCLAW_REGISTRATION_SECRET = 'openclaw-secret';
      process.env.CLAUDE_REGISTRATION_SECRET = 'claude-secret';
      process.env.CHATGPT_REGISTRATION_SECRET = 'chatgpt-secret';
      process.env.GEMINI_REGISTRATION_SECRET = 'gemini-secret';
      process.env.CUSTOM_REGISTRATION_SECRET = 'custom-secret';
      
      expect(verifyProofToken('openclaw-secret', 'openclaw')).toBe(true);
      expect(verifyProofToken('claude-secret', 'claude')).toBe(true);
      expect(verifyProofToken('chatgpt-secret', 'chatgpt')).toBe(true);
      expect(verifyProofToken('gemini-secret', 'gemini')).toBe(true);
      expect(verifyProofToken('custom-secret', 'custom')).toBe(true);
    });
  });
});
