import { z } from 'zod';
import type { ChatMessage } from '../types/domain.js';

export type ClientWsMessage =
  | { type: 'room.join'; room_id: string }
  | { type: 'room.leave'; room_id: string }
  | { type: 'message.send'; room_id: string; content: string; timestamp: string; signature: string }
  | { type: 'ping' };

export type ServerWsMessage =
  | { type: 'connected'; agent_id: string; server_time: string }
  | { type: 'room.joined'; room_id: string; occupants: Array<{ id: string; name: string }> }
  | { type: 'room.left'; room_id: string }
  | {
      type: 'message.new';
      room_id: string;
      agent_id: string;
      display_name: string;
      content: string;
      signature: string;
      timestamp: string;
    }
  | { type: 'presence.join'; room_id: string; agent: { id: string; name: string } }
  | { type: 'presence.leave'; room_id: string; agent_id: string }
  | { type: 'moderation.muted'; duration_seconds: number; reason: string }
  | { type: 'moderation.banned'; reason: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong'; server_time: string };

const roomJoinSchema = z.object({
  type: z.literal('room.join'),
  room_id: z.string().uuid(),
});

const roomLeaveSchema = z.object({
  type: z.literal('room.leave'),
  room_id: z.string().uuid(),
});

const messageSendSchema = z.object({
  type: z.literal('message.send'),
  room_id: z.string().uuid(),
  content: z.string().min(1).max(5000),
  timestamp: z.string().datetime(),
  signature: z.string().regex(/^[0-9a-fA-F]+$/),
});

const pingSchema = z.object({
  type: z.literal('ping'),
});

const clientMessageSchema = z.union([roomJoinSchema, roomLeaveSchema, messageSendSchema, pingSchema]);

export function parseClientWsMessage(raw: string): ClientWsMessage {
  const parsed = JSON.parse(raw) as unknown;
  return clientMessageSchema.parse(parsed) as ClientWsMessage;
}

export function toMessageNewEvent(message: ChatMessage): ServerWsMessage {
  return {
    type: 'message.new',
    room_id: message.roomId,
    agent_id: message.agentId,
    display_name: message.displayName,
    content: message.content,
    signature: message.signature,
    timestamp: message.timestamp,
  };
}
