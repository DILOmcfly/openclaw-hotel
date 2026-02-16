import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  isValidPlatform,
  verifyProofToken,
  validateApiKeyFormat
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
    it('should verify correct proof token', async () => {
      // This test uses the default dev secret
      const result = await verifyProofToken('agent-secret-dev', 'openclaw');
      expect(result).toBe(true);
    });

    it('should reject incorrect proof token', async () => {
      const result = await verifyProofToken('wrong-token', 'openclaw');
      expect(result).toBe(false);
    });

    it('should work for shared secret platforms (openclaw, custom)', async () => {
      const token = 'agent-secret-dev';
      expect(await verifyProofToken(token, 'openclaw')).toBe(true);
      expect(await verifyProofToken(token, 'custom')).toBe(true);
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

    it('should fallback to global secret if platform secret not set', async () => {
      // Clear platform-specific secret, use global (dev default is 'agent-secret-dev')
      delete process.env.OPENCLAW_REGISTRATION_SECRET;
      
      // Use the dev default secret (from config)
      const result = await verifyProofToken('agent-secret-dev', 'openclaw');
      expect(result).toBe(true);
    });

    it('should reject invalid tokens even with fallback secret', async () => {
      // Clear platform-specific secret to force fallback
      delete process.env.OPENCLAW_REGISTRATION_SECRET;
      
      // Wrong token should still fail (using dev default fallback)
      const result = await verifyProofToken('wrong-token', 'openclaw');
      expect(result).toBe(false);
    });

    it('should support all shared-secret platforms', async () => {
      process.env.OPENCLAW_REGISTRATION_SECRET = 'openclaw-secret';
      process.env.CUSTOM_REGISTRATION_SECRET = 'custom-secret';
      
      expect(await verifyProofToken('openclaw-secret', 'openclaw')).toBe(true);
      expect(await verifyProofToken('custom-secret', 'custom')).toBe(true);
    });
  });

  describe('Platform API Verification (V4)', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      // Mock fetch for each test
      global.fetch = vi.fn();
    });

    afterAll(() => {
      // Restore original fetch
      global.fetch = originalFetch;
    });

    describe('Claude (Anthropic) API Verification', () => {
      it('should accept valid Claude API key', async () => {
        const validKey = 'sk-ant-api03-' + 'a'.repeat(95);
        
        // Mock successful Anthropic API response
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 200
        });

        const result = await verifyProofToken(validKey, 'claude');
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.anthropic.com/v1/messages',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'x-api-key': validKey
            })
          })
        );
      });

      it('should reject invalid Claude API key (API returns 401)', async () => {
        const invalidKey = 'sk-ant-api03-' + 'a'.repeat(95);
        
        // Mock failed Anthropic API response (401 Unauthorized)
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 401
        });

        const result = await verifyProofToken(invalidKey, 'claude');
        expect(result).toBe(false);
      });

      it('should reject malformed Claude API key (format check fails)', async () => {
        const malformedKey = 'sk-wrong-format';
        
        // Should not even call API (format check fails first)
        const result = await verifyProofToken(malformedKey, 'claude');
        expect(result).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should handle network errors gracefully', async () => {
        const validKey = 'sk-ant-api03-' + 'a'.repeat(95);
        
        // Mock network error
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        const result = await verifyProofToken(validKey, 'claude');
        expect(result).toBe(false);
      });

      it('should handle timeout errors gracefully', async () => {
        const validKey = 'sk-ant-api03-' + 'a'.repeat(95);
        
        // Mock timeout error
        (global.fetch as any).mockRejectedValueOnce(new Error('The operation was aborted due to timeout'));

        const result = await verifyProofToken(validKey, 'claude');
        expect(result).toBe(false);
      });
    });

    describe('ChatGPT (OpenAI) API Verification', () => {
      it('should accept valid OpenAI API key', async () => {
        const validKey = 'sk-' + 'a'.repeat(48);
        
        // Mock successful OpenAI API response
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 200
        });

        const result = await verifyProofToken(validKey, 'chatgpt');
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/models',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'Authorization': `Bearer ${validKey}`
            })
          })
        );
      });

      it('should accept valid OpenAI project API key', async () => {
        const validKey = 'sk-proj-' + 'a'.repeat(48);
        
        // Mock successful OpenAI API response
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 200
        });

        const result = await verifyProofToken(validKey, 'chatgpt');
        expect(result).toBe(true);
      });

      it('should reject invalid OpenAI API key (API returns 401)', async () => {
        const invalidKey = 'sk-' + 'a'.repeat(48);
        
        // Mock failed OpenAI API response (401 Unauthorized)
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 401
        });

        const result = await verifyProofToken(invalidKey, 'chatgpt');
        expect(result).toBe(false);
      });

      it('should reject malformed OpenAI API key (format check fails)', async () => {
        const malformedKey = 'wrong-format';
        
        // Should not even call API (format check fails first)
        const result = await verifyProofToken(malformedKey, 'chatgpt');
        expect(result).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('Gemini (Google AI) API Verification', () => {
      it('should accept valid Google AI API key', async () => {
        const validKey = 'AIza' + 'a'.repeat(35);
        
        // Mock successful Google AI API response
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          status: 200
        });

        const result = await verifyProofToken(validKey, 'gemini');
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          `https://generativelanguage.googleapis.com/v1/models?key=${validKey}`,
          expect.objectContaining({
            method: 'GET'
          })
        );
      });

      it('should reject invalid Google AI API key (API returns 403)', async () => {
        const invalidKey = 'AIza' + 'a'.repeat(35);
        
        // Mock failed Google AI API response (403 Forbidden)
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 403
        });

        const result = await verifyProofToken(invalidKey, 'gemini');
        expect(result).toBe(false);
      });

      it('should reject malformed Google AI API key (format check fails)', async () => {
        const malformedKey = 'wrong-format';
        
        // Should not even call API (format check fails first)
        const result = await verifyProofToken(malformedKey, 'gemini');
        expect(result).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('API Key Format Validation', () => {
      it('should validate Claude API key format', () => {
        const validKey = 'sk-ant-api03-' + 'a'.repeat(95);
        const invalidKey = 'sk-ant-short';
        
        expect(validateApiKeyFormat(validKey, 'claude')).toBe(true);
        expect(validateApiKeyFormat(invalidKey, 'claude')).toBe(false);
      });

      it('should validate OpenAI API key formats', () => {
        const validKey1 = 'sk-' + 'a'.repeat(48);
        const validKey2 = 'sk-proj-' + 'a'.repeat(48);
        const invalidKey = 'sk-short';
        
        expect(validateApiKeyFormat(validKey1, 'chatgpt')).toBe(true);
        expect(validateApiKeyFormat(validKey2, 'chatgpt')).toBe(true);
        expect(validateApiKeyFormat(invalidKey, 'chatgpt')).toBe(false);
      });

      it('should validate Google AI API key format', () => {
        const validKey = 'AIza' + 'a'.repeat(35);
        const invalidKey = 'AIzaShort';
        
        expect(validateApiKeyFormat(validKey, 'gemini')).toBe(true);
        expect(validateApiKeyFormat(invalidKey, 'gemini')).toBe(false);
      });

      it('should reject API key format for shared-secret platforms', () => {
        expect(validateApiKeyFormat('any-string', 'openclaw')).toBe(false);
        expect(validateApiKeyFormat('any-string', 'custom')).toBe(false);
      });
    });
  });
});
