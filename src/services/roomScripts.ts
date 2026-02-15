/**
 * Room Scripts Service - Trigger-based automation for rooms
 */

export type TriggerType = 'agent_enters' | 'furniture_clicked' | 'timer_elapsed' | 'chat_keyword';
export type ActionType = 'teleport_agent' | 'give_item' | 'show_message' | 'toggle_furniture' | 'change_room_setting';

export type RoomScript = {
  id: number;
  roomId: number;
  name: string;
  triggerType: TriggerType;
  triggerData: Record<string, any>;
  actionType: ActionType;
  actionData: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
};

const MAX_SCRIPTS_PER_ROOM = 20;

/**
 * Create a new script for a room
 */
export async function createScript(
  roomId: number,
  ownerId: string,
  name: string,
  triggerType: TriggerType,
  triggerData: Record<string, any>,
  actionType: ActionType,
  actionData: Record<string, any>,
  sql: any
): Promise<RoomScript> {
  // Verify room ownership
  const room = await sql`
    SELECT owner_id FROM rooms WHERE id = ${roomId}
  `;
  
  if (room.length === 0) {
    throw new Error('Room not found');
  }
  
  if (room[0].owner_id !== ownerId) {
    throw new Error('Only room owner can create scripts');
  }

  // Check script limit
  const count = await sql`
    SELECT COUNT(*) as count FROM room_scripts WHERE room_id = ${roomId}
  `;
  
  if (parseInt(count[0].count) >= MAX_SCRIPTS_PER_ROOM) {
    throw new Error(`Maximum ${MAX_SCRIPTS_PER_ROOM} scripts per room`);
  }

  const result = await sql`
    INSERT INTO room_scripts (room_id, name, trigger_type, trigger_data, action_type, action_data)
    VALUES (${roomId}, ${name}, ${triggerType}, ${sql.json(triggerData)}, ${actionType}, ${sql.json(actionData)})
    RETURNING 
      id,
      room_id AS "roomId",
      name,
      trigger_type AS "triggerType",
      trigger_data AS "triggerData",
      action_type AS "actionType",
      action_data AS "actionData",
      enabled,
      created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Get all scripts for a room
 */
export async function getScripts(roomId: number, sql: any): Promise<RoomScript[]> {
  const result = await sql`
    SELECT 
      id,
      room_id AS "roomId",
      name,
      trigger_type AS "triggerType",
      trigger_data AS "triggerData",
      action_type AS "actionType",
      action_data AS "actionData",
      enabled,
      created_at AS "createdAt"
    FROM room_scripts
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
  `;

  return result;
}

/**
 * Update a script (owner only)
 */
export async function updateScript(
  scriptId: number,
  ownerId: string,
  updates: Partial<Pick<RoomScript, 'name' | 'triggerType' | 'triggerData' | 'actionType' | 'actionData'>>,
  sql: any
): Promise<RoomScript> {
  // Verify ownership
  const script = await sql`
    SELECT rs.*, r.owner_id
    FROM room_scripts rs
    JOIN rooms r ON rs.room_id = r.id
    WHERE rs.id = ${scriptId}
  `;

  if (script.length === 0) {
    throw new Error('Script not found');
  }

  if (script[0].owner_id !== ownerId) {
    throw new Error('Only room owner can update scripts');
  }

  const setClauses = [];
  const values: any = {};

  if (updates.name !== undefined) {
    setClauses.push('name = ${name}');
    values.name = updates.name;
  }
  if (updates.triggerType !== undefined) {
    setClauses.push('trigger_type = ${triggerType}');
    values.triggerType = updates.triggerType;
  }
  if (updates.triggerData !== undefined) {
    setClauses.push('trigger_data = ${triggerData}');
    values.triggerData = sql.json(updates.triggerData);
  }
  if (updates.actionType !== undefined) {
    setClauses.push('action_type = ${actionType}');
    values.actionType = updates.actionType;
  }
  if (updates.actionData !== undefined) {
    setClauses.push('action_data = ${actionData}');
    values.actionData = sql.json(updates.actionData);
  }

  if (setClauses.length === 0) {
    return script[0];
  }

  const result = await sql`
    UPDATE room_scripts
    SET 
      name = ${updates.name ?? script[0].name},
      trigger_type = ${updates.triggerType ?? script[0].trigger_type},
      trigger_data = ${updates.triggerData ? sql.json(updates.triggerData) : script[0].trigger_data},
      action_type = ${updates.actionType ?? script[0].action_type},
      action_data = ${updates.actionData ? sql.json(updates.actionData) : script[0].action_data}
    WHERE id = ${scriptId}
    RETURNING 
      id,
      room_id AS "roomId",
      name,
      trigger_type AS "triggerType",
      trigger_data AS "triggerData",
      action_type AS "actionType",
      action_data AS "actionData",
      enabled,
      created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Delete a script (owner only)
 */
export async function deleteScript(scriptId: number, ownerId: string, sql: any): Promise<void> {
  const script = await sql`
    SELECT rs.*, r.owner_id
    FROM room_scripts rs
    JOIN rooms r ON rs.room_id = r.id
    WHERE rs.id = ${scriptId}
  `;

  if (script.length === 0) {
    throw new Error('Script not found');
  }

  if (script[0].owner_id !== ownerId) {
    throw new Error('Only room owner can delete scripts');
  }

  await sql`DELETE FROM room_scripts WHERE id = ${scriptId}`;
}

/**
 * Toggle script enabled state (owner only)
 */
export async function toggleScript(scriptId: number, ownerId: string, sql: any): Promise<RoomScript> {
  const script = await sql`
    SELECT rs.*, r.owner_id
    FROM room_scripts rs
    JOIN rooms r ON rs.room_id = r.id
    WHERE rs.id = ${scriptId}
  `;

  if (script.length === 0) {
    throw new Error('Script not found');
  }

  if (script[0].owner_id !== ownerId) {
    throw new Error('Only room owner can toggle scripts');
  }

  const result = await sql`
    UPDATE room_scripts
    SET enabled = NOT enabled
    WHERE id = ${scriptId}
    RETURNING 
      id,
      room_id AS "roomId",
      name,
      trigger_type AS "triggerType",
      trigger_data AS "triggerData",
      action_type AS "actionType",
      action_data AS "actionData",
      enabled,
      created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Evaluate trigger and find matching enabled scripts
 */
export async function evaluateTrigger(
  roomId: number,
  triggerType: TriggerType,
  eventData: Record<string, any>,
  sql: any
): Promise<RoomScript[]> {
  const scripts = await sql`
    SELECT 
      id,
      room_id AS "roomId",
      name,
      trigger_type AS "triggerType",
      trigger_data AS "triggerData",
      action_type AS "actionType",
      action_data AS "actionData",
      enabled,
      created_at AS "createdAt"
    FROM room_scripts
    WHERE room_id = ${roomId}
      AND trigger_type = ${triggerType}
      AND enabled = true
  `;

  // Filter by trigger-specific matching logic
  return scripts.filter((script: RoomScript) => {
    switch (triggerType) {
      case 'chat_keyword':
        const keyword = script.triggerData.keyword?.toLowerCase();
        const message = eventData.message?.toLowerCase();
        return keyword && message && message.includes(keyword);
      
      case 'furniture_clicked':
        return script.triggerData.furnitureId === eventData.furnitureId;
      
      case 'timer_elapsed':
        return script.triggerData.interval === eventData.interval;
      
      case 'agent_enters':
        // No additional filtering needed
        return true;
      
      default:
        return false;
    }
  });
}

/**
 * Execute action and return payload (no side effects)
 */
export function executeAction(actionType: ActionType, actionData: Record<string, any>): Record<string, any> {
  switch (actionType) {
    case 'teleport_agent':
      return {
        type: 'teleport',
        targetRoomId: actionData.targetRoomId,
        x: actionData.x ?? 0,
        y: actionData.y ?? 0,
      };
    
    case 'give_item':
      return {
        type: 'give_item',
        itemId: actionData.itemId,
        quantity: actionData.quantity ?? 1,
      };
    
    case 'show_message':
      return {
        type: 'message',
        text: actionData.text ?? '',
        style: actionData.style ?? 'normal',
      };
    
    case 'toggle_furniture':
      return {
        type: 'toggle_furniture',
        furnitureId: actionData.furnitureId,
        state: actionData.state,
      };
    
    case 'change_room_setting':
      return {
        type: 'room_setting',
        setting: actionData.setting,
        value: actionData.value,
      };
    
    default:
      return { type: 'unknown' };
  }
}
