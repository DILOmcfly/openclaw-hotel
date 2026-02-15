/**
 * Agent Status Service
 * Manages agent mood and status messages
 */

export type Mood =
  | 'happy'
  | 'sad'
  | 'excited'
  | 'busy'
  | 'away'
  | 'neutral'
  | 'angry'
  | 'sleepy'
  | 'creative'
  | 'social';

export type AgentStatus = {
  agentId: string;
  mood: Mood;
  statusText: string;
  isVisible: boolean;
  updatedAt: string;
};

const VALID_MOODS: Mood[] = [
  'happy',
  'sad',
  'excited',
  'busy',
  'away',
  'neutral',
  'angry',
  'sleepy',
  'creative',
  'social',
];

/**
 * Set agent mood
 */
export async function setMood(agentId: string, mood: Mood, sql: any): Promise<AgentStatus> {
  if (!VALID_MOODS.includes(mood)) {
    throw new Error(`Invalid mood. Must be one of: ${VALID_MOODS.join(', ')}`);
  }

  await sql`
    INSERT INTO agent_status ${sql({ agent_id: agentId, mood, updated_at: new Date().toISOString() })}
    ON CONFLICT (agent_id)
    DO UPDATE SET
      mood = EXCLUDED.mood,
      updated_at = EXCLUDED.updated_at
  `;

  return getStatus(agentId, sql);
}

/**
 * Set status text
 */
export async function setStatusText(
  agentId: string,
  text: string,
  sql: any
): Promise<AgentStatus> {
  if (text.length > 100) {
    throw new Error('Status text cannot exceed 100 characters');
  }

  await sql`
    INSERT INTO agent_status ${sql({ agent_id: agentId, status_text: text, updated_at: new Date().toISOString() })}
    ON CONFLICT (agent_id)
    DO UPDATE SET
      status_text = EXCLUDED.status_text,
      updated_at = EXCLUDED.updated_at
  `;

  return getStatus(agentId, sql);
}

/**
 * Get agent status
 */
export async function getStatus(agentId: string, sql: any): Promise<AgentStatus> {
  const rows = await sql`
    SELECT
      agent_id AS "agentId",
      mood,
      status_text AS "statusText",
      is_visible AS "isVisible",
      updated_at AS "updatedAt"
    FROM agent_status
    WHERE agent_id = ${agentId}
  `;

  if (rows.length === 0) {
    // Return default status
    return {
      agentId,
      mood: 'neutral',
      statusText: '',
      isVisible: true,
      updatedAt: new Date().toISOString(),
    };
  }

  return rows[0];
}

/**
 * Clear status (reset to defaults)
 */
export async function clearStatus(agentId: string, sql: any): Promise<AgentStatus> {
  await sql`
    INSERT INTO agent_status ${sql({
      agent_id: agentId,
      mood: 'neutral',
      status_text: '',
      is_visible: true,
      updated_at: new Date().toISOString(),
    })}
    ON CONFLICT (agent_id)
    DO UPDATE SET
      mood = 'neutral',
      status_text = '',
      is_visible = true,
      updated_at = EXCLUDED.updated_at
  `;

  return getStatus(agentId, sql);
}

/**
 * Toggle status visibility
 */
export async function toggleVisibility(
  agentId: string,
  isVisible: boolean,
  sql: any
): Promise<AgentStatus> {
  await sql`
    INSERT INTO agent_status ${sql({ agent_id: agentId, is_visible: isVisible, updated_at: new Date().toISOString() })}
    ON CONFLICT (agent_id)
    DO UPDATE SET
      is_visible = EXCLUDED.is_visible,
      updated_at = EXCLUDED.updated_at
  `;

  return getStatus(agentId, sql);
}

/**
 * Get statuses for multiple agents (bulk fetch)
 */
export async function getOnlineStatuses(
  agentIds: string[],
  sql: any
): Promise<AgentStatus[]> {
  if (agentIds.length === 0) {
    return [];
  }

  const rows = await sql`
    SELECT
      agent_id AS "agentId",
      mood,
      status_text AS "statusText",
      is_visible AS "isVisible",
      updated_at AS "updatedAt"
    FROM agent_status
    WHERE agent_id = ANY(${agentIds})
      AND is_visible = true
  `;

  return rows;
}
