/**
 * Agent Personality Engine
 * Agents develop unique behavioral traits based on actions over time
 */

export type Personality = {
  agentId: string;
  sociability: number;
  curiosity: number;
  competitiveness: number;
  generosity: number;
  volatility: number;
  lastUpdated: Date;
  totalActions: number;
  createdAt: Date;
};

export type PersonalityTrait = 
  | 'sociability' 
  | 'curiosity' 
  | 'competitiveness' 
  | 'generosity' 
  | 'volatility';

/**
 * Clamp value to [0, 100] range
 */
export function clampTrait(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Calculate decay: regress 10% toward 50 (neutral) per day
 */
export function calculateDecay(currentValue: number, daysSinceUpdate: number): number {
  if (daysSinceUpdate === 0) return currentValue;
  
  const DECAY_RATE = 0.1; // 10% per day
  let value = currentValue;
  
  for (let i = 0; i < daysSinceUpdate; i++) {
    const distanceFrom50 = value - 50;
    value -= distanceFrom50 * DECAY_RATE;
  }
  
  return clampTrait(Math.round(value));
}

/**
 * Get agent's personality profile
 */
export async function getPersonality(agentId: string, sql: any): Promise<Personality | null> {
  const result = await sql`
    SELECT 
      agent_id AS "agentId",
      sociability,
      curiosity,
      competitiveness,
      generosity,
      volatility,
      last_updated AS "lastUpdated",
      total_actions AS "totalActions",
      created_at AS "createdAt"
    FROM agent_personality
    WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) return null;
  return result[0];
}

/**
 * Update a single trait (with clamping to 0-100)
 */
export async function updateTrait(
  agentId: string, 
  trait: PersonalityTrait, 
  delta: number, 
  sql: any
): Promise<Personality> {
  // Ensure personality record exists
  await sql`
    INSERT INTO agent_personality (agent_id)
    VALUES (${agentId})
    ON CONFLICT (agent_id) DO NOTHING
  `;

  // Update trait with clamping
  const result = await sql`
    UPDATE agent_personality
    SET 
      ${sql(trait)} = GREATEST(0, LEAST(100, ${sql(trait)} + ${delta})),
      last_updated = NOW(),
      total_actions = total_actions + 1
    WHERE agent_id = ${agentId}
    RETURNING 
      agent_id AS "agentId",
      sociability,
      curiosity,
      competitiveness,
      generosity,
      volatility,
      last_updated AS "lastUpdated",
      total_actions AS "totalActions",
      created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Get personality-driven action recommendations
 */
export async function getRecommendedActions(agentId: string, sql: any): Promise<string[]> {
  const personality = await getPersonality(agentId, sql);
  if (!personality) return [];

  const recommendations: string[] = [];
  const { sociability, curiosity, competitiveness, generosity, volatility } = personality;

  // High trait recommendations
  if (sociability > 70) {
    recommendations.push('host_room_event', 'send_friend_requests', 'join_guild');
  }
  if (curiosity > 70) {
    recommendations.push('explore_new_rooms', 'try_new_furniture', 'read_descriptions');
  }
  if (competitiveness > 70) {
    recommendations.push('play_games', 'check_leaderboards', 'join_contest');
  }
  if (generosity > 70) {
    recommendations.push('send_gifts', 'help_newcomers', 'share_templates');
  }
  if (volatility > 70) {
    recommendations.push('change_mood', 'use_emotes', 'redecorate_room');
  }

  // Low trait recommendations (encourage balance)
  if (sociability < 30) {
    recommendations.push('try_chatting', 'make_friends');
  }
  if (curiosity < 30) {
    recommendations.push('visit_new_room', 'try_new_activity');
  }
  if (competitiveness < 30) {
    recommendations.push('join_a_game', 'set_a_goal');
  }
  if (generosity < 30) {
    recommendations.push('help_someone', 'give_a_gift');
  }

  return recommendations.slice(0, 5); // Max 5
}

/**
 * Get personalities for multiple agents (bulk operation)
 */
export async function bulkGetPersonalities(agentIds: string[], sql: any): Promise<Personality[]> {
  if (agentIds.length === 0) return [];

  const result = await sql`
    SELECT 
      agent_id AS "agentId",
      sociability,
      curiosity,
      competitiveness,
      generosity,
      volatility,
      last_updated AS "lastUpdated",
      total_actions AS "totalActions",
      created_at AS "createdAt"
    FROM agent_personality
    WHERE agent_id = ANY(${agentIds})
  `;

  return result;
}

/**
 * Action impact definitions
 */
export type ActionImpact = {
  trait: PersonalityTrait;
  delta: number;
};

/**
 * Calculate personality impacts for an action type
 */
export function calculateActionImpacts(actionType: string): ActionImpact[] {
  const impacts: ActionImpact[] = [];

  switch (actionType) {
    case 'room_explore':
      impacts.push({ trait: 'curiosity', delta: 1 });
      break;
    
    case 'chat_message':
      impacts.push({ trait: 'sociability', delta: 1 });
      break;
    
    case 'furniture_placed':
      impacts.push({ trait: 'curiosity', delta: 1 });
      break;
    
    case 'emote_used':
      impacts.push({ trait: 'volatility', delta: 1 });
      impacts.push({ trait: 'sociability', delta: 1 });
      break;
    
    case 'game_played':
      impacts.push({ trait: 'competitiveness', delta: 2 });
      break;
    
    case 'game_won':
      impacts.push({ trait: 'competitiveness', delta: 3 });
      break;
    
    case 'trade_completed':
      impacts.push({ trait: 'generosity', delta: 2 });
      break;
    
    case 'friend_added':
      impacts.push({ trait: 'sociability', delta: 2 });
      break;
    
    case 'room_created':
      impacts.push({ trait: 'curiosity', delta: 3 });
      break;
  }

  return impacts;
}

/**
 * Update multiple traits from an action
 */
export async function updateTraitFromAction(
  sql: any,
  agentId: string,
  impacts: ActionImpact[]
): Promise<void> {
  if (impacts.length === 0) return;

  // Ensure personality record exists
  await sql`
    INSERT INTO agent_personality (agent_id)
    VALUES (${agentId})
    ON CONFLICT (agent_id) DO NOTHING
  `;

  // Apply each impact
  for (const impact of impacts) {
    await updateTrait(agentId, impact.trait, impact.delta, sql);
  }
}

/**
 * Apply decay to all personalities
 * Called daily via cron job
 */
export async function applyDecayToAll(sql: any): Promise<number> {
  const result = await sql`
    UPDATE agent_personality
    SET 
      sociability = GREATEST(0, LEAST(100, 
        CASE 
          WHEN sociability > 50 THEN sociability - (sociability - 50) * 0.1
          WHEN sociability < 50 THEN sociability + (50 - sociability) * 0.1
          ELSE 50
        END
      )),
      curiosity = GREATEST(0, LEAST(100,
        CASE 
          WHEN curiosity > 50 THEN curiosity - (curiosity - 50) * 0.1
          WHEN curiosity < 50 THEN curiosity + (50 - curiosity) * 0.1
          ELSE 50
        END
      )),
      competitiveness = GREATEST(0, LEAST(100,
        CASE 
          WHEN competitiveness > 50 THEN competitiveness - (competitiveness - 50) * 0.1
          WHEN competitiveness < 50 THEN competitiveness + (50 - competitiveness) * 0.1
          ELSE 50
        END
      )),
      generosity = GREATEST(0, LEAST(100,
        CASE 
          WHEN generosity > 50 THEN generosity - (generosity - 50) * 0.1
          WHEN generosity < 50 THEN generosity + (50 - generosity) * 0.1
          ELSE 50
        END
      )),
      volatility = GREATEST(0, LEAST(100,
        CASE 
          WHEN volatility > 50 THEN volatility - (volatility - 50) * 0.1
          WHEN volatility < 50 THEN volatility + (50 - volatility) * 0.1
          ELSE 50
        END
      )),
      last_updated = NOW()
    WHERE 
      EXTRACT(EPOCH FROM (NOW() - last_updated)) > 86400
  `;

  return result.count || 0;
}

/**
 * Calculate archetype based on dominant traits
 */
export function calculateArchetype(personality: Personality): string {
  const { sociability, curiosity, competitiveness, generosity, volatility } = personality;

  // High single trait archetypes
  if (sociability > 75) return '🎭 The Social Butterfly';
  if (curiosity > 75) return '🔍 The Explorer';
  if (competitiveness > 75) return '🏆 The Champion';
  if (generosity > 75) return '💝 The Philanthropist';
  if (volatility > 75) return '🎨 The Wild Card';

  // Combined archetypes (2+ high traits)
  if (sociability > 65 && generosity > 65) return '🤝 The Community Builder';
  if (curiosity > 65 && competitiveness > 65) return '🧪 The Innovator';
  if (sociability > 65 && volatility > 65) return '🎪 The Entertainer';
  if (curiosity > 65 && generosity > 65) return '🌱 The Mentor';
  if (competitiveness > 65 && volatility > 65) return '⚡ The Maverick';

  // Low trait archetypes
  if (sociability < 30) return '🧊 The Lone Wolf';
  if (curiosity < 30 && competitiveness < 30) return '😴 The Chill One';
  if (generosity < 30 && competitiveness > 60) return '💼 The Pragmatist';

  // Balanced (all traits 40-60)
  const allBalanced = [sociability, curiosity, competitiveness, generosity, volatility]
    .every(t => t >= 40 && t <= 60);
  if (allBalanced) return '⚖️ The Balanced';

  // Default fallback
  return '🌟 The Unique';
}
