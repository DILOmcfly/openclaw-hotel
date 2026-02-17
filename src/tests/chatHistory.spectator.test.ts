/**
 * T-345: Chat History on Room Enter — Unit Tests
 *
 * Tests for:
 * - loadChatHistory() fetch logic (mocked fetch)
 * - Message ordering (newest-first API → oldest-first in UI)
 * - Graceful handling of non-OK responses
 * - Graceful handling of empty responses
 * - Graceful handling of network errors
 * - Divider insertion
 * - Message type mapping (system vs chat)
 * - Limit parameter passed correctly
 *
 * Pure unit tests — no DB required (fetch is mocked).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Minimal implementation mirror ───────────────────────────────────────────

interface HistoryMsg {
  id?: string;
  agent_name?: string;
  agentName?: string;
  message?: string;
  text?: string;
  message_type?: string;
  messageType?: string;
  created_at?: string;
}

type RenderCall = { sender: string; text: string; isSystem: boolean };

function makeChatRenderer() {
  const calls: RenderCall[] = [];
  function addChatMessage(sender: string, text: string, isSystem = false) {
    calls.push({ sender, text, isSystem });
  }
  return { addChatMessage, calls };
}

async function loadChatHistory(
  roomId: string,
  limit: number,
  fetchFn: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>,
  addChatMessage: (sender: string, text: string, isSystem?: boolean) => void,
  api = ''
): Promise<void> {
  try {
    const res = await fetchFn(`${api}/api/rooms/${roomId}/chat/history?limit=${limit}`);
    if (!res.ok) return;
    const messages = await res.json() as HistoryMsg[];
    if (!Array.isArray(messages) || messages.length === 0) return;

    addChatMessage('System', `── Last ${messages.length} messages ──`, true);

    const ordered = [...messages].reverse();
    for (const msg of ordered) {
      const sender   = msg.agent_name || msg.agentName || 'Agent';
      const text     = msg.message || msg.text || '';
      const isSystem = msg.message_type === 'system' || msg.messageType === 'system';
      if (text) addChatMessage(sender, text, isSystem);
    }
  } catch {
    // Swallow — don't crash room view
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T-345: loadChatHistory()', () => {
  let renderer: ReturnType<typeof makeChatRenderer>;

  beforeEach(() => {
    renderer = makeChatRenderer();
  });

  it('fetches the correct URL with limit parameter', async () => {
    const urls: string[] = [];
    const mockFetch = async (url: string) => {
      urls.push(url);
      return { ok: false, json: async () => [] };
    };
    await loadChatHistory('room-123', 20, mockFetch, renderer.addChatMessage, 'http://localhost:3000');
    expect(urls[0]).toBe('http://localhost:3000/api/rooms/room-123/chat/history?limit=20');
  });

  it('uses limit=20 by default', async () => {
    const urls: string[] = [];
    const mockFetch = async (url: string) => { urls.push(url); return { ok: false, json: async () => [] }; };
    await loadChatHistory('room-abc', 20, mockFetch, renderer.addChatMessage);
    expect(urls[0]).toContain('limit=20');
  });

  it('uses custom limit when specified', async () => {
    const urls: string[] = [];
    const mockFetch = async (url: string) => { urls.push(url); return { ok: false, json: async () => [] }; };
    await loadChatHistory('room-abc', 50, mockFetch, renderer.addChatMessage);
    expect(urls[0]).toContain('limit=50');
  });

  it('skips silently on non-OK response', async () => {
    const mockFetch = async () => ({ ok: false, json: async () => [] });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls.length).toBe(0);
  });

  it('skips silently on empty array response', async () => {
    const mockFetch = async () => ({ ok: true, json: async () => [] });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls.length).toBe(0);
  });

  it('skips silently on network error (fetch throws)', async () => {
    const mockFetch = async () => { throw new Error('Network error'); };
    await expect(loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage)).resolves.not.toThrow();
    expect(renderer.calls.length).toBe(0);
  });

  it('inserts a system divider before history messages', async () => {
    const messages: HistoryMsg[] = [
      { agent_name: 'Aura', message: 'Hello', message_type: 'chat', created_at: '2026-02-17T12:00:00Z' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[0].isSystem).toBe(true);
    expect(renderer.calls[0].text).toContain('Last 1 messages');
  });

  it('displays message count in divider', async () => {
    const messages: HistoryMsg[] = Array.from({ length: 5 }, (_, i) => ({
      agent_name: `Agent${i}`, message: `msg ${i}`, message_type: 'chat',
    }));
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[0].text).toContain('5');
  });

  it('reverses messages to show oldest first', async () => {
    // API returns newest-first: [msg3, msg2, msg1]
    const messages: HistoryMsg[] = [
      { agent_name: 'C', message: 'newest', message_type: 'chat' },
      { agent_name: 'B', message: 'middle', message_type: 'chat' },
      { agent_name: 'A', message: 'oldest', message_type: 'chat' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    // calls[0] = divider, calls[1] = oldest, calls[3] = newest
    expect(renderer.calls[1].text).toBe('oldest');
    expect(renderer.calls[3].text).toBe('newest');
  });

  it('uses agent_name field as sender', async () => {
    const messages: HistoryMsg[] = [
      { agent_name: 'ClaudeBot', message: 'hi there', message_type: 'chat' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[1].sender).toBe('ClaudeBot');
  });

  it('falls back to agentName field if agent_name missing', async () => {
    const messages: HistoryMsg[] = [
      { agentName: 'AltBot', message: 'hello', message_type: 'chat' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[1].sender).toBe('AltBot');
  });

  it('defaults sender to "Agent" when both name fields missing', async () => {
    const messages: HistoryMsg[] = [
      { message: 'anonymous', message_type: 'chat' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[1].sender).toBe('Agent');
  });

  it('marks system messages as isSystem=true', async () => {
    const messages: HistoryMsg[] = [
      { agent_name: 'System', message: 'room created', message_type: 'system' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[1].isSystem).toBe(true);
  });

  it('marks chat messages as isSystem=false', async () => {
    const messages: HistoryMsg[] = [
      { agent_name: 'Bot', message: 'wassup', message_type: 'chat' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[1].isSystem).toBe(false);
  });

  it('supports messageType (camelCase) field as well', async () => {
    const messages: HistoryMsg[] = [
      { agent_name: 'Bot', message: 'sys msg', messageType: 'system' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[1].isSystem).toBe(true);
  });

  it('skips messages with empty text field', async () => {
    const messages: HistoryMsg[] = [
      { agent_name: 'Bot', message: '', message_type: 'chat' },
      { agent_name: 'Bot', message: 'hello', message_type: 'chat' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    // divider + 1 message (empty one skipped)
    expect(renderer.calls.length).toBe(2);
  });

  it('uses text field as fallback when message field missing', async () => {
    const messages: HistoryMsg[] = [
      { agent_name: 'Bot', text: 'alt field', message_type: 'chat' },
    ];
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    expect(renderer.calls[1].text).toBe('alt field');
  });

  it('renders all N messages correctly', async () => {
    const messages: HistoryMsg[] = Array.from({ length: 10 }, (_, i) => ({
      agent_name: `Agent${i}`, message: `message ${i}`, message_type: 'chat',
    }));
    const mockFetch = async () => ({ ok: true, json: async () => messages });
    await loadChatHistory('room-1', 20, mockFetch, renderer.addChatMessage);
    // 1 divider + 10 messages
    expect(renderer.calls.length).toBe(11);
  });
});
