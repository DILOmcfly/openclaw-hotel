import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { validateToken } from '../services/auth.js';
import { parseClientMessage, type ServerMessage } from './protocol.js';
import { sql } from '../db/index.js';
import { placeFurniture, removeFurniture, getItemsInRoom } from '../services/furniture.js';
import { validateRoomAccess, isRoomFull } from '../services/roomPrivacy.js';
import { isAgentMuted, checkMessageFilters, muteAgent } from '../services/moderationTools.js';

export const connections = new Map<string, WebSocket>();
export const roomMembers = new Map<string, Set<string>>();

/**
 * Check if an agent is currently online
 */
export function isAgentOnline(agentId: string): boolean {
  const ws = connections.get(agentId);
  return !!ws && ws.readyState === WebSocket.OPEN;
}

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

/**
 * Send a message to a specific agent
 */
export function sendToAgent(agentId: string, message: ServerMessage): void {
  const ws = connections.get(agentId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify(message));
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

    ws.on('message', async (rawData) => {
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
          // Check room privacy and access
          const accessCheck = await validateRoomAccess(
            clientMessage.roomId,
            agentId,
            sql,
            clientMessage.password
          );

          if (!accessCheck.allowed) {
            sendError(ws, 'room.access_denied', accessCheck.reason || 'Access denied');
            break;
          }

          // Check if room is full
          const roomFull = await isRoomFull(clientMessage.roomId, sql);
          if (roomFull) {
            sendError(ws, 'room.full', 'Room is at maximum capacity');
            break;
          }

          const members = roomMembers.get(clientMessage.roomId) ?? new Set<string>();
          members.add(agentId);
          roomMembers.set(clientMessage.roomId, members);

          // Fetch existing furniture in the room
          let roomItems: any[] = [];
          try {
            roomItems = await getItemsInRoom(clientMessage.roomId, sql);
          } catch (error) {
            console.error('[WS] Error fetching room items:', error);
          }

          // Send room.joined to the joining agent with existing items
          sendMessage(ws, {
            type: 'room.joined',
            roomId: clientMessage.roomId,
            items: roomItems,
          });

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
          // Check if agent is muted
          const muted = await isAgentMuted(agentId);
          if (muted) {
            sendError(ws, 'MUTED', 'You are currently muted');
            break;
          }

          // Check message against word filters
          const filterResult = await checkMessageFilters(clientMessage.content);

          // Block message if flagged
          if (filterResult.blocked) {
            sendError(ws, 'MESSAGE_BLOCKED', 'Message contains prohibited content');
            break;
          }

          // Auto-mute if triggered
          if (filterResult.autoMute && filterResult.muteDurationMinutes) {
            await muteAgent(
              agentId,
              '00000000-0000-0000-0000-000000000000', // System
              filterResult.muteDurationMinutes,
              `Auto-muted for prohibited content: ${filterResult.matchedFilters.join(', ')}`
            );
            sendError(ws, 'AUTO_MUTED', `You have been muted for ${filterResult.muteDurationMinutes} minutes`);
            break;
          }

          // Flag message (log but allow through)
          if (filterResult.flagged) {
            console.warn(`[MODERATION] Flagged message from ${agentId}:`, {
              content: clientMessage.content,
              filters: filterResult.matchedFilters,
            });
          }

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
          try {
            // Persist to database
            const placedItem = await placeFurniture(
              clientMessage.roomId,
              clientMessage.itemDefId,
              clientMessage.x,
              clientMessage.y,
              clientMessage.rotation || 0,
              agentId,
              sql
            );

            // Deduct from user's inventory
            await sql`
              UPDATE user_inventory
              SET quantity = quantity - 1
              WHERE agent_id = ${agentId} AND item_def_id = ${clientMessage.itemDefId} AND quantity > 0
            `;

            // Clean up zero-quantity items
            await sql`
              DELETE FROM user_inventory
              WHERE agent_id = ${agentId} AND quantity <= 0
            `;

            // Broadcast to all in room
            broadcastToRoom(clientMessage.roomId, {
              type: 'furniture.placed',
              roomId: clientMessage.roomId,
              item: placedItem,
            });
          } catch (error: any) {
            sendError(ws, 'PLACEMENT_FAILED', error.message || 'Failed to place furniture');
          }
          break;
        }

        case 'furniture.remove': {
          try {
            // Get item details before removing
            const [item] = await sql`
              SELECT id, item_def_id AS "itemDefId", placed_by AS "placedBy"
              FROM room_items
              WHERE id = ${clientMessage.itemId} AND room_id = ${clientMessage.roomId}
            `;

            if (!item) {
              sendError(ws, 'ITEM_NOT_FOUND', 'Furniture item not found');
              break;
            }

            // Only owner can remove (or admin in future)
            if (item.placedBy !== agentId) {
              sendError(ws, 'PERMISSION_DENIED', 'You can only remove your own furniture');
              break;
            }

            // Remove from database
            const removed = await removeFurniture(clientMessage.roomId, clientMessage.itemId, sql);
            if (!removed) {
              sendError(ws, 'REMOVAL_FAILED', 'Failed to remove furniture');
              break;
            }

            // Return to user's inventory
            await sql`
              INSERT INTO user_inventory (agent_id, item_def_id, quantity)
              VALUES (${agentId}, ${item.itemDefId}, 1)
              ON CONFLICT (agent_id, item_def_id)
              DO UPDATE SET quantity = user_inventory.quantity + 1
            `;

            // Broadcast removal
            broadcastToRoom(clientMessage.roomId, {
              type: 'furniture.removed',
              roomId: clientMessage.roomId,
              itemId: clientMessage.itemId,
            });
          } catch (error: any) {
            sendError(ws, 'REMOVAL_FAILED', error.message || 'Failed to remove furniture');
          }
          break;
        }

        case 'furniture.move': {
          try {
            // Get item to verify ownership
            const [item] = await sql`
              SELECT id, item_def_id AS "itemDefId", placed_by AS "placedBy", rotation
              FROM room_items
              WHERE id = ${clientMessage.itemId} AND room_id = ${clientMessage.roomId}
            `;

            if (!item) {
              sendError(ws, 'ITEM_NOT_FOUND', 'Furniture item not found');
              break;
            }

            if (item.placedBy !== agentId) {
              sendError(ws, 'PERMISSION_DENIED', 'You can only move your own furniture');
              break;
            }

            // Check collision at new position
            const existingItems = await getItemsInRoom(clientMessage.roomId, sql);
            const otherItems = existingItems.filter((i: any) => i.id !== clientMessage.itemId);
            
            const { getAffectedTiles, checkCollision, getStackHeight } = await import('../services/furniture.js');
            const affectedTiles = getAffectedTiles(item.itemDefId, clientMessage.x, clientMessage.y, item.rotation);
            
            if (checkCollision(affectedTiles, otherItems)) {
              sendError(ws, 'COLLISION', 'Cannot move furniture: collision detected');
              break;
            }

            const z = getStackHeight(clientMessage.x, clientMessage.y, otherItems);

            // Update position
            await sql`
              UPDATE room_items
              SET x = ${clientMessage.x}, y = ${clientMessage.y}, z = ${z}
              WHERE id = ${clientMessage.itemId} AND room_id = ${clientMessage.roomId}
            `;

            // Broadcast move
            broadcastToRoom(clientMessage.roomId, {
              type: 'furniture.moved',
              roomId: clientMessage.roomId,
              itemId: clientMessage.itemId,
              x: clientMessage.x,
              y: clientMessage.y,
              z,
            });
          } catch (error: any) {
            sendError(ws, 'MOVE_FAILED', error.message || 'Failed to move furniture');
          }
          break;
        }

        case 'furniture.rotate': {
          try {
            // Get item to verify ownership
            const [item] = await sql`
              SELECT id, item_def_id AS "itemDefId", placed_by AS "placedBy", x, y
              FROM room_items
              WHERE id = ${clientMessage.itemId} AND room_id = ${clientMessage.roomId}
            `;

            if (!item) {
              sendError(ws, 'ITEM_NOT_FOUND', 'Furniture item not found');
              break;
            }

            if (item.placedBy !== agentId) {
              sendError(ws, 'PERMISSION_DENIED', 'You can only rotate your own furniture');
              break;
            }

            // Check collision with new rotation
            const existingItems = await getItemsInRoom(clientMessage.roomId, sql);
            const otherItems = existingItems.filter((i: any) => i.id !== clientMessage.itemId);
            
            const { getAffectedTiles, checkCollision } = await import('../services/furniture.js');
            const affectedTiles = getAffectedTiles(item.itemDefId, item.x, item.y, clientMessage.rotation);
            
            if (checkCollision(affectedTiles, otherItems)) {
              sendError(ws, 'COLLISION', 'Cannot rotate furniture: collision detected');
              break;
            }

            // Update rotation
            await sql`
              UPDATE room_items
              SET rotation = ${clientMessage.rotation}
              WHERE id = ${clientMessage.itemId} AND room_id = ${clientMessage.roomId}
            `;

            // Broadcast rotation
            broadcastToRoom(clientMessage.roomId, {
              type: 'furniture.rotated',
              roomId: clientMessage.roomId,
              itemId: clientMessage.itemId,
              rotation: clientMessage.rotation,
            });
          } catch (error: any) {
            sendError(ws, 'ROTATE_FAILED', error.message || 'Failed to rotate furniture');
          }
          break;
        }

        case 'emote': {
          // Broadcast emote to all room members
          broadcastToRoom(clientMessage.roomId, {
            type: 'emote.broadcast',
            roomId: clientMessage.roomId,
            agentId,
            emote: clientMessage.emote,
          });
          break;
        }

        case 'trade.request': {
          try {
            const { createTrade, validateSameRoom } = await import('../services/trading.js');
            
            // Validate both agents are in the same room
            const roomId = await validateSameRoom(agentId, clientMessage.targetAgentId, sql);
            if (!roomId) {
              sendError(ws, 'TRADE_FAILED', 'Both agents must be in the same room');
              break;
            }

            // Create trade
            const trade = await createTrade(agentId, clientMessage.targetAgentId, sql);

            // Get initiator name
            const [initiator] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            // Notify target agent
            const targetWs = connections.get(clientMessage.targetAgentId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              sendMessage(targetWs, {
                type: 'trade.requested',
                tradeId: trade.id,
                initiatorId: agentId,
                initiatorName: initiator?.display_name || 'Agent',
              });
            }

            // Confirm to initiator
            sendMessage(ws, {
              type: 'trade.requested',
              tradeId: trade.id,
              initiatorId: agentId,
              initiatorName: initiator?.display_name || 'Agent',
            });
          } catch (error: any) {
            sendError(ws, 'TRADE_FAILED', error.message || 'Failed to create trade request');
          }
          break;
        }

        case 'trade.update': {
          try {
            const { updateTradeItems, getTrade } = await import('../services/trading.js');
            
            await updateTradeItems(clientMessage.tradeId, agentId, clientMessage.items, sql);
            
            // Get trade to find the other participant
            const trade = await getTrade(clientMessage.tradeId, sql);
            if (!trade) {
              sendError(ws, 'TRADE_NOT_FOUND', 'Trade not found');
              break;
            }

            const otherAgentId = trade.initiatorId === agentId ? trade.targetId : trade.initiatorId;

            // Broadcast update to both parties
            const updateMsg: ServerMessage = {
              type: 'trade.updated',
              tradeId: clientMessage.tradeId,
              agentId,
              items: clientMessage.items,
            };

            sendMessage(ws, updateMsg);

            const otherWs = connections.get(otherAgentId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              sendMessage(otherWs, updateMsg);
            }
          } catch (error: any) {
            sendError(ws, 'TRADE_UPDATE_FAILED', error.message || 'Failed to update trade');
          }
          break;
        }

        case 'trade.accept': {
          try {
            const { acceptTrade, getTrade } = await import('../services/trading.js');
            
            const trade = await getTrade(clientMessage.tradeId, sql);
            if (!trade) {
              sendError(ws, 'TRADE_NOT_FOUND', 'Trade not found');
              break;
            }

            await acceptTrade(clientMessage.tradeId, agentId, sql);

            const otherAgentId = trade.initiatorId === agentId ? trade.targetId : trade.initiatorId;

            // Notify both parties
            const completedMsg: ServerMessage = {
              type: 'trade.completed',
              tradeId: clientMessage.tradeId,
            };

            sendMessage(ws, completedMsg);

            const otherWs = connections.get(otherAgentId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              sendMessage(otherWs, completedMsg);
            }
          } catch (error: any) {
            sendError(ws, 'TRADE_ACCEPT_FAILED', error.message || 'Failed to accept trade');
          }
          break;
        }

        case 'trade.reject': {
          try {
            const { rejectTrade, getTrade } = await import('../services/trading.js');
            
            const trade = await getTrade(clientMessage.tradeId, sql);
            if (!trade) {
              sendError(ws, 'TRADE_NOT_FOUND', 'Trade not found');
              break;
            }

            await rejectTrade(clientMessage.tradeId, agentId, sql);

            const otherAgentId = trade.initiatorId === agentId ? trade.targetId : trade.initiatorId;

            // Notify both parties
            const cancelledMsg: ServerMessage = {
              type: 'trade.cancelled',
              tradeId: clientMessage.tradeId,
              reason: 'rejected',
            };

            sendMessage(ws, cancelledMsg);

            const otherWs = connections.get(otherAgentId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              sendMessage(otherWs, cancelledMsg);
            }
          } catch (error: any) {
            sendError(ws, 'TRADE_REJECT_FAILED', error.message || 'Failed to reject trade');
          }
          break;
        }

        case 'trade.cancel': {
          try {
            const { cancelTrade, getTrade } = await import('../services/trading.js');
            
            const trade = await getTrade(clientMessage.tradeId, sql);
            if (!trade) {
              sendError(ws, 'TRADE_NOT_FOUND', 'Trade not found');
              break;
            }

            await cancelTrade(clientMessage.tradeId, agentId, sql);

            const otherAgentId = trade.initiatorId === agentId ? trade.targetId : trade.initiatorId;

            // Notify both parties
            const cancelledMsg: ServerMessage = {
              type: 'trade.cancelled',
              tradeId: clientMessage.tradeId,
              reason: 'cancelled',
            };

            sendMessage(ws, cancelledMsg);

            const otherWs = connections.get(otherAgentId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              sendMessage(otherWs, cancelledMsg);
            }
          } catch (error: any) {
            sendError(ws, 'TRADE_CANCEL_FAILED', error.message || 'Failed to cancel trade');
          }
          break;
        }

        case 'game.create': {
          try {
            const { createGame } = await import('../services/games.js');
            
            const game = createGame(clientMessage.roomId, clientMessage.gameType, agentId);

            // Get creator name
            const [creator] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            // Broadcast to room that a new game is available
            broadcastToRoom(clientMessage.roomId, {
              type: 'game.created',
              gameId: game.id,
              gameType: game.type,
              hostId: agentId,
              hostName: creator?.display_name || 'Agent',
              status: game.status,
            });
          } catch (error: any) {
            sendError(ws, 'GAME_CREATE_FAILED', error.message || 'Failed to create game');
          }
          break;
        }

        case 'game.join': {
          try {
            const { joinGame, getGameState } = await import('../services/games.js');
            
            const game = joinGame(clientMessage.gameId, agentId);

            // Get joiner name
            const [joiner] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            // Notify all participants
            for (const participantId of game.participants) {
              const participantWs = connections.get(participantId);
              if (participantWs && participantWs.readyState === WebSocket.OPEN) {
                sendMessage(participantWs, {
                  type: 'game.joined',
                  gameId: game.id,
                  agentId,
                  agentName: joiner?.display_name || 'Agent',
                  status: game.status,
                  participants: game.participants,
                });
              }
            }

            // Broadcast to room if game is now active
            if (game.status === 'active') {
              broadcastToRoom(game.roomId, {
                type: 'game.started',
                gameId: game.id,
                participants: game.participants,
              }, agentId);
            }
          } catch (error: any) {
            sendError(ws, 'GAME_JOIN_FAILED', error.message || 'Failed to join game');
          }
          break;
        }

        case 'game.move': {
          try {
            const { makeMove } = await import('../services/games.js');
            
            const game = makeMove(clientMessage.gameId, agentId, clientMessage.move);

            // Notify all participants of the move
            for (const participantId of game.participants) {
              const participantWs = connections.get(participantId);
              if (participantWs && participantWs.readyState === WebSocket.OPEN) {
                sendMessage(participantWs, {
                  type: 'game.updated',
                  gameId: game.id,
                  status: game.status,
                  agentId,
                  move: clientMessage.move,
                });
              }
            }

            // If game completed, send result
            if (game.status === 'completed' && game.result) {
              for (const participantId of game.participants) {
                const participantWs = connections.get(participantId);
                if (participantWs && participantWs.readyState === WebSocket.OPEN) {
                  sendMessage(participantWs, {
                    type: 'game.completed',
                    gameId: game.id,
                    winnerId: game.result.winnerId,
                    result: game.result.details,
                  });
                }
              }

              // Broadcast result to room
              broadcastToRoom(game.roomId, {
                type: 'game.completed',
                gameId: game.id,
                winnerId: game.result.winnerId,
                result: game.result.details,
              });
            }
          } catch (error: any) {
            sendError(ws, 'GAME_MOVE_FAILED', error.message || 'Failed to make move');
          }
          break;
        }

        case 'game.end': {
          try {
            const { endGame, getGameState } = await import('../services/games.js');
            
            const gameState = getGameState(clientMessage.gameId);
            
            // Only host can end game
            if (gameState.hostId !== agentId) {
              sendError(ws, 'GAME_END_FORBIDDEN', 'Only the host can end this game');
              break;
            }

            const game = endGame(clientMessage.gameId);

            // Notify all participants
            for (const participantId of game.participants) {
              const participantWs = connections.get(participantId);
              if (participantWs && participantWs.readyState === WebSocket.OPEN) {
                sendMessage(participantWs, {
                  type: 'game.ended',
                  gameId: game.id,
                  reason: 'cancelled',
                });
              }
            }

            // Broadcast to room
            broadcastToRoom(game.roomId, {
              type: 'game.ended',
              gameId: game.id,
              reason: 'cancelled',
            });
          } catch (error: any) {
            sendError(ws, 'GAME_END_FAILED', error.message || 'Failed to end game');
          }
          break;
        }

        case 'friend.request': {
          try {
            const { sendFriendRequest } = await import('../services/friends.js');
            
            const friendship = await sendFriendRequest(agentId, clientMessage.targetAgentId, sql);

            // Get requester name
            const [requester] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            // Notify target agent
            const targetWs = connections.get(clientMessage.targetAgentId);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              sendMessage(targetWs, {
                type: 'friend.request.received',
                friendshipId: friendship.id,
                requesterId: agentId,
                requesterName: requester?.display_name || 'Agent',
              });
            }

            // Confirm to requester
            sendMessage(ws, {
              type: 'friend.request.received',
              friendshipId: friendship.id,
              requesterId: agentId,
              requesterName: requester?.display_name || 'Agent',
            });
          } catch (error: any) {
            sendError(ws, 'FRIEND_REQUEST_FAILED', error.message || 'Failed to send friend request');
          }
          break;
        }

        case 'friend.accept': {
          try {
            const { acceptFriendRequest } = await import('../services/friends.js');
            
            // Get friendship details before accepting
            const [friendship] = await sql`
              SELECT requester_id, addressee_id FROM friendships WHERE id = ${clientMessage.friendshipId}
            `;

            if (!friendship) {
              sendError(ws, 'FRIENDSHIP_NOT_FOUND', 'Friendship not found');
              break;
            }

            await acceptFriendRequest(clientMessage.friendshipId, agentId, sql);

            const otherAgentId = friendship.requester_id === agentId ? friendship.addressee_id : friendship.requester_id;

            // Get names
            const [accepter] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            // Notify both parties
            const acceptedMsg: ServerMessage = {
              type: 'friend.accepted',
              friendshipId: clientMessage.friendshipId,
              agentId,
              agentName: accepter?.display_name || 'Agent',
            };

            sendMessage(ws, acceptedMsg);

            const otherWs = connections.get(otherAgentId);
            if (otherWs && otherWs.readyState === WebSocket.OPEN) {
              sendMessage(otherWs, acceptedMsg);
            }
          } catch (error: any) {
            sendError(ws, 'FRIEND_ACCEPT_FAILED', error.message || 'Failed to accept friend request');
          }
          break;
        }

        case 'whisper.send': {
          try {
            const { DirectMessageService } = await import('../services/directMessages.js');
            const dmService = new DirectMessageService(sql);
            
            // Send message
            const message = await dmService.sendMessage(
              agentId,
              clientMessage.recipientId,
              clientMessage.content
            );

            // Get sender name
            const [sender] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            // Notify recipient
            const recipientWs = connections.get(clientMessage.recipientId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              sendMessage(recipientWs, {
                type: 'whisper.received',
                messageId: message.id,
                senderId: agentId,
                senderName: sender?.display_name || 'Agent',
                content: message.content,
                createdAt: message.createdAt,
              });
            }

            // Confirm to sender
            sendMessage(ws, {
              type: 'whisper.sent',
              messageId: message.id,
              recipientId: clientMessage.recipientId,
              content: message.content,
              createdAt: message.createdAt,
            });
          } catch (error: any) {
            sendError(ws, 'WHISPER_FAILED', error.message || 'Failed to send whisper');
          }
          break;
        }

        case 'whisper.typing': {
          // Forward typing indicator to recipient
          const recipientWs = connections.get(clientMessage.recipientId);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            sendMessage(recipientWs, {
              type: 'whisper.typing',
              senderId: agentId,
            });
          }
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
