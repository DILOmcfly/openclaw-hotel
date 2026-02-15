import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HotelClient } from './client.js';

// Mock dependencies
vi.mock('ws', () => {
  return {
    default: class MockWebSocket {
      static instances: any[] = [];
      url: string;
      onopen: any;
      onmessage: any;
      onerror: any;
      onclose: any;
      listeners: Map<string, Set<Function>> = new Map();

      constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
      }

      on(event: string, handler: Function) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
      }

      emit(event: string, ...args: any[]) {
        const handlers = this.listeners.get(event);
        if (handlers) {
          handlers.forEach((h) => h(...args));
        }
      }

      send(data: string) {
        // Mock send
      }

      close() {
        this.emit('close');
      }
    },
  };
});

global.fetch = vi.fn();

describe('HotelClient', () => {
  let client: HotelClient;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        token: 'jwt-token-123',
        agentId: 'agent-123',
        displayName: 'TestAgent',
        platform: 'claude',
        verified: false,
        expiresIn: 3600,
      }),
    });

    client = new HotelClient('ocl_test123', {
      serverUrl: 'http://localhost:3000',
      autoReconnect: false,
      debug: false,
    });
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket open event
      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      const status = client.getStatus();
      expect(status.state).toBe('connected');
      expect(status.agentId).toBe('agent-123');
    });

    it('should emit connected event on successful connection', async () => {
      const handler = vi.fn();
      client.on('connected', handler);

      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      expect(handler).toHaveBeenCalledWith({ agentId: 'agent-123' });
    });

    it('should handle connection errors', async () => {
      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      setTimeout(() => ws.emit('error', new Error('Connection failed')), 10);

      await expect(connectPromise).rejects.toThrow('Connection failed');
    });
  });

  describe('event handling', () => {
    it('should handle incoming messages', async () => {
      const chatHandler = vi.fn();
      client.on('chat', chatHandler);

      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      // Simulate incoming message
      const message = { type: 'chat', sender: 'OtherAgent', message: 'Hello!' };
      ws.emit('message', JSON.stringify(message));

      expect(chatHandler).toHaveBeenCalledWith(message);
    });

    it('should support wildcard event handler', async () => {
      const wildcardHandler = vi.fn();
      client.on('*', wildcardHandler);

      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      const message1 = { type: 'chat', message: 'Test' };
      const message2 = { type: 'move', x: 5, y: 5 };

      ws.emit('message', JSON.stringify(message1));
      ws.emit('message', JSON.stringify(message2));

      expect(wildcardHandler).toHaveBeenCalledTimes(2);
      expect(wildcardHandler).toHaveBeenNthCalledWith(1, message1);
      expect(wildcardHandler).toHaveBeenNthCalledWith(2, message2);
    });

    it('should support once handlers', async () => {
      const handler = vi.fn();
      client.once('chat', handler);

      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      const message = { type: 'chat', message: 'Test' };
      ws.emit('message', JSON.stringify(message));
      ws.emit('message', JSON.stringify(message));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('actions', () => {
    it('should send chat messages', async () => {
      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      const sendSpy = vi.spyOn(ws, 'send');
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      client.chat('Hello, world!');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: 'chat', message: 'Hello, world!' })
      );
    });

    it('should send move commands', async () => {
      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      const sendSpy = vi.spyOn(ws, 'send');
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      client.move(5, 10);

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: 'move', x: 5, y: 10 })
      );
    });

    it('should throw error when sending while disconnected', () => {
      expect(() => client.chat('Test')).toThrow('Not connected to server');
    });
  });

  describe('disconnect', () => {
    it('should disconnect cleanly', async () => {
      const connectPromise = client.connect();

      const MockWS = (await import('ws')).default as any;
      const ws = MockWS.instances[MockWS.instances.length - 1];
      setTimeout(() => ws.emit('open'), 10);

      await connectPromise;

      client.disconnect();

      expect(client.getStatus().state).toBe('disconnected');
    });
  });
});
