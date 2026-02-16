import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { validateToken } from '../services/auth.js';
import { authenticateAgent } from '../services/agentAuth.js';
import { parseClientMessage, type ServerMessage } from './protocol.js';
import { sql } from '../db/index.js';
import { placeFurniture, removeFurniture, getItemsInRoom } from '../services/furniture.js';
import { validateRoomAccess, isRoomFull } from '../services/roomPrivacy.js';
import { isAgentMuted, checkMessageFilters, muteAgent } from '../services/moderationTools.js';
import { isBanned, isGuest } from '../services/roomPermissions.js';
import { calculateActionImpacts, updateTraitFromAction } from '../services/personality.js';
import { processTriggerEvent, type TriggerEvent, type ScriptAction } from '../services/scriptEngine.js';

export const connections = new Map<string, WebSocket>();
export const roomMembers = new Map<string, Set<string>>();

/**
 * Track action for personality update (non-blocking)
 */
function trackAction(agentId: string, actionType: string): void {
  const impacts = calculateActionImpacts(actionType);
  if (impacts.length > 0) {
    updateTraitFromAction(sql, agentId, impacts).catch((err) => {
      console.error('[PERSONALITY] Error updating traits:', err);
    });
  }
}

/**
 * Execute script actions from room automation (Wired System)
 */
async function executeScriptActions(actions: ScriptAction[], roomId: string): Promise<void> {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'teleport_agent':
          if (action.targetAgentId) {
            broadcastToRoom(roomId, {
              type: 'agent.teleport',
              roomId,
              agentId: action.targetAgentId,
              x: action.data.x,
              y: action.data.y,
            });
          }
          break;

        case 'show_message':
          broadcastToRoom(roomId, {
            type: 'message.new',
            roomId,
            agentId: '00000000-0000-0000-0000-000000000000',
            displayName: 'Wired System',
            content: action.data.text,
            signature: '',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'toggle_furniture':
          broadcastToRoom(roomId, {
            type: 'furniture.toggle',
            roomId,
            itemId: action.data.itemId,
            state: action.data.state,
          });
          break;

        case 'give_coins':
          if (action.targetAgentId) {
            // Update agent's coins
            await sql`
              UPDATE agents
              SET coins = COALESCE(coins, 0) + ${action.data.amount}
              WHERE id = ${action.targetAgentId}::uuid
            `;

            // Notify the agent
            const ws = connections.get(action.targetAgentId);
            if (ws && ws.readyState === WebSocket.OPEN) {
              sendMessage(ws, {
                type: 'coins.received',
                amount: action.data.amount,
                source: 'wired_system',
              });
            }
          }
          break;
      }
    } catch (error) {
      console.error('[WIRED] Error executing script action:', error);
    }
  }
}

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

function extractApiKey(req: IncomingMessage): string | null {
  const host = req.headers.host ?? 'localhost';
  const pathname = req.url ?? '/';
  const url = new URL(pathname, `http://${host}`);
  return url.searchParams.get('apiKey');
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

  // Also broadcast to spectators
  const { broadcastToSpectators } = require('./spectator.js');
  broadcastToSpectators(roomId, message);
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

  server.on('upgrade', async (req, socket, head) => {
    // Skip spectator WebSocket paths — handled by spectator.ts
    if (req.url?.startsWith('/ws/spectate')) {
      return;
    }

    const token = extractToken(req);
    const apiKey = extractApiKey(req);

    if (!token && !apiKey) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.close(4001, 'Unauthorized: token or apiKey required');
      });
      return;
    }

    let agentId: string | null = null;

    try {
      // Try JWT token first
      if (token) {
        ({ agentId } = validateToken(token));
      }
      // Fallback to API key
      else if (apiKey) {
        agentId = await authenticateAgent(apiKey, sql);
      }

      if (!agentId) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          ws.close(4001, 'Unauthorized: invalid credentials');
        });
        return;
      }
    } catch {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.close(4001, 'Unauthorized: authentication failed');
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
          // Check if agent is banned from the room
          const banned = await isBanned(clientMessage.roomId, agentId, sql);
          if (banned) {
            sendError(ws, 'room.banned', 'You are banned from this room');
            break;
          }

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

          // For private rooms, check guest list (unless owner)
          const roomRows = await sql`
            SELECT visibility, created_by AS "createdBy"
            FROM rooms
            WHERE id = ${clientMessage.roomId}::uuid
            LIMIT 1
          `;

          if (roomRows.length > 0 && roomRows[0].visibility === 'private') {
            const isOwner = roomRows[0].createdBy === agentId;
            if (!isOwner) {
              const onGuestList = await isGuest(clientMessage.roomId, agentId, sql);
              if (!onGuestList) {
                sendError(ws, 'room.access_denied', 'You must be on the guest list');
                break;
              }
            }
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

          // Track personality: exploring new rooms increases curiosity
          trackAction(agentId, 'room_explore');

          // Trigger room scripts: agent_enters
          processTriggerEvent(
            {
              type: 'agent_enters',
              roomId: clientMessage.roomId,
              agentId,
              data: {},
            },
            sql
          ).then((actions) => {
            if (actions.length > 0) {
              executeScriptActions(actions, clientMessage.roomId).catch((err) => {
                console.error('[WIRED] Error executing agent_enters actions:', err);
              });
            }
          }).catch((err) => {
            console.error('[WIRED] Error processing agent_enters trigger:', err);
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

          // Check for chat commands
          const { processCommand } = await import('../services/chatCommands.js');
          const commandResult = processCommand(clientMessage.content, {
            roomId: clientMessage.roomId,
            agentName: `Agent ${agentId.slice(0, 8)}`,
            getOnlineCount: () => connections.size,
            getRoomInfo: async () => {
              const [room] = await sql`
                SELECT name, created_by AS "createdBy" FROM rooms WHERE id = ${clientMessage.roomId}::uuid
              `;
              const members = roomMembers.get(clientMessage.roomId);
              return {
                name: room?.name || 'Unknown Room',
                owner: room?.createdBy || 'Unknown',
                occupantCount: members?.size || 0,
              };
            },
          });

          // Handle command result
          if (commandResult) {
            if (commandResult.type === 'system') {
              // Send system message only to the command sender
              sendMessage(ws, {
                type: 'message.new',
                roomId: clientMessage.roomId,
                agentId: '00000000-0000-0000-0000-000000000000',
                displayName: 'System',
                content: commandResult.message,
                signature: '',
                timestamp: new Date().toISOString(),
              });
            } else if (commandResult.type === 'action' || commandResult.type === 'broadcast') {
              // Broadcast action or broadcast messages to all room members
              broadcastToRoom(clientMessage.roomId, {
                type: 'message.new',
                roomId: clientMessage.roomId,
                agentId,
                displayName: `Agent ${agentId.slice(0, 8)}`,
                content: commandResult.message,
                signature: clientMessage.signature,
                timestamp: new Date().toISOString(),
              });
            }

            // Special handling for /roominfo to fetch actual data
            if (clientMessage.content.trim().toLowerCase().startsWith('/roominfo')) {
              try {
                const [room] = await sql`
                  SELECT name, created_by AS "createdBy" FROM rooms WHERE id = ${clientMessage.roomId}::uuid
                `;
                const members = roomMembers.get(clientMessage.roomId);
                const ownerName = room?.createdBy ? `Agent ${room.createdBy.slice(0, 8)}` : 'Unknown';
                const infoMessage = `Room: ${room?.name || 'Unknown'} | Owner: ${ownerName} | Occupants: ${members?.size || 0}`;
                
                sendMessage(ws, {
                  type: 'message.new',
                  roomId: clientMessage.roomId,
                  agentId: '00000000-0000-0000-0000-000000000000',
                  displayName: 'System',
                  content: infoMessage,
                  signature: '',
                  timestamp: new Date().toISOString(),
                });
              } catch (error) {
                console.error('[WS] Error fetching room info:', error);
              }
            }

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

          const timestamp = new Date().toISOString();

          broadcastToRoom(clientMessage.roomId, {
            type: 'message.new',
            roomId: clientMessage.roomId,
            agentId,
            displayName: `Agent ${agentId.slice(0, 8)}`,
            content: clientMessage.content,
            signature: clientMessage.signature,
            timestamp,
          });

          // Trigger room scripts: chat_keyword
          processTriggerEvent(
            {
              type: 'chat_keyword',
              roomId: clientMessage.roomId,
              agentId,
              data: { message: clientMessage.content },
            },
            sql
          ).then((actions) => {
            if (actions.length > 0) {
              executeScriptActions(actions, clientMessage.roomId).catch((err) => {
                console.error('[WIRED] Error executing chat_keyword actions:', err);
              });
            }
          }).catch((err) => {
            console.error('[WIRED] Error processing chat_keyword trigger:', err);
          });

          // Generate TTS audio for spectators (async, non-blocking)
          if (process.env.TTS_ENABLED !== 'false') {
            import('../services/tts.js').then(async ({ synthesizeSpeech, getVoiceForArchetype, sanitizeText }) => {
              try {
                // Fetch agent's personality archetype
                const agents = await sql`
                  SELECT 
                    a.id,
                    p.archetype
                  FROM agents a
                  LEFT JOIN agent_personality p ON a.id = p.agent_id
                  WHERE a.id = ${agentId}::uuid
                  LIMIT 1
                `;

                if (agents.length === 0) return;

                const archetype = agents[0].archetype as string | null;
                const voiceId = getVoiceForArchetype(archetype);

                // Synthesize speech
                const { cacheKey } = await synthesizeSpeech(clientMessage.content, voiceId, agentId);
                const audioUrl = `/api/tts/audio/${cacheKey}.aiff`;

                // Broadcast audio URL to spectators only
                const { broadcastToSpectators } = await import('../ws/spectator.js');
                broadcastToSpectators(clientMessage.roomId, {
                  type: 'message.audio',
                  roomId: clientMessage.roomId,
                  agentId,
                  audioUrl,
                  timestamp,
                });
              } catch (error) {
                // Silent fail on TTS errors (don't block chat)
                console.error('[TTS] Synthesis error:', error);
              }
            });
          }

          // Let bots respond to the message
          const { handleChatToBots } = await import('../services/botManager.js');
          handleChatToBots(clientMessage.roomId, clientMessage.content, sql).catch((err) => {
            console.error('[WS] Bot chat handler error:', err);
          });

          // Track personality: chat increases sociability
          trackAction(agentId, 'chat_message');

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

            // Track personality: furniture placement increases curiosity
            trackAction(agentId, 'furniture_placed');

            // Trigger room scripts: furniture_clicked (using placed item as interaction)
            processTriggerEvent(
              {
                type: 'furniture_clicked',
                roomId: clientMessage.roomId,
                agentId,
                data: { itemId: placedItem.id },
              },
              sql
            ).then((actions) => {
              if (actions.length > 0) {
                executeScriptActions(actions, clientMessage.roomId).catch((err) => {
                  console.error('[WIRED] Error executing furniture_clicked actions:', err);
                });
              }
            }).catch((err) => {
              console.error('[WIRED] Error processing furniture_clicked trigger:', err);
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

          // Track personality: emotes increase volatility and sociability
          trackAction(agentId, 'emote_used');
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

            // Track personality: completing trades increases generosity (both parties)
            trackAction(agentId, 'trade_completed');
            trackAction(otherAgentId, 'trade_completed');

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

            // Track personality: creating games increases competitiveness
            trackAction(agentId, 'game_played');

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
              // Track personality: winning increases competitiveness
              if (game.result.winnerId) {
                trackAction(game.result.winnerId, 'game_won');
              }

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

        case 'game.tictactoe.create': {
          try {
            const { createGame } = await import('../services/games.js');
            
            const game = createGame(clientMessage.roomId, 'tictactoe', agentId);

            // Get creator name
            const [creator] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            // Broadcast to room that a new game is available
            broadcastToRoom(clientMessage.roomId, {
              type: 'game.created',
              gameId: game.id,
              gameType: 'tictactoe',
              hostId: agentId,
              hostName: creator?.display_name || 'Agent',
              status: game.status,
            });
          } catch (error: any) {
            sendError(ws, 'GAME_CREATE_FAILED', error.message || 'Failed to create Tic-Tac-Toe game');
          }
          break;
        }

        case 'game.tictactoe.move': {
          try {
            const { makeMove, getGameState } = await import('../services/games.js');
            
            const game = makeMove(clientMessage.gameId, agentId, clientMessage.cell);

            // Notify all participants of the move
            for (const participantId of game.participants) {
              const participantWs = connections.get(participantId);
              if (participantWs && participantWs.readyState === WebSocket.OPEN) {
                sendMessage(participantWs, {
                  type: 'game.tictactoe.updated',
                  gameId: game.id,
                  board: game.board || [],
                  currentTurn: game.currentTurn,
                  status: game.status,
                });
              }
            }

            // If game completed, send result
            if (game.status === 'completed' && game.result) {
              // Track personality: winning increases competitiveness
              if (game.result.winnerId) {
                trackAction(game.result.winnerId, 'game_won');
              }

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
            sendError(ws, 'GAME_MOVE_FAILED', error.message || 'Failed to make Tic-Tac-Toe move');
          }
          break;
        }

        case 'game.connectfour.create': {
          try {
            const { createGame, joinGame } = await import('../services/connectFour.js');
            
            if (!clientMessage.opponentId) {
              sendError(ws, 'MISSING_OPPONENT', 'opponentId is required');
              break;
            }

            // Create game and immediately have opponent join
            const gameCreated = await createGame(agentId, sql);
            const game = await joinGame(gameCreated.id, clientMessage.opponentId, sql);

            // Get player names
            const [creator] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;
            const [opponent] = await sql`
              SELECT display_name FROM agents WHERE id = ${clientMessage.opponentId}
            `;

            // Notify both players
            for (const playerId of [game.player1Id, game.player2Id].filter(Boolean)) {
              const playerWs = connections.get(playerId as string);
              if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                sendMessage(playerWs, {
                  type: 'game.connectfour.created',
                  gameId: game.id.toString(),
                  player1: game.player1Id!,
                  player2: game.player2Id!,
                  player1Name: creator?.display_name || 'Agent',
                  player2Name: opponent?.display_name || 'Agent',
                  currentTurn: game.currentTurn || '',
                  board: game.board,
                  status: game.status,
                });
              }
            }

            // Broadcast to room
            broadcastToRoom(clientMessage.roomId, {
              type: 'game.created',
              gameId: game.id.toString(),
              gameType: 'connectfour',
              hostId: agentId,
              hostName: creator?.display_name || 'Agent',
              status: game.status,
            });
          } catch (error: any) {
            sendError(ws, 'GAME_CREATE_FAILED', error.message || 'Failed to create Connect Four game');
          }
          break;
        }

        case 'game.connectfour.drop': {
          try {
            const { dropPiece, getGame } = await import('../services/connectFour.js');
            
            const game = await dropPiece(clientMessage.gameId, agentId, clientMessage.column, sql);

            // Notify both players
            for (const playerId of [game.player1Id, game.player2Id].filter(Boolean)) {
              const playerWs = connections.get(playerId as string);
              if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                sendMessage(playerWs, {
                  type: 'game.connectfour.updated',
                  gameId: game.id.toString(),
                  board: game.board,
                  currentTurn: game.currentTurn || '',
                  status: game.status,
                  column: clientMessage.column,
                  playerId: agentId,
                });
              }
            }

            // If game completed, send result
            if (game.status === 'won' || game.status === 'draw') {
              // Track personality: winning increases competitiveness
              const isDraw = game.status === 'draw';
              if (game.winner && !isDraw) {
                trackAction(game.winner, 'game_won');
              }

              for (const playerId of [game.player1Id, game.player2Id].filter(Boolean)) {
                const playerWs = connections.get(playerId as string);
                if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                  sendMessage(playerWs, {
                    type: 'game.completed',
                    gameId: game.id.toString(),
                    winnerId: game.winner,
                    isDraw,
                    result: {
                      connectfour: {
                        board: game.board,
                        winnerId: game.winner,
                        isDraw,
                      },
                    },
                  });
                }
              }

              // Get roomId from somewhere - we need to track this
              // For now, skip broadcasting to room since we don't have roomId in game
            }
          } catch (error: any) {
            sendError(ws, 'GAME_MOVE_FAILED', error.message || 'Failed to drop disc');
          }
          break;
        }

        case 'game.blackjack.create': {
          try {
            const { newGame, calculateHandValue } = await import('../services/blackjack.js');
            
            const game = await newGame(agentId, 10, sql); // Default bet of 10 coins

            // Get creator name
            const [creator] = await sql`
              SELECT display_name FROM agents WHERE id = ${agentId}
            `;

            const playerValue = calculateHandValue(game.playerHand);
            const dealerValue = game.status === 'playing' ? 0 : calculateHandValue(game.dealerHand);

            // Send game state to player
            sendMessage(ws, {
              type: 'game.blackjack.created',
              gameId: game.id.toString(),
              playerHand: game.playerHand.map(c => `${c.rank}${c.suit[0]}`),
              dealerHand: game.status === 'playing' ? [game.dealerHand[0]].map(c => `${c.rank}${c.suit[0]}`) : game.dealerHand.map(c => `${c.rank}${c.suit[0]}`),
              playerValue,
              dealerValue,
              status: game.status,
            });

            // Broadcast to room
            broadcastToRoom(clientMessage.roomId, {
              type: 'game.created',
              gameId: game.id.toString(),
              gameType: 'blackjack',
              hostId: agentId,
              hostName: creator?.display_name || 'Agent',
              status: game.status,
            }, agentId);
          } catch (error: any) {
            sendError(ws, 'GAME_CREATE_FAILED', error.message || 'Failed to create Blackjack game');
          }
          break;
        }

        case 'game.blackjack.hit': {
          try {
            const { hit, calculateHandValue } = await import('../services/blackjack.js');
            
            const game = await hit(parseInt(clientMessage.gameId), sql);

            const playerValue = calculateHandValue(game.playerHand);
            const dealerValue = game.status === 'playing' ? 0 : calculateHandValue(game.dealerHand);

            // Send updated state to player
            sendMessage(ws, {
              type: 'game.blackjack.updated',
              gameId: game.id.toString(),
              playerHand: game.playerHand.map(c => `${c.rank}${c.suit[0]}`),
              dealerHand: game.status === 'playing' ? [game.dealerHand[0]].map(c => `${c.rank}${c.suit[0]}`) : game.dealerHand.map(c => `${c.rank}${c.suit[0]}`),
              playerValue,
              dealerValue,
              status: game.status,
            });

            // If game completed (bust), broadcast result
            if (game.status !== 'playing') {
              const winnerId = game.status === 'player_win' || game.status === 'dealer_bust' ? agentId : null;
              
              // Track personality: winning increases competitiveness
              if (winnerId) {
                trackAction(winnerId, 'game_won');
              }

              // Note: We don't have roomId in blackjack game, so we skip broadcast to room
            }
          } catch (error: any) {
            sendError(ws, 'GAME_HIT_FAILED', error.message || 'Failed to hit');
          }
          break;
        }

        case 'game.blackjack.stand': {
          try {
            const { stand, calculateHandValue } = await import('../services/blackjack.js');
            
            const game = await stand(parseInt(clientMessage.gameId), sql);

            const playerValue = calculateHandValue(game.playerHand);
            const dealerValue = calculateHandValue(game.dealerHand);

            // Send final state to player
            sendMessage(ws, {
              type: 'game.blackjack.updated',
              gameId: game.id.toString(),
              playerHand: game.playerHand.map(c => `${c.rank}${c.suit[0]}`),
              dealerHand: game.dealerHand.map(c => `${c.rank}${c.suit[0]}`),
              playerValue,
              dealerValue,
              status: game.status,
            });

            // Broadcast result to room
            const winnerId = game.status === 'player_win' || game.status === 'dealer_bust' 
              ? agentId 
              : game.status === 'dealer_win' || game.status === 'player_bust'
              ? null
              : null; // push

            // Track personality: winning increases competitiveness
            if (winnerId) {
              trackAction(winnerId, 'game_won');
            }

            // Note: We don't have roomId in blackjack game, so we skip broadcast to room
          } catch (error: any) {
            sendError(ws, 'GAME_STAND_FAILED', error.message || 'Failed to stand');
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

            // Track personality: adding friends increases sociability (both parties)
            trackAction(agentId, 'friend_added');
            trackAction(otherAgentId, 'friend_added');

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

        case 'bot.spawn': {
          try {
            // Check if agent is admin
            const [agent] = await sql`
              SELECT role FROM agents WHERE id = ${agentId}
            `;

            if (!agent || agent.role !== 'admin') {
              sendError(ws, 'BOT_SPAWN_FORBIDDEN', 'Admin privileges required');
              break;
            }

            const { spawnBot } = await import('../services/botManager.js');
            
            const bot = await spawnBot(
              clientMessage.roomId,
              {
                name: clientMessage.name,
                personality: clientMessage.personality,
              },
              sql
            );

            sendMessage(ws, {
              type: 'bot.spawned',
              botId: bot.id,
              roomId: bot.roomId,
              name: bot.name,
            });
          } catch (error: any) {
            sendError(ws, 'BOT_SPAWN_FAILED', error.message || 'Failed to spawn bot');
          }
          break;
        }

        case 'bot.despawn': {
          try {
            // Check if agent is admin
            const [agent] = await sql`
              SELECT role FROM agents WHERE id = ${agentId}
            `;

            if (!agent || agent.role !== 'admin') {
              sendError(ws, 'BOT_DESPAWN_FORBIDDEN', 'Admin privileges required');
              break;
            }

            const { despawnBot } = await import('../services/botManager.js');
            
            const success = await despawnBot(clientMessage.botId, sql);

            if (success) {
              sendMessage(ws, {
                type: 'bot.despawned',
                botId: clientMessage.botId,
              });
            } else {
              sendError(ws, 'BOT_NOT_FOUND', 'Bot not found');
            }
          } catch (error: any) {
            sendError(ws, 'BOT_DESPAWN_FAILED', error.message || 'Failed to despawn bot');
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
