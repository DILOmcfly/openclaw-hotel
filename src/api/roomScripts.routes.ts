import { Router } from 'express';
import {
  createRoomScript,
  getRoomScripts,
  getScript,
  updateRoomScript,
  deleteRoomScript,
  type TriggerType,
  type ActionType,
} from '../services/scriptEngine.js';
import { sql } from '../db/index.js';

const router = Router();

/**
 * Middleware to check if agent owns the room
 */
async function checkRoomOwnership(
  agentId: string,
  roomId: string
): Promise<boolean> {
  const rooms = await sql`
    SELECT owner_id
    FROM rooms
    WHERE id = ${roomId}
    LIMIT 1
  `;

  if (rooms.length === 0) {
    return false;
  }

  return rooms[0].owner_id === agentId;
}

/**
 * GET /api/rooms/:roomId/scripts
 * Get all scripts for a room
 */
router.get('/api/rooms/:roomId/scripts', async (req, res) => {
  const agentId = (req as any).agentId;
  const { roomId } = req.params;

  if (!agentId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // Check if agent owns the room
    const isOwner = await checkRoomOwnership(agentId, roomId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only room owner can view scripts' });
      return;
    }

    const scripts = await getRoomScripts(roomId, sql);
    res.status(200).json(scripts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch scripts';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/rooms/:roomId/scripts
 * Create a new script for a room
 */
router.post('/api/rooms/:roomId/scripts', async (req, res) => {
  const agentId = (req as any).agentId;
  const { roomId } = req.params;
  const { triggerType, triggerData, actionType, actionData } = req.body;

  if (!agentId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Validate input
  if (!triggerType || !actionType) {
    res.status(400).json({ error: 'triggerType and actionType are required' });
    return;
  }

  const validTriggerTypes: TriggerType[] = ['agent_enters', 'furniture_clicked', 'timer_elapsed', 'chat_keyword'];
  const validActionTypes: ActionType[] = ['teleport_agent', 'show_message', 'toggle_furniture', 'give_coins'];

  if (!validTriggerTypes.includes(triggerType)) {
    res.status(400).json({ error: `Invalid triggerType. Must be one of: ${validTriggerTypes.join(', ')}` });
    return;
  }

  if (!validActionTypes.includes(actionType)) {
    res.status(400).json({ error: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}` });
    return;
  }

  try {
    // Check if agent owns the room
    const isOwner = await checkRoomOwnership(agentId, roomId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only room owner can create scripts' });
      return;
    }

    const result = await createRoomScript(
      roomId,
      triggerType,
      triggerData || {},
      actionType,
      actionData || {},
      sql
    );

    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create script';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /api/rooms/:roomId/scripts/:scriptId
 * Update a script
 */
router.put('/api/rooms/:roomId/scripts/:scriptId', async (req, res) => {
  const agentId = (req as any).agentId;
  const { roomId, scriptId } = req.params;
  const { triggerType, triggerData, actionType, actionData, enabled } = req.body;

  if (!agentId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // Check if agent owns the room
    const isOwner = await checkRoomOwnership(agentId, roomId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only room owner can update scripts' });
      return;
    }

    // Verify script belongs to this room
    const script = await getScript(scriptId, sql);
    if (!script) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }

    if (script.room_id !== roomId) {
      res.status(403).json({ error: 'Script does not belong to this room' });
      return;
    }

    await updateRoomScript(
      scriptId,
      {
        triggerType,
        triggerData,
        actionType,
        actionData,
        enabled,
      },
      sql
    );

    res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update script';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /api/rooms/:roomId/scripts/:scriptId
 * Delete a script
 */
router.delete('/api/rooms/:roomId/scripts/:scriptId', async (req, res) => {
  const agentId = (req as any).agentId;
  const { roomId, scriptId } = req.params;

  if (!agentId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // Check if agent owns the room
    const isOwner = await checkRoomOwnership(agentId, roomId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only room owner can delete scripts' });
      return;
    }

    // Verify script belongs to this room
    const script = await getScript(scriptId, sql);
    if (!script) {
      res.status(404).json({ error: 'Script not found' });
      return;
    }

    if (script.room_id !== roomId) {
      res.status(403).json({ error: 'Script does not belong to this room' });
      return;
    }

    await deleteRoomScript(scriptId, sql);

    res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete script';
    res.status(500).json({ error: message });
  }
});

export default router;
