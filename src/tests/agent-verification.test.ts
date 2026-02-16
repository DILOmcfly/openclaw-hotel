import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateApiKeyFormat, verifyProofToken } from '../services/agentAuth.js';

describe('Agent Verification - Platform-Specific API Key Validation', () => {
  describe('validateApiKeyFormat', () => {
    describe('Claude (Anthropic)', () => {
      it('should accept valid Anthropic API key format', () => {
        const validKey = 'sk-ant-api03-' + 'a'.repeat(95);
        expect(validateApiKeyFormat(validKey, 'claude')).toBe(true);
      });

      it('should accept longer Anthropic API keys', () => {
        const validKey = 'sk-ant-api03-' + 'A1b2C3d4_-'.repeat(15);
        expect(validateApiKeyFormat(validKey, 'claude')).toBe(true);
      });

      it('should reject short Anthropic API keys', () => {
        const shortKey = 'sk-ant-api03-short';
        expect(validateApiKeyFormat(shortKey, 'claude')).toBe(false);
      });

      it('should reject keys without sk-ant prefix', () => {
        const invalidKey = 'sk-' + 'a'.repeat(100);
        expect(validateApiKeyFormat(invalidKey, 'claude')).toBe(false);
      });

      it('should reject keys with invalid characters', () => {
        const invalidKey = 'sk-ant-api03-' + 'a'.repeat(85) + 'invalid@#$';
        expect(validateApiKeyFormat(invalidKey, 'claude')).toBe(false);
      });
    });

    describe('ChatGPT (OpenAI)', () => {
      it('should accept valid OpenAI API key format', () => {
        const validKey = 'sk-' + 'a'.repeat(48);
        expect(validateApiKeyFormat(validKey, 'chatgpt')).toBe(true);
      });

      it('should accept OpenAI project API key format', () => {
        const validKey = 'sk-proj-' + 'B'.repeat(48);
        expect(validateApiKeyFormat(validKey, 'chatgpt')).toBe(true);
      });

      it('should accept longer OpenAI API keys', () => {
        const validKey = 'sk-' + '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP';
        expect(validateApiKeyFormat(validKey, 'chatgpt')).toBe(true);
      });

      it('should reject short OpenAI API keys', () => {
        const shortKey = 'sk-short';
        expect(validateApiKeyFormat(shortKey, 'chatgpt')).toBe(false);
      });

      it('should reject keys without sk prefix', () => {
        const invalidKey = 'api-' + 'a'.repeat(48);
        expect(validateApiKeyFormat(invalidKey, 'chatgpt')).toBe(false);
      });
    });

    describe('Gemini (Google AI)', () => {
      it('should accept valid Google AI API key format', () => {
        const validKey = 'AIza' + 'x'.repeat(35);
        expect(validateApiKeyFormat(validKey, 'gemini')).toBe(true);
      });

      it('should accept longer Google AI API keys', () => {
        const validKey = 'AIza' + 'SyD1234567890abcdefghijklmnopqrstuvwxyz';
        expect(validateApiKeyFormat(validKey, 'gemini')).toBe(true);
      });

      it('should reject short Google AI API keys', () => {
        const shortKey = 'AIzaShort';
        expect(validateApiKeyFormat(shortKey, 'gemini')).toBe(false);
      });

      it('should reject keys without AIza prefix', () => {
        const invalidKey = 'GOOG' + 'a'.repeat(35);
        expect(validateApiKeyFormat(invalidKey, 'gemini')).toBe(false);
      });

      it('should accept valid characters (base64-like)', () => {
        const validKey = 'AIza' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'.substring(0, 35);
        expect(validateApiKeyFormat(validKey, 'gemini')).toBe(true);
      });
    });

    describe('OpenClaw & Custom (Shared Secret)', () => {
      it('should reject API key format for openclaw platform', () => {
        const apiKey = 'sk-ant-api03-' + 'a'.repeat(95);
        expect(validateApiKeyFormat(apiKey, 'openclaw')).toBe(false);
      });

      it('should reject API key format for custom platform', () => {
        const apiKey = 'sk-' + 'a'.repeat(48);
        expect(validateApiKeyFormat(apiKey, 'custom')).toBe(false);
      });
    });
  });

  describe('verifyProofToken - Integration', () => {
    const originalEnv = { ...process.env };

    beforeAll(() => {
      // Set up test environment variables
      process.env.OPENCLAW_REGISTRATION_SECRET = 'openclaw-secret-123';
      process.env.CUSTOM_REGISTRATION_SECRET = 'custom-secret-456';
      process.env.AGENT_REGISTRATION_SECRET = 'global-fallback-secret';
    });

    afterAll(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    describe('Claude platform', () => {
      it('should verify valid Anthropic API key', () => {
        const validKey = 'sk-ant-api03-' + 'A1B2C3D4E5F6'.repeat(10);
        expect(verifyProofToken(validKey, 'claude')).toBe(true);
      });

      it('should reject invalid Anthropic API key format', () => {
        const invalidKey = 'sk-invalid-key';
        expect(verifyProofToken(invalidKey, 'claude')).toBe(false);
      });

      it('should reject shared secret for claude platform', () => {
        const secret = 'some-shared-secret';
        expect(verifyProofToken(secret, 'claude')).toBe(false);
      });
    });

    describe('ChatGPT platform', () => {
      it('should verify valid OpenAI API key', () => {
        const validKey = 'sk-' + 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKL';
        expect(verifyProofToken(validKey, 'chatgpt')).toBe(true);
      });

      it('should verify valid OpenAI project API key', () => {
        const validKey = 'sk-proj-' + 'x'.repeat(48);
        expect(verifyProofToken(validKey, 'chatgpt')).toBe(true);
      });

      it('should reject invalid OpenAI API key format', () => {
        const invalidKey = 'sk-short';
        expect(verifyProofToken(invalidKey, 'chatgpt')).toBe(false);
      });
    });

    describe('Gemini platform', () => {
      it('should verify valid Google AI API key', () => {
        const validKey = 'AIza' + 'SyDx1234567890abcdefghijklmnopqrstu'; // 35 chars after prefix
        expect(verifyProofToken(validKey, 'gemini')).toBe(true);
      });

      it('should reject invalid Google AI API key format', () => {
        const invalidKey = 'AIzaShort';
        expect(verifyProofToken(invalidKey, 'gemini')).toBe(false);
      });
    });

    describe('OpenClaw platform (shared secret)', () => {
      it('should verify with platform-specific secret', () => {
        expect(verifyProofToken('openclaw-secret-123', 'openclaw')).toBe(true);
      });

      it('should reject wrong secret', () => {
        expect(verifyProofToken('wrong-secret', 'openclaw')).toBe(false);
      });

      it('should reject API key format for openclaw', () => {
        const apiKey = 'sk-ant-api03-' + 'a'.repeat(95);
        expect(verifyProofToken(apiKey, 'openclaw')).toBe(false);
      });
    });

    describe('Custom platform (shared secret)', () => {
      it('should verify with platform-specific secret', () => {
        expect(verifyProofToken('custom-secret-456', 'custom')).toBe(true);
      });

      it('should fallback to global secret if platform secret not set', () => {
        delete process.env.CUSTOM_REGISTRATION_SECRET;
        // Config default is 'agent-secret-dev' (loaded at module init)
        expect(verifyProofToken('agent-secret-dev', 'custom')).toBe(true);
        // Restore for other tests
        process.env.CUSTOM_REGISTRATION_SECRET = 'custom-secret-456';
      });

      it('should reject wrong secret', () => {
        expect(verifyProofToken('wrong-secret', 'custom')).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      expect(validateApiKeyFormat('', 'claude')).toBe(false);
      expect(validateApiKeyFormat('', 'chatgpt')).toBe(false);
      expect(validateApiKeyFormat('', 'gemini')).toBe(false);
    });

    it('should handle null-like inputs gracefully', () => {
      expect(verifyProofToken('', 'claude')).toBe(false);
      expect(verifyProofToken('', 'chatgpt')).toBe(false);
      expect(verifyProofToken('', 'gemini')).toBe(false);
    });

    it('should handle very long keys', () => {
      const veryLongKey = 'sk-ant-api03-' + 'a'.repeat(500);
      expect(validateApiKeyFormat(veryLongKey, 'claude')).toBe(true);
    });
  });
});
