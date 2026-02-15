import { randomUUID } from 'node:crypto';

export type TriggerType = 'agent_enters' | 'furniture_clicked' | 'timer_elapsed' | 'chat_keyword';
export type ActionType = 'teleport_agent' | 'show_message' | 'toggle_furniture' | 'give_coins';

export type RoomScript = {
  id: string;
  room_id: string;
  trigger_type: TriggerType;
  trigger_data: Record<string, any>;
  action_type: ActionType;
  action_data: Record<string, any>;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type TriggerEvent = {
  type: TriggerType;
  roomId: string;
  agentId?: string;
  data: Record<string, any>;
};

export type ScriptAction = {
  type: ActionType;
  data: Record<string, any>;
  targetAgentId?: string;
};

// Rate limiting: track last execution time per script
const scriptExecutionTimes = new Map<string, number>();
const RATE_LIMIT_MS = 5000; // 5 seconds
const MAX_COINS_PER_ACTION = 100;
const MAX_SCRIPTS_PER_ROOM = 20;

/**
 * Create a new room script
 */
export async function createRoomScript(
  roomId: string,
  triggerType: TriggerType,
  triggerData: Record<string, any>,
  actionType: ActionType,
  actionData: Record<string, any>,
  sql: any
): Promise<{ id: string }> {
  // Check max scripts per room
  const existing = await sql`
    SELECT COUNT(*)::int as count
    FROM room_scripts
    WHERE room_id = ${roomId}
  `;

  if (existing[0]?.count >= MAX_SCRIPTS_PER_ROOM) {
    throw new Error(`Room cannot have more than ${MAX_SCRIPTS_PER_ROOM} scripts`);
  }

  // Validate trigger data
  validateTriggerData(triggerType, triggerData);

  // Validate action data
  validateActionData(actionType, actionData);

  const id = randomUUID();

  await sql`
    INSERT INTO room_scripts (id, room_id, trigger_type, trigger_data, action_type, action_data)
    VALUES (
      ${id},
      ${roomId},
      ${triggerType},
      ${JSON.stringify(triggerData)}::jsonb,
      ${actionType},
      ${JSON.stringify(actionData)}::jsonb
    )
  `;

  return { id };
}

/**
 * Get all scripts for a room
 */
export async function getRoomScripts(
  roomId: string,
  sql: any
): Promise<RoomScript[]> {
  const rows = await sql`
    SELECT id, room_id, trigger_type, trigger_data, action_type, action_data, enabled, created_at, updated_at
    FROM room_scripts
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
  `;

  return rows.map((row: any) => ({
    id: row.id,
    room_id: row.room_id,
    trigger_type: row.trigger_type,
    trigger_data: row.trigger_data,
    action_type: row.action_type,
    action_data: row.action_data,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get a single script by ID
 */
export async function getScript(
  scriptId: string,
  sql: any
): Promise<RoomScript | null> {
  const rows = await sql`
    SELECT id, room_id, trigger_type, trigger_data, action_type, action_data, enabled, created_at, updated_at
    FROM room_scripts
    WHERE id = ${scriptId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    room_id: row.room_id,
    trigger_type: row.trigger_type,
    trigger_data: row.trigger_data,
    action_type: row.action_type,
    action_data: row.action_data,
    enabled: row.enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Update a room script
 */
export async function updateRoomScript(
  scriptId: string,
  updates: {
    triggerType?: TriggerType;
    triggerData?: Record<string, any>;
    actionType?: ActionType;
    actionData?: Record<string, any>;
    enabled?: boolean;
  },
  sql: any
): Promise<void> {
  const script = await getScript(scriptId, sql);
  if (!script) {
    throw new Error('Script not found');
  }

  const triggerType = updates.triggerType ?? script.trigger_type;
  const triggerData = updates.triggerData ?? script.trigger_data;
  const actionType = updates.actionType ?? script.action_type;
  const actionData = updates.actionData ?? script.action_data;

  // Validate if changed
  if (updates.triggerType || updates.triggerData) {
    validateTriggerData(triggerType, triggerData);
  }

  if (updates.actionType || updates.actionData) {
    validateActionData(actionType, actionData);
  }

  await sql`
    UPDATE room_scripts
    SET
      trigger_type = ${triggerType},
      trigger_data = ${JSON.stringify(triggerData)}::jsonb,
      action_type = ${actionType},
      action_data = ${JSON.stringify(actionData)}::jsonb,
      enabled = ${updates.enabled ?? script.enabled},
      updated_at = NOW()
    WHERE id = ${scriptId}
  `;
}

/**
 * Delete a room script
 */
export async function deleteRoomScript(
  scriptId: string,
  sql: any
): Promise<void> {
  await sql`
    DELETE FROM room_scripts
    WHERE id = ${scriptId}
  `;
}

/**
 * Validate trigger data based on trigger type
 */
function validateTriggerData(triggerType: TriggerType, data: Record<string, any>): void {
  switch (triggerType) {
    case 'agent_enters':
      // No specific data required
      break;

    case 'furniture_clicked':
      if (!data.itemId || typeof data.itemId !== 'string') {
        throw new Error('furniture_clicked requires itemId (string)');
      }
      break;

    case 'timer_elapsed':
      if (typeof data.seconds !== 'number' || data.seconds <= 0) {
        throw new Error('timer_elapsed requires seconds (positive number)');
      }
      break;

    case 'chat_keyword':
      if (!data.keyword || typeof data.keyword !== 'string') {
        throw new Error('chat_keyword requires keyword (string or regex pattern)');
      }
      // Validate regex if it looks like a regex pattern
      if (data.keyword.startsWith('/') && data.keyword.endsWith('/')) {
        try {
          new RegExp(data.keyword.slice(1, -1));
        } catch {
          throw new Error('Invalid regex pattern in chat_keyword');
        }
      }
      break;

    default:
      throw new Error(`Unknown trigger type: ${triggerType}`);
  }
}

/**
 * Validate action data based on action type
 */
function validateActionData(actionType: ActionType, data: Record<string, any>): void {
  switch (actionType) {
    case 'teleport_agent':
      if (typeof data.x !== 'number' || typeof data.y !== 'number') {
        throw new Error('teleport_agent requires x and y (numbers)');
      }
      if (data.x < 0 || data.y < 0) {
        throw new Error('teleport_agent coordinates must be non-negative');
      }
      break;

    case 'show_message':
      if (!data.text || typeof data.text !== 'string') {
        throw new Error('show_message requires text (string)');
      }
      if (data.text.length > 500) {
        throw new Error('show_message text cannot exceed 500 characters');
      }
      break;

    case 'toggle_furniture':
      if (!data.itemId || typeof data.itemId !== 'string') {
        throw new Error('toggle_furniture requires itemId (string)');
      }
      if (typeof data.state !== 'boolean') {
        throw new Error('toggle_furniture requires state (boolean)');
      }
      break;

    case 'give_coins':
      if (typeof data.amount !== 'number' || data.amount <= 0) {
        throw new Error('give_coins requires amount (positive number)');
      }
      if (data.amount > MAX_COINS_PER_ACTION) {
        throw new Error(`give_coins amount cannot exceed ${MAX_COINS_PER_ACTION}`);
      }
      break;

    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

/**
 * Evaluate if a trigger matches the event
 */
export function evaluateTrigger(script: RoomScript, event: TriggerEvent): boolean {
  if (script.trigger_type !== event.type) {
    return false;
  }

  switch (event.type) {
    case 'agent_enters':
      // Always match
      return true;

    case 'furniture_clicked':
      return script.trigger_data.itemId === event.data.itemId;

    case 'timer_elapsed':
      // Timer matching would be handled externally
      return true;

    case 'chat_keyword':
      const keyword = script.trigger_data.keyword;
      const message = event.data.message;

      if (!message || typeof message !== 'string') {
        return false;
      }

      // Check if it's a regex pattern
      if (keyword.startsWith('/') && keyword.endsWith('/')) {
        try {
          const regex = new RegExp(keyword.slice(1, -1), 'i');
          return regex.test(message);
        } catch {
          return false;
        }
      }

      // Simple case-insensitive keyword match
      return message.toLowerCase().includes(keyword.toLowerCase());

    default:
      return false;
  }
}

/**
 * Check if script can execute (rate limiting)
 */
function canExecuteScript(scriptId: string): boolean {
  const lastExecution = scriptExecutionTimes.get(scriptId);
  if (!lastExecution) {
    return true;
  }

  const timeSinceLastExecution = Date.now() - lastExecution;
  return timeSinceLastExecution >= RATE_LIMIT_MS;
}

/**
 * Mark script as executed
 */
function markScriptExecuted(scriptId: string): void {
  scriptExecutionTimes.set(scriptId, Date.now());
}

/**
 * Process a trigger event and return actions to execute
 */
export async function processTriggerEvent(
  event: TriggerEvent,
  sql: any
): Promise<ScriptAction[]> {
  // Get all enabled scripts for this room
  const scripts = await getRoomScripts(event.roomId, sql);
  const enabledScripts = scripts.filter(s => s.enabled);

  const actions: ScriptAction[] = [];

  for (const script of enabledScripts) {
    // Check if trigger matches
    if (!evaluateTrigger(script, event)) {
      continue;
    }

    // Check rate limiting
    if (!canExecuteScript(script.id)) {
      continue;
    }

    // Mark as executed (rate limit)
    markScriptExecuted(script.id);

    // Build action
    const action: ScriptAction = {
      type: script.action_type,
      data: script.action_data,
      targetAgentId: event.agentId,
    };

    actions.push(action);
  }

  return actions;
}

/**
 * Execute a script action (to be called by the WebSocket handler)
 * Returns execution result or error
 */
export async function executeScriptAction(
  action: ScriptAction,
  roomId: string,
  sql: any,
  executeCallback: (action: ScriptAction) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Additional safety checks
    if (action.type === 'give_coins') {
      if (action.data.amount > MAX_COINS_PER_ACTION) {
        return {
          success: false,
          error: `Cannot give more than ${MAX_COINS_PER_ACTION} coins`,
        };
      }
    }

    // Execute via callback (WebSocket handler will implement the actual logic)
    await executeCallback(action);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
