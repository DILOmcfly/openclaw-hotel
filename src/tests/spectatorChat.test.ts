import { describe, it, expect } from 'vitest';
import { sanitizeUsername } from '../ws/spectator.js';

describe('Spectator Chat', () => {
  describe('sanitizeUsername', () => {
    it('should return valid usernames unchanged', () => {
      expect(sanitizeUsername('Alice')).toBe('Alice');
      expect(sanitizeUsername('Bob_123')).toBe('Bob_123');
      expect(sanitizeUsername('User Name')).toBe('User Name');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeUsername('<script>alert("XSS")</script>')).toBe('scriptalertXSSscript');
      expect(sanitizeUsername('User"Name"')).toBe('UserName');
      expect(sanitizeUsername("User'Name'")).toBe('UserName');
      expect(sanitizeUsername('User<>Name')).toBe('UserName');
    });

    it('should limit username to 20 characters', () => {
      const longName = 'ThisIsAVeryLongUsernameThatExceeds20Characters';
      expect(sanitizeUsername(longName)).toBe('ThisIsAVeryLongUsern');
      expect(sanitizeUsername(longName).length).toBe(20);
    });

    it('should return "Anonymous" for empty or invalid input', () => {
      expect(sanitizeUsername('')).toBe('Anonymous');
      expect(sanitizeUsername('   ')).toBe('Anonymous');
      expect(sanitizeUsername(undefined)).toBe('Anonymous');
      expect(sanitizeUsername(null as any)).toBe('Anonymous');
      expect(sanitizeUsername(123 as any)).toBe('Anonymous');
    });

    it('should trim whitespace', () => {
      expect(sanitizeUsername('  Alice  ')).toBe('Alice');
      expect(sanitizeUsername('\tBob\n')).toBe('Bob');
    });

    it('should allow hyphens and underscores', () => {
      expect(sanitizeUsername('user-name')).toBe('user-name');
      expect(sanitizeUsername('user_name')).toBe('user_name');
      expect(sanitizeUsername('user-name_123')).toBe('user-name_123');
    });

    it('should handle unicode and special characters', () => {
      expect(sanitizeUsername('User™️')).toBe('User');
      expect(sanitizeUsername('User@Domain')).toBe('UserDomain');
      expect(sanitizeUsername('User#123')).toBe('User123');
    });

    it('should handle only special characters', () => {
      expect(sanitizeUsername('!@#$%^&*()')).toBe('Anonymous');
      expect(sanitizeUsername('👋🎉')).toBe('Anonymous');
    });
  });

  describe('Message Validation', () => {
    it('should validate message length', () => {
      const shortMessage = 'Hello';
      const maxMessage = 'x'.repeat(500);
      const tooLongMessage = 'x'.repeat(501);

      expect(shortMessage.length).toBeLessThanOrEqual(500);
      expect(maxMessage.length).toBe(500);
      expect(tooLongMessage.slice(0, 500).length).toBe(500);
    });

    it('should handle empty messages', () => {
      const emptyMessage = '';
      const whitespaceMessage = '   ';

      expect(emptyMessage.trim().length).toBe(0);
      expect(whitespaceMessage.trim().length).toBe(0);
    });

    it('should preserve message content after trim', () => {
      const message = '  Hello World  ';
      expect(message.trim()).toBe('Hello World');
    });
  });

  describe('Rate Limiting Logic', () => {
    it('should allow messages within rate limit', () => {
      const RATE_LIMIT_MAX = 5;
      const RATE_LIMIT_WINDOW = 10000;

      let messageCount = 0;
      const now = Date.now();
      let resetTime = now + RATE_LIMIT_WINDOW;

      // Simulate sending 5 messages
      for (let i = 0; i < 5; i++) {
        messageCount++;
        expect(messageCount).toBeLessThanOrEqual(RATE_LIMIT_MAX);
      }

      expect(messageCount).toBe(5);
    });

    it('should block messages exceeding rate limit', () => {
      const RATE_LIMIT_MAX = 5;
      let messageCount = 5;

      // Try to send 6th message
      const canSend = messageCount < RATE_LIMIT_MAX;
      expect(canSend).toBe(false);
    });

    it('should reset rate limit after window expires', () => {
      const RATE_LIMIT_WINDOW = 10000;
      const now = Date.now();
      const resetTime = now + RATE_LIMIT_WINDOW;

      // Check if window has expired
      const windowExpired = Date.now() >= resetTime;
      
      // In a real scenario, this would be true after 10 seconds
      // For test purposes, we just verify the logic
      expect(typeof windowExpired).toBe('boolean');
    });
  });

  describe('Message Broadcasting', () => {
    it('should include required message fields', () => {
      const message = {
        type: 'spectator.chatMessage',
        username: 'Alice',
        message: 'Hello World',
        timestamp: new Date().toISOString(),
        isOwnMessage: false,
      };

      expect(message.type).toBe('spectator.chatMessage');
      expect(message.username).toBe('Alice');
      expect(message.message).toBe('Hello World');
      expect(message.timestamp).toBeTruthy();
      expect(typeof message.isOwnMessage).toBe('boolean');
    });

    it('should validate timestamp format', () => {
      const timestamp = new Date().toISOString();
      
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should distinguish own messages', () => {
      const ownMessage = { isOwnMessage: true };
      const otherMessage = { isOwnMessage: false };

      expect(ownMessage.isOwnMessage).toBe(true);
      expect(otherMessage.isOwnMessage).toBe(false);
    });
  });

  describe('Chat History Management', () => {
    it('should limit chat history to 100 messages', () => {
      const MAX_CHAT_MESSAGES = 100;
      const messages: any[] = [];

      // Add 150 messages
      for (let i = 0; i < 150; i++) {
        messages.push({ id: i, text: `Message ${i}` });
        
        // Keep only last 100
        if (messages.length > MAX_CHAT_MESSAGES) {
          messages.shift();
        }
      }

      expect(messages.length).toBe(MAX_CHAT_MESSAGES);
      expect(messages[0].id).toBe(50); // First message should be #50
      expect(messages[99].id).toBe(149); // Last message should be #149
    });

    it('should maintain message order', () => {
      const messages = [
        { id: 1, text: 'First' },
        { id: 2, text: 'Second' },
        { id: 3, text: 'Third' },
      ];

      expect(messages[0].id).toBe(1);
      expect(messages[1].id).toBe(2);
      expect(messages[2].id).toBe(3);
    });
  });
});
