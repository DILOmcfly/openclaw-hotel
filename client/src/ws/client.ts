/**
 * WebSocket client for OpenClaw Hotel
 * Handles auth, room join, and real-time message routing
 */

export type ServerMessage = {
  type: string;
  [key: string]: unknown;
};

export type MessageHandler = (msg: ServerMessage) => void;

export class HotelWSClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url: string = `ws://${window.location.hostname}:3000`) {
    this.url = url;
  }

  async register(agentId: string, publicKey: string): Promise<{ token: string }> {
    const res = await fetch(`${this.url.replace('ws', 'http')}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, publicKey }),
    });
    return res.json();
  }

  connect(token: string): void {
    this.token = token;
    this.ws = new WebSocket(`${this.url}?token=${token}`);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.emit('connected', { type: 'connected' });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        this.emit(msg.type, msg);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.emit('disconnected', { type: 'disconnected' });
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }

  send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  joinRoom(roomId: string): void {
    this.send({ type: 'room.join', roomId });
  }

  leaveRoom(roomId: string): void {
    this.send({ type: 'room.leave', roomId });
  }

  move(roomId: string, x: number, y: number): void {
    this.send({ type: 'agent.move', roomId, x, y });
  }

  chat(roomId: string, content: string, signature: string = 'placeholder'): void {
    this.send({ type: 'chat.send', roomId, content, signature });
  }

  emote(roomId: string, emote: string): void {
    this.send({ type: 'emote', roomId, emote });
  }

  on(type: string, handler: MessageHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  off(type: string, handler: MessageHandler): void {
    const list = this.handlers.get(type) ?? [];
    this.handlers.set(type, list.filter((h) => h !== handler));
  }

  private emit(type: string, msg: ServerMessage): void {
    const list = this.handlers.get(type) ?? [];
    for (const h of list) h(msg);
    // Also emit to wildcard listeners
    const wild = this.handlers.get('*') ?? [];
    for (const h of wild) h(msg);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) this.connect(this.token);
    }, 3000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
