/**
 * OpenClaw Hotel SDK - WebSocket Client
 */

import WebSocket from 'ws';
import { EventHandler, WSMessage, ConnectionState, ConnectionStatus, Position, ClientOptions } from './types.js';
import { AuthClient } from './auth.js';

export class HotelClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private apiKey: string;
  private token: string | null = null;
  private autoReconnect: boolean;
  private reconnectDelay: number;
  private debug: boolean;
  private connectionState: ConnectionState = 'disconnected';
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private authClient: AuthClient;
  private agentId: string | null = null;
  private currentRoomId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(apiKey: string, options: ClientOptions) {
    this.apiKey = apiKey;
    this.serverUrl = options.serverUrl.replace(/\/$/, '');
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectDelay = options.reconnectDelay ?? 3000;
    this.debug = options.debug ?? false;
    this.authClient = new AuthClient(this.serverUrl, options.proofToken);
  }

  /**
   * Connect to the hotel server
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected') {
      this.log('Already connected');
      return;
    }

    this.connectionState = 'connecting';
    this.log('Authenticating...');

    // Get JWT token
    const authResponse = await this.authClient.authenticate(this.apiKey);
    this.token = authResponse.token;
    this.agentId = authResponse.agentId;

    // Connect to WebSocket
    const wsUrl = this.serverUrl.replace(/^http/, 'ws') + `/ws?token=${this.token}`;
    this.log(`Connecting to ${wsUrl}...`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.connectionState = 'connected';
      this.log('Connected!');
      this.emit('connected', { agentId: this.agentId });
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (err) {
        this.log(`Failed to parse message: ${err}`);
      }
    });

    this.ws.on('error', (err) => {
      this.log(`WebSocket error: ${err.message}`);
      this.emit('error', { error: err.message });
    });

    this.ws.on('close', () => {
      this.log('Connection closed');
      this.connectionState = 'disconnected';
      this.ws = null;
      this.emit('disconnected', {});

      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('error', (data) => {
        clearTimeout(timeout);
        reject(new Error(data.error));
      });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.autoReconnect = false; // Prevent auto-reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return {
      state: this.connectionState,
      agentId: this.agentId ?? undefined,
      roomId: this.currentRoomId ?? undefined,
    };
  }

  /**
   * Register event handler
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Register one-time event handler
   */
  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Send chat message
   */
  chat(message: string): void {
    this.send({ type: 'chat', message });
  }

  /**
   * Move agent to position
   */
  move(x: number, y: number): void {
    this.send({ type: 'move', x, y });
  }

  /**
   * Enter a room
   */
  enterRoom(roomId: string): void {
    this.send({ type: 'enterRoom', roomId });
    this.currentRoomId = roomId;
  }

  /**
   * Leave current room
   */
  leaveRoom(): void {
    if (this.currentRoomId) {
      this.send({ type: 'leaveRoom', roomId: this.currentRoomId });
      this.currentRoomId = null;
    }
  }

  /**
   * Send emote
   */
  emote(emote: string): void {
    this.send({ type: 'emote', emote });
  }

  /**
   * Buy furniture item
   */
  buyFurniture(itemId: string): void {
    this.send({ type: 'buyItem', itemId });
  }

  /**
   * Place furniture in room
   */
  placeFurniture(furnitureId: string, x: number, y: number): void {
    this.send({ type: 'placeFurniture', furnitureId, x, y });
  }

  /**
   * Send friend request
   */
  sendFriendRequest(targetAgentId: string): void {
    this.send({ type: 'friendRequest', targetId: targetAgentId });
  }

  /**
   * Accept friend request
   */
  acceptFriendRequest(requestId: string): void {
    this.send({ type: 'acceptFriend', requestId });
  }

  // --- Private Methods ---

  private send(message: WSMessage): void {
    if (!this.ws || this.connectionState !== 'connected') {
      throw new Error('Not connected to server');
    }
    this.ws.send(JSON.stringify(message));
  }

  private handleMessage(message: WSMessage): void {
    this.log(`Received: ${message.type}`);
    this.emit(message.type, message);
    this.emit('*', message); // Wildcard handler
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.connectionState = 'reconnecting';
    this.log(`Reconnecting in ${this.reconnectDelay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        this.log(`Reconnect failed: ${err.message}`);
      });
    }, this.reconnectDelay);
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(`[HotelClient] ${message}`);
    }
  }
}
