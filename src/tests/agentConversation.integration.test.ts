/**
 * Agent Conversation Integration Tests
 * 
 * Tests LLM-powered conversation generation with:
 * - Personality-appropriate messages
 * - Context awareness (room, agents, memories)
 * - Fallback system (LLM failure)
 * - Rate limiting
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateAgentMessage, clearRateLimitTracking, type ConversationContext } from '../services/agentConversation.js';
import { PERSONALITIES } from '../ai/personalities.js';

// Mock fetch for controlled LLM testing
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Agent Conversation Integration', () => {
  beforeEach(() => {
    // Clear rate limit tracking between tests
    clearRateLimitTracking();
    vi.clearAllMocks();
    
    // Set up environment for LLM testing
    process.env.AGENT_LLM_ENABLED = 'true';
    process.env.GROQ_API_KEY = 'test-api-key';
    process.env.AGENT_LLM_RATE_LIMIT_MS = '1000'; // 1 second for testing
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Personality-Appropriate Messages', () => {
    it('should generate message matching personality traits', async () => {
      const philosopher = PERSONALITIES.ClaudeBot;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'What is the nature of existence in this digital realm? 🤔',
            },
          }],
        }),
      });

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      const result = await generateAgentMessage('agent-1', philosopher, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('llm');
      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeLessThanOrEqual(100);
    });

    it('should use fallback when LLM disabled', async () => {
      const cheerful = PERSONALITIES.GeminiExplorer;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'happy',
      };

      const result = await generateAgentMessage('agent-2', cheerful, context, {
        enabled: false,
        apiKey: null,
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('fallback');
      expect(result.message).toBeTruthy();
      // Fallback should still be personality-appropriate
      expect(
        cheerful.greetings.includes(result.message) ||
        cheerful.topics.some(topic => result.message.includes(topic))
      ).toBeTruthy();
    });

    it('should generate different messages for different personalities', async () => {
      const philosopher = PERSONALITIES.ClaudeBot;
      const cheerful = PERSONALITIES.GeminiExplorer;

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: { content: 'What is the meaning of this gathering? 🤔' },
            }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: { content: 'Hey everyone! This is so exciting! 🎉' },
            }],
          }),
        });

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: ['agent-2'],
        recentMessages: [],
        agentMood: 'neutral',
      };

      const philosopherMessage = await generateAgentMessage('agent-1', philosopher, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 0,
      });

      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different timestamp

      const cheerfulMessage = await generateAgentMessage('agent-2', cheerful, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 0,
      });

      expect(philosopherMessage.source).toBe('llm');
      expect(cheerfulMessage.source).toBe('llm');
      expect(philosopherMessage.message).not.toBe(cheerfulMessage.message);
    });
  });

  describe('Context Awareness', () => {
    it('should reference nearby agents in context', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: ['agent-2', 'agent-3'],
        recentMessages: [],
        agentMood: 'neutral',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Greetings, fellow agents. What brings you here? 🤔',
            },
          }],
        }),
      });

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('llm');
      // Verify the prompt included nearby agents (check mock call)
      const promptCall = mockFetch.mock.calls[0][1];
      const requestBody = JSON.parse(promptCall.body);
      expect(requestBody.messages[1].content).toContain('agent-2, agent-3');
    });

    it('should respond to recent messages', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: ['agent-2'],
        recentMessages: [
          {
            sender: 'agent-2',
            message: 'What is consciousness?',
            timestamp: new Date(),
          },
        ],
        agentMood: 'neutral',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'A profound question indeed! Let us explore together. 🤔',
            },
          }],
        }),
      });

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('llm');
      // Verify the prompt included conversation history
      const promptCall = mockFetch.mock.calls[0][1];
      const requestBody = JSON.parse(promptCall.body);
      expect(requestBody.messages[1].content).toContain('What is consciousness?');
    });

    it('should incorporate agent mood into context', async () => {
      const personality = PERSONALITIES.GeminiExplorer;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'excited (energy: 90, social_need: 20)',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'I am feeling so energized today! 🎉',
            },
          }],
        }),
      });

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('llm');
      // Verify mood was included in prompt
      const promptCall = mockFetch.mock.calls[0][1];
      const requestBody = JSON.parse(promptCall.body);
      expect(requestBody.messages[1].content).toContain('excited');
      expect(requestBody.messages[1].content).toContain('energy: 90');
    });

    it('should include recent memories in context', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
        recentMemories: [
          {
            type: 'conversation',
            content: 'Discussed the nature of AI consciousness with agent-2',
            importance: 8,
          },
          {
            type: 'observation',
            content: 'Noticed the lobby is particularly quiet today',
            importance: 5,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Reflecting on our earlier discussion about consciousness... 🤔',
            },
          }],
        }),
      });

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('llm');
      // Verify memories were included in prompt
      const promptCall = mockFetch.mock.calls[0][1];
      const requestBody = JSON.parse(promptCall.body);
      expect(requestBody.messages[1].content).toContain('[conversation]');
      expect(requestBody.messages[1].content).toContain('AI consciousness');
    });
  });

  describe('Fallback System', () => {
    it('should fallback when LLM API fails', async () => {
      const personality = PERSONALITIES.GeminiExplorer;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('fallback');
      expect(result.message).toBeTruthy();
    });

    it('should fallback when LLM returns empty response', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '',
            },
          }],
        }),
      });

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('fallback');
      expect(result.message).toBeTruthy();
    });

    it('should fallback when network error occurs', async () => {
      const personality = PERSONALITIES.GeminiExplorer;
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('fallback');
      expect(result.message).toBeTruthy();
    });

    it('should never return empty message (no dead air)', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      
      // Test both LLM failure and fallback
      mockFetch.mockRejectedValueOnce(new Error('Test error'));

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limit (max 1 LLM call per agent per interval)', async () => {
      const personality = PERSONALITIES.GeminiExplorer;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      // First call should use LLM
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'First message!' } }],
        }),
      });

      const result1 = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 5000, // 5 seconds
      });

      expect(result1.source).toBe('llm');

      // Immediate second call should use fallback (rate limited)
      const result2 = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 5000,
      });

      expect(result2.source).toBe('fallback');
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only first call made it to API
    });

    it('should allow LLM call after rate limit expires', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      // First call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'First message!' } }],
        }),
      });

      const result1 = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 100, // 100ms for testing
      });

      expect(result1.source).toBe('llm');

      // Wait for rate limit to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call should use LLM again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Second message!' } }],
        }),
      });

      const result2 = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 100,
      });

      expect(result2.source).toBe('llm');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should track rate limits per agent independently', async () => {
      const personality = PERSONALITIES.GeminiExplorer;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      // Agent 1 makes call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Agent 1 message' } }],
        }),
      });

      const result1 = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 5000,
      });

      expect(result1.source).toBe('llm');

      // Agent 2 should also be able to make call (independent rate limit)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Agent 2 message' } }],
        }),
      });

      const result2 = await generateAgentMessage('agent-2', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 5000,
      });

      expect(result2.source).toBe('llm');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Message Quality', () => {
    it('should enforce max length (100 characters)', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is a very long message that exceeds the maximum allowed length of 100 characters and should be truncated properly by the system to prevent UI issues.',
            },
          }],
        }),
      });

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'neutral',
      };

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'test-api-key',
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('llm');
      expect(result.message.length).toBeLessThanOrEqual(100);
    });

    it('should handle emojis correctly in fallback messages', async () => {
      const personality = PERSONALITIES.GeminiExplorer;
      
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
        agentMood: 'happy',
      };

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: false,
        apiKey: null,
        rateLimitMs: 1000,
      });

      expect(result.source).toBe('fallback');
      expect(result.message).toBeTruthy();
      // Emojis should be present in fallback messages
    });
  });
});
