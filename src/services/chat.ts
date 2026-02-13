import { randomUUID } from 'node:crypto';
import type pino from 'pino';
import type { ChatMessage } from '../types/domain.js';
import { hexToBytes, sha256, verify } from '../utils/crypto.js';
import { AuthService } from './auth.js';
import { ModerationService } from './moderation.js';
import { PresenceService } from './presence.js';
import { SlidingWindowRateLimiter } from '../utils/rate-limit.js';
import { config } from '../config.js';

export type BroadcastFn = (roomId: string, message: ChatMessage) => void;

interface SendMessageInput {
  agentId: string;
  roomId: string;
  content: string;
  timestamp: string;
  signature: string;
}

export class ChatService {
  private readonly messages: ChatMessage[] = [];
  private broadcastFn: BroadcastFn = () => {};

  constructor(
    private readonly authService: AuthService,
    private readonly presenceService: PresenceService,
    private readonly moderationService: ModerationService,
    private readonly limiter: SlidingWindowRateLimiter,
    private readonly logger: pino.Logger,
  ) {}

  setBroadcaster(fn: BroadcastFn): void {
    this.broadcastFn = fn;
  }

  sendMessage(input: SendMessageInput): ChatMessage {
    const agent = this.authService.getAgentById(input.agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (this.moderationService.isBanned(input.agentId, input.roomId)) {
      throw new Error('Agent is banned');
    }

    if (this.moderationService.isMuted(input.agentId, input.roomId)) {
      throw new Error('Agent is muted');
    }

    const isInRoom = this.presenceService.getAgentRooms(input.agentId).includes(input.roomId);
    if (!isInRoom) {
      throw new Error('Agent is not in room');
    }

    const limit = this.limiter.check(`message:${input.agentId}`, {
      limit: config.rateLimits.messagesPer10s,
      windowMs: 10_000,
    });

    if (!limit.allowed) {
      this.moderationService.muteAgent(input.agentId, input.roomId, 30, 'Rate limit exceeded');
      throw new Error('Rate limited');
    }

    const filterResult = this.moderationService.filterContent(input.content);
    if (!filterResult.allowed) {
      throw new Error(`Message blocked: ${filterResult.blockedTerm ?? 'blocked content'}`);
    }

    const digestInput = `${input.roomId}${input.content}${input.timestamp}`;
    const digest = sha256(digestInput);

    const validSignature = verify(digest, hexToBytes(input.signature), hexToBytes(agent.publicKey));
    if (!validSignature) {
      throw new Error('Invalid message signature');
    }

    const message: ChatMessage = {
      id: randomUUID(),
      roomId: input.roomId,
      agentId: input.agentId,
      displayName: agent.displayName,
      content: input.content,
      signature: input.signature,
      timestamp: input.timestamp,
      moderated: false,
      moderationReason: null,
    };

    this.messages.push(message);
    this.broadcastFn(input.roomId, message);

    this.logger.debug({ roomId: input.roomId, agentId: input.agentId, messageId: message.id }, 'Chat message accepted');

    return message;
  }

  getMessagesForRoom(roomId: string): ChatMessage[] {
    return this.messages.filter((message) => message.roomId === roomId);
  }
}
