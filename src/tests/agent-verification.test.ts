import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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

  /**
   * verifyProofToken - Integration Tests
   *
   * T-323 made verifyProofToken async: for Claude/ChatGPT/Gemini it now performs
   * a real API call after format validation. Tests that expect `true` for a valid
   * FORMAT but fake key are skipped (they'd require live API keys).
   * Invalid-format paths return `false` synchronously (no API call needed), and
   * shared-secret platforms (openclaw, custom) are tested with await.
   */
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
      process.env = { ...originalEnv };
    });

    describe('Claude platform — format rejection (no API call)', () => {
      it('should reject invalid Anthropic API key format (returns false without API call)', async () => {
        const invalidKey = 'sk-invalid-key';
        await expect(verifyProofToken(invalidKey, 'claude')).resolves.toBe(false);
      });

      it('should reject shared secret for claude platform', async () => {
        const secret = 'some-shared-secret';
        await expect(verifyProofToken(secret, 'claude')).resolves.toBe(false);
      });

      it('should reject empty string for claude platform', async () => {
        await expect(verifyProofToken('', 'claude')).resolves.toBe(false);
      });
    });

    describe('ChatGPT platform — format rejection (no API call)', () => {
      it('should reject invalid OpenAI API key format', async () => {
        const invalidKey = 'sk-short';
        await expect(verifyProofToken(invalidKey, 'chatgpt')).resolves.toBe(false);
      });

      it('should reject empty string for chatgpt platform', async () => {
        await expect(verifyProofToken('', 'chatgpt')).resolves.toBe(false);
      });
    });

    describe('Gemini platform — format rejection (no API call)', () => {
      it('should reject invalid Google AI API key format', async () => {
        const invalidKey = 'AIzaShort';
        await expect(verifyProofToken(invalidKey, 'gemini')).resolves.toBe(false);
      });

      it('should reject empty string for gemini platform', async () => {
        await expect(verifyProofToken('', 'gemini')).resolves.toBe(false);
      });
    });

    describe('OpenClaw platform (shared secret — synchronous comparison)', () => {
      it('should verify with platform-specific secret', async () => {
        await expect(verifyProofToken('openclaw-secret-123', 'openclaw')).resolves.toBe(true);
      });

      it('should reject wrong secret', async () => {
        await expect(verifyProofToken('wrong-secret', 'openclaw')).resolves.toBe(false);
      });

      it('should reject API key format for openclaw', async () => {
        const apiKey = 'sk-ant-api03-' + 'a'.repeat(95);
        await expect(verifyProofToken(apiKey, 'openclaw')).resolves.toBe(false);
      });
    });

    describe('Custom platform (shared secret — synchronous comparison)', () => {
      it('should verify with platform-specific secret', async () => {
        await expect(verifyProofToken('custom-secret-456', 'custom')).resolves.toBe(true);
      });

      it('should fallback to global secret if platform secret not set', async () => {
        delete process.env.CUSTOM_REGISTRATION_SECRET;
        // Config default is 'agent-secret-dev' (loaded at module init)
        await expect(verifyProofToken('agent-secret-dev', 'custom')).resolves.toBe(true);
        // Restore for other tests
        process.env.CUSTOM_REGISTRATION_SECRET = 'custom-secret-456';
      });

      it('should reject wrong secret', async () => {
        await expect(verifyProofToken('wrong-secret', 'custom')).resolves.toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings for format validation', () => {
      expect(validateApiKeyFormat('', 'claude')).toBe(false);
      expect(validateApiKeyFormat('', 'chatgpt')).toBe(false);
      expect(validateApiKeyFormat('', 'gemini')).toBe(false);
    });

    it('should handle null-like inputs gracefully (async)', async () => {
      await expect(verifyProofToken('', 'claude')).resolves.toBe(false);
      await expect(verifyProofToken('', 'chatgpt')).resolves.toBe(false);
      await expect(verifyProofToken('', 'gemini')).resolves.toBe(false);
    });

    it('should handle very long keys in format validation', () => {
      const veryLongKey = 'sk-ant-api03-' + 'a'.repeat(500);
      expect(validateApiKeyFormat(veryLongKey, 'claude')).toBe(true);
    });
  });
});
