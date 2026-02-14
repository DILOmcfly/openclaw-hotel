/**
 * Appearance Service - Manages agent avatar customization (skin color, outfits, accessories)
 */

export type Appearance = {
  agentId: string;
  skinColor: string;
  outfit: string;
  accessory: string;
};

export const VALID_OUTFITS = ['default', 'casual', 'formal', 'sporty', 'punk'] as const;
export const VALID_ACCESSORIES = ['none', 'hat', 'glasses', 'scarf', 'crown'] as const;

export type Outfit = typeof VALID_OUTFITS[number];
export type Accessory = typeof VALID_ACCESSORIES[number];

/**
 * Validate hex color format (#RRGGBB)
 */
export function validateColor(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Get agent's appearance (creates default if doesn't exist)
 */
export async function getAppearance(agentId: string, sql: any): Promise<Appearance> {
  const result = await sql`
    SELECT agent_id AS "agentId", skin_color AS "skinColor", outfit, accessory
    FROM agent_appearance
    WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    // Create default appearance
    return await createDefaultAppearance(agentId, sql);
  }

  return result[0];
}

/**
 * Update agent's appearance (partial updates allowed)
 */
export async function updateAppearance(
  agentId: string,
  updates: { skinColor?: string; outfit?: string; accessory?: string },
  sql: any
): Promise<Appearance> {
  // Validate inputs
  if (updates.skinColor && !validateColor(updates.skinColor)) {
    throw new Error('Invalid skin color format. Must be hex color (#RRGGBB)');
  }

  if (updates.outfit && !VALID_OUTFITS.includes(updates.outfit as Outfit)) {
    throw new Error(`Invalid outfit. Must be one of: ${VALID_OUTFITS.join(', ')}`);
  }

  if (updates.accessory && !VALID_ACCESSORIES.includes(updates.accessory as Accessory)) {
    throw new Error(`Invalid accessory. Must be one of: ${VALID_ACCESSORIES.join(', ')}`);
  }

  // Ensure appearance record exists
  await getAppearance(agentId, sql);

  // Build update query dynamically
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.skinColor !== undefined) {
    setClauses.push('skin_color = $' + (values.length + 1));
    values.push(updates.skinColor);
  }

  if (updates.outfit !== undefined) {
    setClauses.push('outfit = $' + (values.length + 1));
    values.push(updates.outfit);
  }

  if (updates.accessory !== undefined) {
    setClauses.push('accessory = $' + (values.length + 1));
    values.push(updates.accessory);
  }

  setClauses.push('updated_at = NOW()');
  values.push(agentId);

  const query = `
    UPDATE agent_appearance
    SET ${setClauses.join(', ')}
    WHERE agent_id = $${values.length}
    RETURNING agent_id AS "agentId", skin_color AS "skinColor", outfit, accessory
  `;

  const result = await sql.unsafe(query, values);
  return result[0];
}

/**
 * Create default appearance for new agent
 */
async function createDefaultAppearance(agentId: string, sql: any): Promise<Appearance> {
  const inserted = await sql`
    INSERT INTO agent_appearance (agent_id, skin_color, outfit, accessory)
    VALUES (${agentId}, '#FFD93D', 'default', 'none')
    ON CONFLICT (agent_id) DO NOTHING
    RETURNING agent_id AS "agentId", skin_color AS "skinColor", outfit, accessory
  `;

  if (inserted.length === 0) {
    // Already exists, fetch it
    return await getAppearance(agentId, sql);
  }

  return inserted[0];
}
