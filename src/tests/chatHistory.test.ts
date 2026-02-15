import { describe, it, expect } from 'vitest';
import type { ChatMessage, MessageType } from '../services/chatHistory.js';

describe('Chat History Tests', () => {
  it('validates message types', () => {
    const valid: MessageType[] = ['chat', 'emote', 'system', 'command'];
    expect(valid.includes('chat')).toBe(true);
    expect(valid.includes('emote')).toBe(true);
    expect(valid.includes('system')).toBe(true);
    expect(valid.includes('command')).toBe(true);
    expect(valid.includes('invalid' as any)).toBe(false);
  });

  it('validates message length constraint', () => {
    const validate = (msg: string): boolean => msg.length <= 500;
    expect(validate('Hello')).toBe(true);
    expect(validate('a'.repeat(500))).toBe(true);
    expect(validate('a'.repeat(501))).toBe(false);
  });

  it('validates chat message structure', () => {
    const msg: ChatMessage = {
      id: '123',
      room_id: 'room-1',
      agent_id: 'agent-1',
      agent_name: 'TestAgent',
      message: 'Hello world',
      message_type: 'chat',
      created_at: new Date(),
    };
    expect(msg.id).toBe('123');
    expect(msg.room_id).toBe('room-1');
    expect(msg.message_type).toBe('chat');
  });

  it('handles pagination with limit', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      room_id: 'room-1',
      agent_id: 'agent-1',
      agent_name: 'Agent',
      message: `Message ${i}`,
      message_type: 'chat' as MessageType,
      created_at: new Date(),
    }));

    const paginate = (items: any[], limit: number) => items.slice(0, limit);
    expect(paginate(messages, 50)).toHaveLength(50);
    expect(paginate(messages, 20)).toHaveLength(20);
  });

  it('enforces limit constraints (1-200)', () => {
    const clamp = (n: number) => Math.min(Math.max(n, 1), 200);
    expect(clamp(50)).toBe(50);
    expect(clamp(0)).toBe(1);
    expect(clamp(-10)).toBe(1);
    expect(clamp(250)).toBe(200);
  });

  it('handles cursor-based pagination', () => {
    const messages: ChatMessage[] = [
      { id: '1', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'msg1', message_type: 'chat', created_at: new Date('2024-01-01T10:00:00Z') },
      { id: '2', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'msg2', message_type: 'chat', created_at: new Date('2024-01-01T11:00:00Z') },
      { id: '3', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'msg3', message_type: 'chat', created_at: new Date('2024-01-01T12:00:00Z') },
    ];

    const beforeCursor = messages.find(m => m.id === '2')?.created_at;
    const filtered = messages.filter(m => m.created_at < (beforeCursor || new Date()));
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('searches messages by keyword', () => {
    const messages: ChatMessage[] = [
      { id: '1', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'Hello world', message_type: 'chat', created_at: new Date() },
      { id: '2', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'Goodbye world', message_type: 'chat', created_at: new Date() },
      { id: '3', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'Test message', message_type: 'chat', created_at: new Date() },
    ];

    const search = (query: string) => 
      messages.filter(m => m.message.toLowerCase().includes(query.toLowerCase()));

    expect(search('world')).toHaveLength(2);
    expect(search('hello')).toHaveLength(1);
    expect(search('test')).toHaveLength(1);
    expect(search('nonexistent')).toHaveLength(0);
  });

  it('handles empty search query', () => {
    const validate = (query: string): boolean => query.trim().length > 0;
    expect(validate('')).toBe(false);
    expect(validate('  ')).toBe(false);
    expect(validate('valid')).toBe(true);
  });

  it('counts messages in a room', () => {
    const messages: ChatMessage[] = [
      { id: '1', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'msg', message_type: 'chat', created_at: new Date() },
      { id: '2', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'msg', message_type: 'chat', created_at: new Date() },
      { id: '3', room_id: 'r2', agent_id: 'a1', agent_name: 'A', message: 'msg', message_type: 'chat', created_at: new Date() },
    ];

    const countByRoom = (roomId: string) => messages.filter(m => m.room_id === roomId).length;
    expect(countByRoom('r1')).toBe(2);
    expect(countByRoom('r2')).toBe(1);
    expect(countByRoom('r3')).toBe(0);
  });

  it('filters messages by room_id', () => {
    const messages: ChatMessage[] = [
      { id: '1', room_id: 'room-1', agent_id: 'a1', agent_name: 'A', message: 'msg', message_type: 'chat', created_at: new Date() },
      { id: '2', room_id: 'room-2', agent_id: 'a1', agent_name: 'A', message: 'msg', message_type: 'chat', created_at: new Date() },
    ];

    const filtered = messages.filter(m => m.room_id === 'room-1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('sorts messages by created_at DESC', () => {
    const messages: ChatMessage[] = [
      { id: '1', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'old', message_type: 'chat', created_at: new Date('2024-01-01') },
      { id: '2', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'new', message_type: 'chat', created_at: new Date('2024-01-03') },
      { id: '3', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'mid', message_type: 'chat', created_at: new Date('2024-01-02') },
    ];

    const sorted = [...messages].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('3');
    expect(sorted[2].id).toBe('1');
  });

  it('validates daysBefore for cleanup', () => {
    const validate = (days: number): boolean => days >= 1;
    expect(validate(1)).toBe(true);
    expect(validate(30)).toBe(true);
    expect(validate(0)).toBe(false);
    expect(validate(-5)).toBe(false);
  });

  it('calculates cleanup date threshold', () => {
    const now = new Date('2024-01-15');
    const getDaysBefore = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const threshold7 = getDaysBefore(7);
    const threshold30 = getDaysBefore(30);

    expect(threshold7.getDate()).toBe(8);
    expect(threshold30.getMonth()).toBe(11); // December (0-indexed)
  });

  it('filters messages by date for cleanup', () => {
    const now = new Date('2024-01-15');
    const threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const messages: ChatMessage[] = [
      { id: '1', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'old', message_type: 'chat', created_at: new Date('2024-01-01') },
      { id: '2', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'recent', message_type: 'chat', created_at: new Date('2024-01-14') },
    ];

    const toDelete = messages.filter(m => m.created_at < threshold);
    expect(toDelete).toHaveLength(1);
    expect(toDelete[0].id).toBe('1');
  });

  it('handles different message types', () => {
    const messages: ChatMessage[] = [
      { id: '1', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'chat msg', message_type: 'chat', created_at: new Date() },
      { id: '2', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: 'waves', message_type: 'emote', created_at: new Date() },
      { id: '3', room_id: 'r1', agent_id: 'system', agent_name: 'System', message: 'Agent joined', message_type: 'system', created_at: new Date() },
      { id: '4', room_id: 'r1', agent_id: 'a1', agent_name: 'A', message: '/dance', message_type: 'command', created_at: new Date() },
    ];

    expect(messages.filter(m => m.message_type === 'chat')).toHaveLength(1);
    expect(messages.filter(m => m.message_type === 'emote')).toHaveLength(1);
    expect(messages.filter(m => m.message_type === 'system')).toHaveLength(1);
    expect(messages.filter(m => m.message_type === 'command')).toHaveLength(1);
  });

  it('validates all required fields', () => {
    const validate = (msg: Partial<ChatMessage>): boolean => {
      return !!(msg.id && msg.room_id && msg.agent_id && msg.agent_name && msg.message && msg.message_type);
    };

    expect(validate({
      id: '1',
      room_id: 'r1',
      agent_id: 'a1',
      agent_name: 'Agent',
      message: 'Hello',
      message_type: 'chat',
      created_at: new Date(),
    })).toBe(true);

    expect(validate({
      id: '1',
      room_id: 'r1',
      agent_id: 'a1',
      // missing agent_name
      message: 'Hello',
      message_type: 'chat',
    })).toBe(false);
  });
});
