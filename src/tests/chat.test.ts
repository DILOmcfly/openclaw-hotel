import { beforeEach, describe, expect, it } from 'vitest';
import { sendMessage } from '../services/chat.js';
import { resetRateLimits } from '../utils/rate-limit.js';

describe('chat service', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('sendMessage returns messageId and timestamp', () => {
    const result = sendMessage('agent-1', 'public-key', 'room-1', 'hello world', 'signature');

    expect(result.messageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('sendMessage throws RATE_LIMITED over rate limit', () => {
    for (let i = 0; i < 10; i += 1) {
      sendMessage('agent-1', 'public-key', 'room-1', `hello ${i}`, 'signature');
    }

    expect(() =>
      sendMessage('agent-1', 'public-key', 'room-1', 'this should fail', 'signature')
    ).toThrow(/RATE_LIMITED/);
  });

  it('sendMessage throws when content exceeds 2000 characters', () => {
    const oversized = 'a'.repeat(2001);

    expect(() => sendMessage('agent-1', 'public-key', 'room-1', oversized, 'signature')).toThrow(
      /2000/
    );
  });

  it('sendMessage throws when signature is empty', () => {
    expect(() => sendMessage('agent-1', 'public-key', 'room-1', 'hello', '')).toThrow(
      /signature/i
    );
  });
});
