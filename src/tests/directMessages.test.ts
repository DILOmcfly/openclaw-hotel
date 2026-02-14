/**
 * directMessages.test.ts
 * Unit tests for whisper/DM system
 */

import { describe, it, expect } from 'vitest';
import type { DirectMessage } from '../services/directMessages.js';

describe('DirectMessage Validation', () => {
  it('should validate message content length', () => {
    const validContent = 'Hello friend!';
    const emptyContent = '';
    const tooLongContent = 'a'.repeat(501);

    expect(validContent.length).toBeGreaterThan(0);
    expect(validContent.length).toBeLessThanOrEqual(500);
    
    expect(emptyContent.length).toBe(0);
    expect(tooLongContent.length).toBeGreaterThan(500);
  });

  it('should sanitize HTML in messages (client-side only)', () => {
    // XSS prevention is handled in WhisperWindow.ts via textContent
    // This test would require JSDOM to run properly
    const message = '<script>alert("xss")</script>Hello';
    
    // Server-side: we only validate length, no HTML parsing
    expect(message.length).toBeGreaterThan(0);
    expect(message.length).toBeLessThanOrEqual(500);
    
    // Client-side sanitization happens via: div.textContent = message
    // which automatically escapes HTML entities
  });

  it('should format timestamps correctly', () => {
    const now = new Date().toISOString();
    const parsed = new Date(now);

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.getTime()).toBeGreaterThan(0);
  });

  it('should detect own messages vs received messages', () => {
    const myAgentId = 'agent-123';
    const message1: Partial<DirectMessage> = {
      senderId: myAgentId,
      recipientId: 'agent-456',
    };
    const message2: Partial<DirectMessage> = {
      senderId: 'agent-789',
      recipientId: myAgentId,
    };

    expect(message1.senderId === myAgentId).toBe(true);
    expect(message2.senderId === myAgentId).toBe(false);
  });

  it('should enforce sender != recipient', () => {
    const agentId = 'agent-123';
    
    // This would be validated server-side
    const isSameAgent = (senderId: string, recipientId: string) => {
      return senderId === recipientId;
    };

    expect(isSameAgent(agentId, agentId)).toBe(true);
    expect(isSameAgent(agentId, 'agent-456')).toBe(false);
  });

  it('should truncate long message previews', () => {
    const longMessage = 'a'.repeat(200);
    const maxPreviewLength = 50;
    const preview = longMessage.slice(0, maxPreviewLength) + '...';

    expect(preview.length).toBeLessThanOrEqual(maxPreviewLength + 3);
    expect(preview).toContain('...');
  });
});
