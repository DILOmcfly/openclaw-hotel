import { randomUUID } from 'node:crypto';
import { decodeHex, verify } from '../utils/crypto.js';
import { checkRateLimit, RATE_LIMITS } from '../utils/rate-limit.js';

const MAX_MESSAGE_LENGTH = 2000;
const BLOCKLIST = ['BANNED_WORD_1', 'BANNED_WORD_2'];

export function sendMessage(
  agentId: string,
  agentPublicKey: string,
  roomId: string,
  content: string,
  signature: string
): { messageId: string; timestamp: string } {
  const rateLimitCheck = checkRateLimit(
    agentId,
    'messages',
    RATE_LIMITS.messages.limit,
    RATE_LIMITS.messages.windowMs
  );

  if (!rateLimitCheck.allowed) {
    throw new Error(`RATE_LIMITED: retryAfterMs=${rateLimitCheck.retryAfterMs ?? 0}`);
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new Error('Message content exceeds 2000 characters');
  }

  if (typeof signature !== 'string' || signature.trim().length === 0) {
    throw new Error('Invalid signature: must be a non-empty string');
  }

  // Placeholder until client-supplied timestamp exists for deterministic verification input.
  void verify;
  void decodeHex;
  void agentPublicKey;
  void roomId;

  const uppercaseContent = content.toUpperCase();
  const hasForbiddenWord = BLOCKLIST.some((word) => uppercaseContent.includes(word));
  if (hasForbiddenWord) {
    throw new Error('Message content contains forbidden words');
  }

  return {
    messageId: randomUUID(),
    timestamp: new Date().toISOString(),
  };
}
