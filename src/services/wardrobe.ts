/**
 * Wardrobe Service - Manages agent outfit presets
 */

export type Outfit = {
  id: number;
  agentId: string;
  name: string;
  head: string | null;
  body: string | null;
  legs: string | null;
  shoes: string | null;
  accessory: string | null;
  colorPrimary: string;
  colorSecondary: string;
  isActive: boolean;
  createdAt: Date;
};

const MAX_OUTFITS_PER_AGENT = 10;
const COPY_OUTFIT_COST = 25;

/**
 * Create a new outfit preset
 */
export async function createOutfit(
  agentId: string,
  name: string,
  outfit: Partial<Outfit>,
  sql: any
): Promise<Outfit> {
  // Check outfit limit
  const count = await sql`
    SELECT COUNT(*) as count FROM agent_outfits WHERE agent_id = ${agentId}
  `;
  if (count[0].count >= MAX_OUTFITS_PER_AGENT) {
    throw new Error(`Maximum ${MAX_OUTFITS_PER_AGENT} outfits per agent`);
  }

  const result = await sql`
    INSERT INTO agent_outfits (
      agent_id, name, head, body, legs, shoes, accessory, 
      color_primary, color_secondary, is_active
    )
    VALUES (
      ${agentId}, ${name}, ${outfit.head || null}, ${outfit.body || null},
      ${outfit.legs || null}, ${outfit.shoes || null}, ${outfit.accessory || null},
      ${outfit.colorPrimary || '#ffffff'}, ${outfit.colorSecondary || '#000000'},
      ${outfit.isActive || false}
    )
    RETURNING 
      id, agent_id AS "agentId", name, head, body, legs, shoes, accessory,
      color_primary AS "colorPrimary", color_secondary AS "colorSecondary",
      is_active AS "isActive", created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Get all outfits for an agent
 */
export async function getOutfits(agentId: string, sql: any): Promise<Outfit[]> {
  return await sql`
    SELECT 
      id, agent_id AS "agentId", name, head, body, legs, shoes, accessory,
      color_primary AS "colorPrimary", color_secondary AS "colorSecondary",
      is_active AS "isActive", created_at AS "createdAt"
    FROM agent_outfits
    WHERE agent_id = ${agentId}
    ORDER BY created_at DESC
  `;
}

/**
 * Get active outfit for an agent
 */
export async function getActiveOutfit(agentId: string, sql: any): Promise<Outfit | null> {
  const result = await sql`
    SELECT 
      id, agent_id AS "agentId", name, head, body, legs, shoes, accessory,
      color_primary AS "colorPrimary", color_secondary AS "colorSecondary",
      is_active AS "isActive", created_at AS "createdAt"
    FROM agent_outfits
    WHERE agent_id = ${agentId} AND is_active = true
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

/**
 * Activate an outfit (deactivate others)
 */
export async function activateOutfit(
  agentId: string,
  outfitId: number,
  sql: any
): Promise<Outfit> {
  // Verify ownership
  const outfit = await sql`
    SELECT agent_id AS "agentId" FROM agent_outfits WHERE id = ${outfitId}
  `;
  if (outfit.length === 0) throw new Error('Outfit not found');
  if (outfit[0].agentId !== agentId) throw new Error('Not authorized');

  // Deactivate all, then activate target
  await sql`UPDATE agent_outfits SET is_active = false WHERE agent_id = ${agentId}`;

  const result = await sql`
    UPDATE agent_outfits
    SET is_active = true
    WHERE id = ${outfitId}
    RETURNING 
      id, agent_id AS "agentId", name, head, body, legs, shoes, accessory,
      color_primary AS "colorPrimary", color_secondary AS "colorSecondary",
      is_active AS "isActive", created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Update an outfit
 */
export async function updateOutfit(
  agentId: string,
  outfitId: number,
  updates: Partial<Outfit>,
  sql: any
): Promise<Outfit> {
  // Verify ownership
  const outfit = await sql`
    SELECT agent_id AS "agentId" FROM agent_outfits WHERE id = ${outfitId}
  `;
  if (outfit.length === 0) throw new Error('Outfit not found');
  if (outfit[0].agentId !== agentId) throw new Error('Not authorized');

  const result = await sql`
    UPDATE agent_outfits
    SET 
      name = COALESCE(${updates.name}, name),
      head = COALESCE(${updates.head}, head),
      body = COALESCE(${updates.body}, body),
      legs = COALESCE(${updates.legs}, legs),
      shoes = COALESCE(${updates.shoes}, shoes),
      accessory = COALESCE(${updates.accessory}, accessory),
      color_primary = COALESCE(${updates.colorPrimary}, color_primary),
      color_secondary = COALESCE(${updates.colorSecondary}, color_secondary)
    WHERE id = ${outfitId}
    RETURNING 
      id, agent_id AS "agentId", name, head, body, legs, shoes, accessory,
      color_primary AS "colorPrimary", color_secondary AS "colorSecondary",
      is_active AS "isActive", created_at AS "createdAt"
  `;

  return result[0];
}

/**
 * Delete an outfit
 */
export async function deleteOutfit(agentId: string, outfitId: number, sql: any): Promise<void> {
  // Verify ownership
  const outfit = await sql`
    SELECT agent_id AS "agentId", is_active AS "isActive" 
    FROM agent_outfits 
    WHERE id = ${outfitId}
  `;
  if (outfit.length === 0) throw new Error('Outfit not found');
  if (outfit[0].agentId !== agentId) throw new Error('Not authorized');
  if (outfit[0].isActive) throw new Error('Cannot delete active outfit');

  await sql`DELETE FROM agent_outfits WHERE id = ${outfitId}`;
}

/**
 * Copy an outfit from another agent
 */
export async function copyOutfit(
  targetAgentId: string,
  sourceAgentId: string,
  outfitId: number,
  sql: any
): Promise<Outfit> {
  // Check coin balance
  const balance = await sql`
    SELECT coins FROM agent_balances WHERE agent_id = ${targetAgentId}
  `;
  if (balance.length === 0 || balance[0].coins < COPY_OUTFIT_COST) {
    throw new Error(`Insufficient coins. Need ${COPY_OUTFIT_COST} coins`);
  }

  // Get source outfit
  const source = await sql`
    SELECT * FROM agent_outfits 
    WHERE id = ${outfitId} AND agent_id = ${sourceAgentId}
  `;
  if (source.length === 0) throw new Error('Source outfit not found');

  // Deduct coins
  await sql`
    UPDATE agent_balances 
    SET coins = coins - ${COPY_OUTFIT_COST}
    WHERE agent_id = ${targetAgentId}
  `;

  // Create copy
  const copied = await createOutfit(
    targetAgentId,
    `${source[0].name} (Copy)`,
    {
      head: source[0].head,
      body: source[0].body,
      legs: source[0].legs,
      shoes: source[0].shoes,
      accessory: source[0].accessory,
      colorPrimary: source[0].color_primary,
      colorSecondary: source[0].color_secondary,
    },
    sql
  );

  // Track copy stat
  await sql`
    INSERT INTO outfit_copy_stats (outfit_id, copy_count)
    VALUES (${outfitId}, 1)
    ON CONFLICT (outfit_id) DO UPDATE SET copy_count = outfit_copy_stats.copy_count + 1
  `;

  return copied;
}

/**
 * Get most popular outfits (by copy count)
 */
export async function getPopularOutfits(limit: number, sql: any): Promise<(Outfit & { copyCount: number })[]> {
  const result = await sql`
    SELECT 
      o.id, o.agent_id AS "agentId", o.name, o.head, o.body, o.legs, o.shoes, o.accessory,
      o.color_primary AS "colorPrimary", o.color_secondary AS "colorSecondary",
      o.is_active AS "isActive", o.created_at AS "createdAt",
      COALESCE(s.copy_count, 0) AS "copyCount"
    FROM agent_outfits o
    LEFT JOIN outfit_copy_stats s ON o.id = s.outfit_id
    ORDER BY "copyCount" DESC, o.created_at DESC
    LIMIT ${limit}
  `;

  return result;
}
