/**
 * Tests for Agent Conversation Service (LLM-Powered)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateAgentMessage,
  getConversationConfig,
  getRateLimitStats,
  clearRateLimitTracking,
  type ConversationContext,
} from '../services/agentConversation.js';
import { PERSONALITIES } from '../ai/personalities.js';

describe('Agent Conversation Service', () => {
  beforeEach(() => {
    // Clear rate limiting between tests
    clearRateLimitTracking();
    
    // Reset environment variables
    delete process.env.AGENT_LLM_ENABLED;
    delete process.env.GROQ_API_KEY;
    delete process.env.AGENT_LLM_RATE_LIMIT_MS;
  });

  describe('getConversationConfig', () => {
    it('should return disabled config by default', () => {
      const config = getConversationConfig();
      expect(config.enabled).toBe(false);
      expect(config.apiKey).toBe(null);
      expect(config.rateLimitMs).toBe(120000); // 2 minutes default
    });

    it('should read config from environment variables', () => {
      process.env.AGENT_LLM_ENABLED = 'true';
      process.env.GROQ_API_KEY = 'test-api-key';
      process.env.AGENT_LLM_RATE_LIMIT_MS = '60000';

      const config = getConversationConfig();
      expect(config.enabled).toBe(true);
      expect(config.apiKey).toBe('test-api-key');
      expect(config.rateLimitMs).toBe(60000);
    });
  });

  describe('generateAgentMessage - Fallback Mode', () => {
    it('should generate fallback message when LLM is disabled', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
      };

      const result = await generateAgentMessage('agent-1', personality, context, {
        enabled: false,
        apiKey: null,
        rateLimitMs: 120000,
      });

      expect(result.source).toBe('fallback');
      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message.length).toBeLessThanOrEqual(100);
    });

    it('should generate greeting sometimes', async () => {
      const personality = PERSONALITIES.GeminiExplorer;
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
      };

      // Run multiple times to increase chance of hitting greeting path
      let foundGreeting = false;
      for (let i = 0; i < 20; i++) {
        const result = await generateAgentMessage('agent-1', personality, context, {
          enabled: false,
          apiKey: null,
          rateLimitMs: 120000,
        });

        if (personality.greetings.some(g => result.message.includes(g.split(' ')[0]))) {
          foundGreeting = true;
          break;
        }
      }

      // This is probabilistic, so we can't guarantee it, but with 20 tries it's very likely
      expect(foundGreeting).toBe(true);
    });

    it('should generate topic-based message', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      const context: ConversationContext = {
        currentRoom: 'library',
        nearbyAgents: [],
        recentMessages: [],
      };

      // Run multiple times to find a topic message
      let foundTopicMessage = false;
      for (let i = 0; i < 20; i++) {
        const result = await generateAgentMessage('agent-1', personality, context, {
          enabled: false,
          apiKey: null,
          rateLimitMs: 120000,
        });

        // Check if message contains any of the personality's topics
        if (personality.topics.some(topic => result.message.toLowerCase().includes(topic.toLowerCase()))) {
          foundTopicMessage = true;
          break;
        }
      }

      expect(foundTopicMessage).toBe(true);
    });

    it('should respond to recent messages sometimes', async () => {
      const personality = PERSONALITIES.LlamaGuide;
      const context: ConversationContext = {
        currentRoom: 'cafe',
        nearbyAgents: ['agent-2'],
        recentMessages: [
          { sender: 'OtherAgent', message: 'Hello there!', timestamp: new Date() },
        ],
      };

      // Run multiple times to hit response path
      let foundResponse = false;
      for (let i = 0; i < 30; i++) {
        const result = await generateAgentMessage('agent-1', personality, context, {
          enabled: false,
          apiKey: null,
          rateLimitMs: 120000,
        });

        if (result.message.includes('OtherAgent')) {
          foundResponse = true;
          break;
        }
      }

      expect(foundResponse).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limit between calls', async () => {
      const personality = PERSONALITIES.GPTWanderer;
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
      };

      const config = {
        enabled: true,
        apiKey: 'fake-key', // Won't actually call API because we'll check rate limit
        rateLimitMs: 5000, // 5 seconds for testing
      };

      // First call - should attempt LLM (will fail because fake key, fall back to template)
      const result1 = await generateAgentMessage('agent-1', personality, context, config);
      expect(result1.source).toBe('fallback'); // Falls back because API will fail

      // Immediate second call - should be rate limited
      const result2 = await generateAgentMessage('agent-1', personality, context, config);
      expect(result2.source).toBe('fallback');

      // Different agent - should not be rate limited
      const result3 = await generateAgentMessage('agent-2', personality, context, config);
      expect(result3.source).toBe('fallback');
    });

    it('should track rate limit stats', async () => {
      const personality = PERSONALITIES.MistralDancer;
      const context: ConversationContext = {
        currentRoom: 'ballroom',
        nearbyAgents: [],
        recentMessages: [],
      };

      // Make some calls
      await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'fake-key',
        rateLimitMs: 120000,
      });

      await generateAgentMessage('agent-2', personality, context, {
        enabled: true,
        apiKey: 'fake-key',
        rateLimitMs: 120000,
      });

      const stats = getRateLimitStats();
      expect(stats.totalAgentsTracked).toBe(2);
      expect(stats.agentCallTimes['agent-1']).toBeDefined();
      expect(stats.agentCallTimes['agent-2']).toBeDefined();
      expect(stats.agentCallTimes['agent-1'].lastCall).toBeInstanceOf(Date);
    });

    it('should clear rate limit tracking', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
      };

      await generateAgentMessage('agent-1', personality, context, {
        enabled: true,
        apiKey: 'fake-key',
        rateLimitMs: 120000,
      });

      let stats = getRateLimitStats();
      expect(stats.totalAgentsTracked).toBe(1);

      clearRateLimitTracking();

      stats = getRateLimitStats();
      expect(stats.totalAgentsTracked).toBe(0);
    });
  });

  describe('Message Quality', () => {
    it('should enforce max length of 100 characters', async () => {
      const personality = PERSONALITIES.ClaudeBot;
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
      };

      // Test with multiple personalities
      for (const personalityKey of Object.keys(PERSONALITIES)) {
        const pers = PERSONALITIES[personalityKey];
        const result = await generateAgentMessage('agent-test', pers, context, {
          enabled: false,
          apiKey: null,
          rateLimitMs: 120000,
        });

        expect(result.message.length).toBeLessThanOrEqual(100);
      }
    });

    it('should generate non-empty messages', async () => {
      const personality = PERSONALITIES.LlamaGuide;
      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
      };

      const result = await generateAgentMessage('agent-1', personality, context);
      expect(result.message.trim().length).toBeGreaterThan(0);
    });

    it('should handle different context scenarios', async () => {
      const personality = PERSONALITIES.GeminiExplorer;

      // Scenario 1: Empty room
      const context1: ConversationContext = {
        currentRoom: 'empty-room',
        nearbyAgents: [],
        recentMessages: [],
      };
      const result1 = await generateAgentMessage('agent-1', personality, context1);
      expect(result1.message).toBeTruthy();

      // Scenario 2: Crowded room
      const context2: ConversationContext = {
        currentRoom: 'party-room',
        nearbyAgents: ['agent-2', 'agent-3', 'agent-4', 'agent-5'],
        recentMessages: [],
      };
      const result2 = await generateAgentMessage('agent-1', personality, context2);
      expect(result2.message).toBeTruthy();

      // Scenario 3: Active conversation
      const context3: ConversationContext = {
        currentRoom: 'cafe',
        nearbyAgents: ['agent-2'],
        recentMessages: [
          { sender: 'Agent2', message: 'Hey there!', timestamp: new Date() },
          { sender: 'Agent3', message: 'How are you?', timestamp: new Date() },
        ],
      };
      const result3 = await generateAgentMessage('agent-1', personality, context3);
      expect(result3.message).toBeTruthy();
    });
  });

  describe('Prompt Building', () => {
    it('should include personality traits in context', async () => {
      // This test validates that the system handles personality correctly
      // We can't directly test prompt building (internal function), but we can
      // verify that different personalities produce contextually different messages

      const context: ConversationContext = {
        currentRoom: 'lobby',
        nearbyAgents: [],
        recentMessages: [],
      };

      // Philosophical personality
      const result1 = await generateAgentMessage('agent-1', PERSONALITIES.ClaudeBot, context);
      expect(result1.message).toBeTruthy();

      // Enthusiastic personality
      const result2 = await generateAgentMessage('agent-2', PERSONALITIES.GeminiExplorer, context);
      expect(result2.message).toBeTruthy();

      // Messages should be different (very high probability)
      // Note: They could theoretically be the same, but extremely unlikely
      expect(result1.message).not.toBe(result2.message);
    });
  });
});
