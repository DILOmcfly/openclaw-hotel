import { describe, it, expect } from 'vitest';
import { processChatMessage, getRandomWalkPosition } from '../services/bots.js';
import type { Bot } from '../services/bots.js';

describe('Bot Service', () => {
  const createMockBot = (personality: 'greeter' | 'guide' | 'shopkeeper'): Bot => ({
    id: 'bot-123',
    roomId: 'room-456',
    name: 'TestBot',
    personality,
    x: 5,
    y: 5,
    rotation: 0,
    config: {},
    spawnedAt: new Date(),
    lastActionAt: new Date(),
  });

  describe('processChatMessage - Greeter', () => {
    it('should respond to "hello"', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'hello there');
      expect(response).toBe('Welcome to the hotel! 👋');
    });

    it('should respond to "hi"', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'hi everyone');
      expect(response).toBe('Welcome to the hotel! 👋');
    });

    it('should respond to "goodbye"', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'goodbye');
      expect(response).toBe('Goodbye! Come back soon! 👋');
    });

    it('should respond to "help"', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'help');
      expect(response).toContain('greet');
    });

    it('should return null for unmatched message', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'random stuff');
      expect(response).toBeNull();
    });

    it('should be case-insensitive', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'HELLO');
      expect(response).toBe('Welcome to the hotel! 👋');
    });
  });

  describe('processChatMessage - Guide', () => {
    it('should respond to "help"', () => {
      const bot = createMockBot('guide');
      const response = processChatMessage(bot, 'help me');
      expect(response).toContain('navigate');
    });

    it('should respond to "room"', () => {
      const bot = createMockBot('guide');
      const response = processChatMessage(bot, 'where is the room');
      expect(response).toContain('navigator');
    });

    it('should respond to "furniture"', () => {
      const bot = createMockBot('guide');
      const response = processChatMessage(bot, 'tell me about furniture');
      expect(response).toContain('furniture.place');
    });

    it('should respond to "trade"', () => {
      const bot = createMockBot('guide');
      const response = processChatMessage(bot, 'how to trade');
      expect(response).toContain('trade.request');
    });

    it('should respond to "game"', () => {
      const bot = createMockBot('guide');
      const response = processChatMessage(bot, 'start a game');
      expect(response).toContain('game.create');
    });
  });

  describe('processChatMessage - Shopkeeper', () => {
    it('should respond to "buy"', () => {
      const bot = createMockBot('shopkeeper');
      const response = processChatMessage(bot, 'I want to buy');
      expect(response).toContain('shop');
    });

    it('should respond to "sell"', () => {
      const bot = createMockBot('shopkeeper');
      const response = processChatMessage(bot, 'sell items');
      expect(response).toContain('buy');
    });

    it('should respond to "price"', () => {
      const bot = createMockBot('shopkeeper');
      const response = processChatMessage(bot, 'what is the price');
      expect(response).toContain('credits');
    });

    it('should respond to "shop"', () => {
      const bot = createMockBot('shopkeeper');
      const response = processChatMessage(bot, 'shop');
      expect(response).toContain('shop');
    });
  });

  describe('getRandomWalkPosition', () => {
    it('should return position within bounds', () => {
      const { x, y } = getRandomWalkPosition(10, 10, 20, 20);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(20);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(20);
    });

    it('should not move beyond min bounds (0, 0)', () => {
      const { x, y } = getRandomWalkPosition(0, 0, 20, 20);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    });

    it('should not move beyond max bounds', () => {
      const { x, y } = getRandomWalkPosition(20, 20, 20, 20);
      expect(x).toBeLessThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(20);
    });

    it('should clamp position at edges', () => {
      const { x, y } = getRandomWalkPosition(0, 0, 5, 5);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(5);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(5);
    });

    it('should handle movement from center', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        const pos = getRandomWalkPosition(10, 10, 20, 20);
        results.push(pos);
      }
      
      // Check that we get some variation (not all the same)
      const uniqueX = new Set(results.map(p => p.x)).size;
      const uniqueY = new Set(results.map(p => p.y)).size;
      expect(uniqueX).toBeGreaterThan(1);
      expect(uniqueY).toBeGreaterThan(1);
    });
  });

  describe('Bot personality types', () => {
    it('should have valid personality: greeter', () => {
      const bot = createMockBot('greeter');
      expect(bot.personality).toBe('greeter');
    });

    it('should have valid personality: guide', () => {
      const bot = createMockBot('guide');
      expect(bot.personality).toBe('guide');
    });

    it('should have valid personality: shopkeeper', () => {
      const bot = createMockBot('shopkeeper');
      expect(bot.personality).toBe('shopkeeper');
    });
  });

  describe('Response trigger matching', () => {
    it('should match trigger at start of message', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'hello world');
      expect(response).not.toBeNull();
    });

    it('should match trigger in middle of message', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'say hello to everyone');
      expect(response).not.toBeNull();
    });

    it('should match trigger at end of message', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, 'I want to say hello');
      expect(response).not.toBeNull();
    });

    it('should handle whitespace correctly', () => {
      const bot = createMockBot('greeter');
      const response = processChatMessage(bot, '  hello  ');
      expect(response).not.toBeNull();
    });
  });
});
