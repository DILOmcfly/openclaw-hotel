import type { IncomingMessage, Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { roomMembers, broadcastToRoom } from './handler.js';
import type { ServerMessage } from './protocol.js';
import { sql } from '../db/index.js';

// Track spectators per room
export const spectatorsByRoom = new Map<string, Set<WebSocket>>();

// WeakMap to track which room each spectator is watching
const spectatorRooms = new WeakMap<WebSocket, string>();

// WeakMap to track spectator usernames
const spectatorUsernames = new WeakMap<WebSocket, string>();

// WeakMap to track rate limiting (message count per spectator)
const spectatorRateLimits = new WeakMap<WebSocket, { count: number; resetTime: number }>();

const RATE_LIMIT_MAX = 5; // Max 5 messages
const RATE_LIMIT_WINDOW = 10000; // Per 10 seconds

// ── Reaction rate limiting ─────────────────────────────────────────────────

/** Max reactions a spectator may send per REACTION_RATE_WINDOW */
export const REACTION_RATE_LIMIT = 3;
/** Sliding window for reaction rate limiting (ms) */
export const REACTION_RATE_WINDOW_MS = 5_000;

/** Allowed reaction emojis (server-side allow-list) */
export const ALLOWED_REACTION_EMOJIS = new Set(['❤️', '😂', '🔥', '👏', '😮', '💀']);

// Per-connection reaction timestamps (sliding window)
const reactionTimestamps = new WeakMap<WebSocket, number[]>();

/**
 * Check and record a reaction attempt for the given WebSocket connection.
 * Returns `true` if the reaction is allowed, `false` if rate-limited.
 * Exported for unit tests.
 */
export function checkReactionRateLimit(ws: WebSocket, now: number = Date.now()): boolean {
  const cutoff = now - REACTION_RATE_WINDOW_MS;
  let timestamps = reactionTimestamps.get(ws) ?? [];

  // Prune expired entries
  timestamps = timestamps.filter(t => t >= cutoff);

  if (timestamps.length >= REACTION_RATE_LIMIT) {
    reactionTimestamps.set(ws, timestamps);
    return false;
  }

  timestamps.push(now);
  reactionTimestamps.set(ws, timestamps);
  return true;
}

/**
 * Returns ms until the next reaction is allowed for this connection (0 = allowed now).
 * Exported for unit tests.
 */
export function msUntilNextReaction(ws: WebSocket, now: number = Date.now()): number {
  const cutoff = now - REACTION_RATE_WINDOW_MS;
  const active = (reactionTimestamps.get(ws) ?? []).filter(t => t >= cutoff);
  if (active.length < REACTION_RATE_LIMIT) return 0;
  return active[0] + REACTION_RATE_WINDOW_MS - now;
}

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
 * Sanitize username (max 20 chars, alphanumeric + spaces/underscores)
 */
export function sanitizeUsername(username: string | undefined): string {
  if (!username || typeof username !== 'string') {
    return 'Anonymous';
  }
  
  // Remove dangerous characters, keep alphanumeric, spaces, underscores
  const sanitized = username
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .slice(0, 20);
  
  return sanitized || 'Anonymous';
}

/**
 * Check rate limit for spectator chat
 */
function checkRateLimit(ws: WebSocket): boolean {
  const now = Date.now();
  const limits = spectatorRateLimits.get(ws);
  
  if (!limits || now >= limits.resetTime) {
    // Reset window
    spectatorRateLimits.set(ws, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }
  
  if (limits.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  limits.count++;
  return true;
}

/**
 * Handle spectator chat message
 */
function handleSpectatorChat(ws: WebSocket, roomId: string, message: string | undefined): void {
  // Validate message
  if (!message || typeof message !== 'string') {
    return;
  }
  
  // Trim and limit length
  const sanitizedMessage = message.trim().slice(0, 500);
  if (sanitizedMessage.length === 0) {
    return;
  }
  
  // Check rate limit
  if (!checkRateLimit(ws)) {
    sendToSpectator(ws, {
      type: 'spectator.rateLimited',
      message: 'Too many messages. Please slow down.',
    } as any);
    return;
  }
  
  // Get username
  const username = spectatorUsernames.get(ws) || 'Anonymous';
  
  // Broadcast to all spectators in the same room (NOT to agents!)
  const spectators = spectatorsByRoom.get(roomId);
  if (!spectators) {
    return;
  }
  
  const chatMessage = {
    type: 'spectator.chatMessage',
    username,
    message: sanitizedMessage,
    timestamp: new Date().toISOString(),
    isOwnMessage: false,
  };
  
  for (const spectatorWs of spectators) {
    if (spectatorWs.readyState === WebSocket.OPEN) {
      // Mark own messages
      const messageToSend = {
        ...chatMessage,
        isOwnMessage: spectatorWs === ws,
      };
      spectatorWs.send(JSON.stringify(messageToSend));
    }
  }
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

    // Handle spectator messages
    ws.on('message', async (rawData) => {
      const data = typeof rawData === 'string' ? rawData : rawData.toString();
      
      try {
        const msg = JSON.parse(data);
        
        if (msg.type === 'ping') {
          sendToSpectator(ws, {
            type: 'pong',
            serverTime: new Date().toISOString(),
          });
        } else if (msg.type === 'requestState') {
          // Send current room state to spectator.
          // Query the presence DB table so simulation agents (who are not
          // WebSocket-connected and thus absent from roomMembers) are included.
          try {
            const presenceRows = await sql`
              SELECT
                p.agent_id::text   AS "agentId",
                a.display_name     AS "displayName",
                p.x,
                p.y
              FROM presence p
              LEFT JOIN agents a ON a.id = p.agent_id
              WHERE p.room_id = ${roomId}::uuid
            `;

            const agentList = presenceRows.map((row: any) => ({
              id: row.agentId,
              displayName: row.displayName || 'Agent',
              x: row.x ?? 0,
              y: row.y ?? 0,
              direction: 0,
            }));

            sendToSpectator(ws, {
              type: 'room.state',
              roomId,
              agents: agentList,
              spectatorCount: getSpectatorCount(roomId),
            } as any);
          } catch (err) {
            console.error('[Spectator] requestState DB query failed:', err);
            // Fallback to in-memory roomMembers if DB fails
            const agents = roomMembers.get(roomId);
            if (agents) {
              const agentList = Array.from(agents.entries()).map(([agentId, data]) => ({
                id: agentId,
                displayName: (data as any).displayName || 'Agent',
                x: (data as any).x || 0,
                y: (data as any).y || 0,
                direction: (data as any).direction || 0,
              }));
              sendToSpectator(ws, {
                type: 'room.state',
                roomId,
                agents: agentList,
                spectatorCount: getSpectatorCount(roomId),
              } as any);
            }
          }
        } else if (msg.type === 'spectator.setUsername') {
          // Set spectator username (sanitize)
          const username = sanitizeUsername(msg.username);
          spectatorUsernames.set(ws, username);
          sendToSpectator(ws, {
            type: 'spectator.usernameSet',
            username,
          } as any);
        } else if (msg.type === 'spectator.chat') {
          // Handle spectator chat messages
          handleSpectatorChat(ws, roomId, msg.message);
        } else if (msg.type === 'spectator.reaction') {
          // ── T-360: Emoji reactions ──────────────────────────────────────
          const emoji = typeof msg.emoji === 'string' ? msg.emoji : '';

          // Server-side allow-list check
          if (!ALLOWED_REACTION_EMOJIS.has(emoji)) {
            // Silently ignore invalid emojis
          } else if (!checkReactionRateLimit(ws)) {
            // Rate limited — notify sender only
            sendToSpectator(ws, {
              type: 'spectator.rateLimited',
              message: 'Reaction rate limit exceeded. Max 3 reactions per 5 seconds.',
              retryAfterMs: msUntilNextReaction(ws),
            } as any);
          } else {
            // Broadcast reaction to all spectators in the room (not agents)
            broadcastToSpectators(roomId, {
              type: 'spectator.reaction',
              emoji,
              roomId,
              timestamp: new Date().toISOString(),
            } as any);
          }
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
