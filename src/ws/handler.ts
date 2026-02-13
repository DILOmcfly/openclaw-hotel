import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { validateToken } from '../services/auth.js';
import { parseClientMessage, type ServerMessage } from './protocol.js';

export const connections = new Map<string, WebSocket>();
export const roomMembers = new Map<string, Set<string>>();

const socketAgentIds = new WeakMap<WebSocket, string>();
const pongTimeouts = new Map<string, NodeJS.Timeout>();

function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify(message));
}

function sendError(ws: WebSocket, code: string, message: string): void {
  sendMessage(ws, {
    type: 'error',
    code,
    message,
  });
}

function extractToken(req: IncomingMessage): string | null {
  const host = req.headers.host ?? 'localhost';
  const pathname = req.url ?? '/';
  const url = new URL(pathname, `http://${host}`);
  return url.searchParams.get('token');
}

export function broadcastToRoom(
  roomId: string,
  message: ServerMessage,
  excludeAgentId?: string
): void {
  const members = roomMembers.get(roomId);
  if (!members || members.size === 0) {
    return;
  }

  const payload = JSON.stringify(message);
  for (const agentId of members) {
    if (excludeAgentId && agentId === excludeAgentId) {
      continue;
    }

    const ws = connections.get(agentId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    ws.send(payload);
  }
}

function removeAgentFromRoom(roomId: string, agentId: string): boolean {
  const members = roomMembers.get(roomId);
  if (!members) {
    return false;
  }

  const wasMember = members.delete(agentId);
  if (members.size === 0) {
    roomMembers.delete(roomId);
  }

  return wasMember;
}

function removeAgentEverywhere(agentId: string): string[] {
  const removedFromRooms: string[] = [];

  for (const [roomId, members] of roomMembers) {
    if (!members.delete(agentId)) {
      continue;
    }

    removedFromRooms.push(roomId);
    if (members.size === 0) {
      roomMembers.delete(roomId);
    }
  }

  return removedFromRooms;
}

function cleanupAgent(agentId: string): string[] {
  connections.delete(agentId);

  const timeout = pongTimeouts.get(agentId);
  if (timeout) {
    clearTimeout(timeout);
    pongTimeouts.delete(agentId);
  }

  return removeAgentEverywhere(agentId);
}

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const token = extractToken(req);

    if (!token) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.close(4001, 'Unauthorized');
      });
      return;
    }

    let agentId: string;
    try {
      ({ agentId } = validateToken(token));
    } catch {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.close(4001, 'Unauthorized');
      });
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, agentId);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, agentId: string) => {
    const previous = connections.get(agentId);
    if (previous && previous !== ws) {
      previous.terminate();
    }

    connections.set(agentId, ws);
    socketAgentIds.set(ws, agentId);

    sendMessage(ws, {
      type: 'connected',
      agentId,
      serverTime: new Date().toISOString(),
    });

    ws.on('pong', () => {
      const timeout = pongTimeouts.get(agentId);
      if (timeout) {
        clearTimeout(timeout);
        pongTimeouts.delete(agentId);
      }
    });

    ws.on('message', (rawData) => {
      const data = typeof rawData === 'string' ? rawData : rawData.toString();

      let clientMessage;
      try {
        clientMessage = parseClientMessage(data);
      } catch {
        sendError(ws, 'VALIDATION_ERROR', 'Invalid client message');
        return;
      }

      switch (clientMessage.type) {
        case 'ping': {
          sendMessage(ws, {
            type: 'pong',
            serverTime: new Date().toISOString(),
          });
          break;
        }

        case 'room.join': {
          const members = roomMembers.get(clientMessage.roomId) ?? new Set<string>();
          members.add(agentId);
          roomMembers.set(clientMessage.roomId, members);

          broadcastToRoom(clientMessage.roomId, {
            type: 'presence.join',
            roomId: clientMessage.roomId,
            agent: {
              id: agentId,
              name: `Agent ${agentId.slice(0, 8)}`,
              x: 0,
              y: 0,
            },
          });
          break;
        }

        case 'room.leave': {
          const left = removeAgentFromRoom(clientMessage.roomId, agentId);
          if (left) {
            broadcastToRoom(
              clientMessage.roomId,
              {
                type: 'presence.leave',
                roomId: clientMessage.roomId,
                agentId,
              },
              agentId
            );
          }
          break;
        }

        case 'message.send': {
          broadcastToRoom(clientMessage.roomId, {
            type: 'message.new',
            roomId: clientMessage.roomId,
            agentId,
            displayName: `Agent ${agentId.slice(0, 8)}`,
            content: clientMessage.content,
            signature: clientMessage.signature,
            timestamp: new Date().toISOString(),
          });
          break;
        }

        case 'agent.move': {
          broadcastToRoom(clientMessage.roomId, {
            type: 'agent.moved',
            roomId: clientMessage.roomId,
            agentId,
            x: clientMessage.targetX,
            y: clientMessage.targetY,
            rotation: 0,
          });
          break;
        }

        case 'furniture.place': {
          broadcastToRoom(clientMessage.roomId, {
            type: 'furniture.placed',
            roomId: clientMessage.roomId,
            item: {
              id: randomUUID(),
              itemDefId: clientMessage.itemDefId,
              x: clientMessage.x,
              y: clientMessage.y,
              rotation: clientMessage.rotation,
              placedBy: agentId,
              createdAt: new Date().toISOString(),
            },
          });
          break;
        }

        case 'furniture.remove': {
          broadcastToRoom(clientMessage.roomId, {
            type: 'furniture.removed',
            roomId: clientMessage.roomId,
            itemId: clientMessage.itemId,
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      const closingAgentId = socketAgentIds.get(ws);
      if (!closingAgentId) {
        return;
      }

      const rooms = cleanupAgent(closingAgentId);
      for (const roomId of rooms) {
        broadcastToRoom(
          roomId,
          {
            type: 'presence.leave',
            roomId,
            agentId: closingAgentId,
          },
          closingAgentId
        );
      }
    });
  });

  const heartbeatInterval = setInterval(() => {
    for (const [agentId, ws] of connections) {
      if (ws.readyState !== WebSocket.OPEN) {
        cleanupAgent(agentId);
        continue;
      }

      const previousTimeout = pongTimeouts.get(agentId);
      if (previousTimeout) {
        clearTimeout(previousTimeout);
      }

      const timeout = setTimeout(() => {
        ws.terminate();

        const rooms = cleanupAgent(agentId);
        for (const roomId of rooms) {
          broadcastToRoom(
            roomId,
            {
              type: 'presence.leave',
              roomId,
              agentId,
            },
            agentId
          );
        }
      }, 10_000);

      pongTimeouts.set(agentId, timeout);
      ws.ping();
    }
  }, 30_000);

  server.on('close', () => {
    clearInterval(heartbeatInterval);
    for (const timeout of pongTimeouts.values()) {
      clearTimeout(timeout);
    }
    pongTimeouts.clear();
  });
}
