import type { IncomingMessage, Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { roomMembers, broadcastToRoom } from './handler.js';
import type { ServerMessage } from './protocol.js';

// Track spectators per room
export const spectatorsByRoom = new Map<string, Set<WebSocket>>();

// WeakMap to track which room each spectator is watching
const spectatorRooms = new WeakMap<WebSocket, string>();

/**
 * Get spectator count for a room
 */
export function getSpectatorCount(roomId: string): number {
  const spectators = spectatorsByRoom.get(roomId);
  return spectators ? spectators.size : 0;
}

/**
 * Broadcast spectator count update to agents in room
 */
function broadcastSpectatorCount(roomId: string): void {
  const count = getSpectatorCount(roomId);
  broadcastToRoom(roomId, {
    type: 'spectator.count',
    roomId,
    count,
  } as any);
}

/**
 * Send message to a spectator WebSocket
 */
function sendToSpectator(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  ws.send(JSON.stringify(message));
}

/**
 * Broadcast message to all spectators in a room
 */
export function broadcastToSpectators(roomId: string, message: ServerMessage): void {
  const spectators = spectatorsByRoom.get(roomId);
  if (!spectators || spectators.size === 0) {
    return;
  }

  const payload = JSON.stringify(message);
  for (const ws of spectators) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Remove spectator from their current room
 */
function removeSpectatorFromRoom(ws: WebSocket): void {
  const currentRoom = spectatorRooms.get(ws);
  if (!currentRoom) {
    return;
  }

  const spectators = spectatorsByRoom.get(currentRoom);
  if (spectators) {
    spectators.delete(ws);
    if (spectators.size === 0) {
      spectatorsByRoom.delete(currentRoom);
    }
    broadcastSpectatorCount(currentRoom);
  }
  spectatorRooms.delete(ws);
}

/**
 * Extract roomId from query params
 */
function extractRoomId(req: IncomingMessage): string | null {
  const host = req.headers.host ?? 'localhost';
  const pathname = req.url ?? '/';
  const url = new URL(pathname, `http://${host}`);
  return url.searchParams.get('roomId');
}

/**
 * Setup spectator WebSocket endpoint
 * Public access, read-only, no authentication required
 */
export function setupSpectatorWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    // Only handle /ws/spectate paths
    if (!req.url?.startsWith('/ws/spectate')) {
      return;
    }

    const roomId = extractRoomId(req);
    if (!roomId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, roomId);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, roomId: string) => {
    // Add spectator to room
    let spectators = spectatorsByRoom.get(roomId);
    if (!spectators) {
      spectators = new Set<WebSocket>();
      spectatorsByRoom.set(roomId, spectators);
    }
    spectators.add(ws);
    spectatorRooms.set(ws, roomId);

    // Send welcome message
    sendToSpectator(ws, {
      type: 'spectator.connected',
      roomId,
      spectatorCount: spectators.size,
      serverTime: new Date().toISOString(),
    } as any);

    // Broadcast updated spectator count to agents
    broadcastSpectatorCount(roomId);

    // Handle ping/pong for keepalive
    ws.on('pong', () => {
      // Connection is alive
    });

    // Spectators CANNOT send messages (read-only)
    // Any message they try to send is ignored
    ws.on('message', (rawData) => {
      const data = typeof rawData === 'string' ? rawData : rawData.toString();
      
      try {
        const msg = JSON.parse(data);
        
        // Only allow ping messages
        if (msg.type === 'ping') {
          sendToSpectator(ws, {
            type: 'pong',
            serverTime: new Date().toISOString(),
          });
        }
        // Silently ignore all other message types
      } catch {
        // Invalid JSON - ignore
      }
    });

    ws.on('close', () => {
      removeSpectatorFromRoom(ws);
    });

    ws.on('error', () => {
      removeSpectatorFromRoom(ws);
    });
  });

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    for (const spectators of spectatorsByRoom.values()) {
      for (const ws of spectators) {
        if (ws.readyState !== WebSocket.OPEN) {
          removeSpectatorFromRoom(ws);
          continue;
        }
        ws.ping();
      }
    }
  }, 30_000);

  server.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}
