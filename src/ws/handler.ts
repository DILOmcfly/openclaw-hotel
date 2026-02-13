import type { Server as HttpServer } from 'node:http';
import { URL } from 'node:url';
import type pino from 'pino';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthService } from '../services/auth.js';
import { ChatService } from '../services/chat.js';
import { ModerationService } from '../services/moderation.js';
import { PresenceService } from '../services/presence.js';
import { RoomsService } from '../services/rooms.js';
import { parseClientWsMessage, toMessageNewEvent, type ServerWsMessage } from './protocol.js';

interface ConnectionContext {
  ws: WebSocket;
  agentId: string;
  displayName: string;
  rooms: Set<string>;
  isAlive: boolean;
}

interface WsHandlerDeps {
  server: HttpServer;
  authService: AuthService;
  roomsService: RoomsService;
  presenceService: PresenceService;
  chatService: ChatService;
  moderationService: ModerationService;
  logger: pino.Logger;
}

export function createWsHandler(deps: WsHandlerDeps): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const connections = new Map<WebSocket, ConnectionContext>();
  const roomSockets = new Map<string, Set<WebSocket>>();

  const send = (ws: WebSocket, message: ServerWsMessage): void => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const broadcastRoom = (roomId: string, message: ServerWsMessage, exclude?: WebSocket): void => {
    for (const socket of roomSockets.get(roomId) ?? []) {
      if (socket === exclude) {
        continue;
      }
      send(socket, message);
    }
  };

  deps.chatService.setBroadcaster((roomId, message) => {
    broadcastRoom(roomId, toMessageNewEvent(message));
  });

  deps.server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`);
    if (requestUrl.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const token = requestUrl.searchParams.get('token');
    if (!token) {
      socket.destroy();
      return;
    }

    let payload;
    try {
      payload = deps.authService.validateToken(token);
    } catch {
      socket.destroy();
      return;
    }

    if (deps.moderationService.isBanned(payload.sub, null)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const ctx: ConnectionContext = {
        ws,
        agentId: payload.sub,
        displayName: payload.displayName,
        rooms: new Set<string>(),
        isAlive: true,
      };

      connections.set(ws, ctx);

      ws.on('pong', () => {
        ctx.isAlive = true;
      });

      ws.on('message', (raw) => {
        handleMessage(raw.toString(), ctx);
      });

      ws.on('close', () => {
        handleDisconnect(ctx);
      });

      send(ws, {
        type: 'connected',
        agent_id: ctx.agentId,
        server_time: new Date().toISOString(),
      });
    });
  });

  const handleDisconnect = (ctx: ConnectionContext): void => {
    deps.presenceService.removeAgent(ctx.agentId);

    for (const roomId of ctx.rooms) {
      roomSockets.get(roomId)?.delete(ctx.ws);
      if (roomSockets.get(roomId)?.size === 0) {
        roomSockets.delete(roomId);
      }

      broadcastRoom(
        roomId,
        {
          type: 'presence.leave',
          room_id: roomId,
          agent_id: ctx.agentId,
        },
        ctx.ws,
      );
    }

    connections.delete(ctx.ws);
  };

  const handleMessage = (rawMessage: string, ctx: ConnectionContext): void => {
    try {
      const message = parseClientWsMessage(rawMessage);

      if (message.type === 'ping') {
        deps.presenceService.updateHeartbeat(ctx.agentId);
        send(ctx.ws, {
          type: 'pong',
          server_time: new Date().toISOString(),
        });
        return;
      }

      if (message.type === 'room.join') {
        deps.roomsService.joinRoom(ctx.agentId, message.room_id);
        ctx.rooms.add(message.room_id);

        if (!roomSockets.has(message.room_id)) {
          roomSockets.set(message.room_id, new Set());
        }

        roomSockets.get(message.room_id)!.add(ctx.ws);
        const occupants = deps.presenceService
          .getOccupants(message.room_id)
          .map((entry) => ({
            id: entry.agentId,
            name: deps.authService.getAgentById(entry.agentId)?.displayName ?? entry.agentId,
          }));

        send(ctx.ws, {
          type: 'room.joined',
          room_id: message.room_id,
          occupants,
        });

        broadcastRoom(
          message.room_id,
          {
            type: 'presence.join',
            room_id: message.room_id,
            agent: {
              id: ctx.agentId,
              name: ctx.displayName,
            },
          },
          ctx.ws,
        );

        return;
      }

      if (message.type === 'room.leave') {
        deps.roomsService.leaveRoom(ctx.agentId, message.room_id);
        ctx.rooms.delete(message.room_id);
        roomSockets.get(message.room_id)?.delete(ctx.ws);

        send(ctx.ws, {
          type: 'room.left',
          room_id: message.room_id,
        });

        broadcastRoom(
          message.room_id,
          {
            type: 'presence.leave',
            room_id: message.room_id,
            agent_id: ctx.agentId,
          },
          ctx.ws,
        );

        return;
      }

      if (message.type === 'message.send') {
        deps.chatService.sendMessage({
          agentId: ctx.agentId,
          roomId: message.room_id,
          content: message.content,
          timestamp: message.timestamp,
          signature: message.signature,
        });
      }
    } catch (error) {
      deps.logger.warn({ err: error, agentId: ctx.agentId }, 'WS message rejected');
      send(ctx.ws, {
        type: 'error',
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid websocket message',
      });
    }
  };

  const heartbeat = setInterval(() => {
    for (const ctx of connections.values()) {
      if (!ctx.isAlive) {
        ctx.ws.terminate();
        continue;
      }

      ctx.isAlive = false;
      ctx.ws.ping();
    }
  }, 30_000);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  return wss;
}
