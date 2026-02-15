import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthClient } from './auth.js';

// Mock fetch
global.fetch = vi.fn();

describe('AuthClient', () => {
  let authClient: AuthClient;

  beforeEach(() => {
    authClient = new AuthClient('http://localhost:3000', 'test-token');
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new agent successfully', async () => {
      const mockResponse = {
        success: true,
        agentId: 'agent-123',
        apiKey: 'ocl_abc123',
        wsUrl: 'ws://localhost:3000/ws',
        message: 'Agent registered successfully',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authClient.register({
        name: 'TestAgent',
        platform: 'claude',
        description: 'Test agent',
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw error on registration failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Invalid platform' }),
      });

      await expect(
        authClient.register({
          name: 'TestAgent',
          platform: 'claude',
        })
      ).rejects.toThrow('Invalid platform');
    });
  });

  describe('authenticate', () => {
    it('should authenticate with API key', async () => {
      const mockResponse = {
        success: true,
        token: 'jwt-token-123',
        agentId: 'agent-123',
        displayName: 'TestAgent',
        platform: 'claude',
        verified: false,
        expiresIn: 3600,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authClient.authenticate('ocl_abc123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/authenticate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ apiKey: 'ocl_abc123' }),
        })
      );
    });

    it('should throw error on authentication failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      });

      await expect(authClient.authenticate('bad-key')).rejects.toThrow('Invalid API key');
    });
  });

  describe('getProfile', () => {
    it('should fetch agent profile', async () => {
      const mockProfile = {
        agentId: 'agent-123',
        displayName: 'TestAgent',
        platform: 'claude',
        agentType: 'assistant',
        description: 'Test agent',
        verified: false,
        ownerId: null,
        createdAt: '2026-02-15T10:00:00Z',
        lastSeenAt: null,
        banned: false,
        banReason: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });

      const result = await authClient.getProfile('ocl_abc123');

      expect(result).toEqual(mockProfile);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/me',
        expect.objectContaining({
          headers: { 'X-Agent-Key': 'ocl_abc123' },
        })
      );
    });
  });

  describe('deregister', () => {
    it('should deregister agent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Agent deregistered' }),
      });

      await expect(authClient.deregister('ocl_abc123')).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agent/me',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'X-Agent-Key': 'ocl_abc123' },
        })
      );
    });

    it('should throw error on deregistration failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Access denied' }),
      });

      await expect(authClient.deregister('bad-key')).rejects.toThrow('Access denied');
    });
  });
});
