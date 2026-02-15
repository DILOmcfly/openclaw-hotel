/**
 * Furniture Presets Service
 */

import { randomUUID } from 'node:crypto';

export type FurniturePreset = {
  id: string;
  roomId: string;
  ownerId: string;
  name: string;
  layout: any;
  createdAt: string;
};

/**
 * Save a furniture preset (max 5 per room)
 */
export async function savePreset(
  roomId: string,
  ownerId: string,
  name: string,
  layout: any,
  sql: any
): Promise<FurniturePreset> {
  const countResult = await sql`
    SELECT COUNT(*) AS count FROM furniture_presets WHERE room_id = ${sql.typed.text(roomId)}
  `;
  if (Number(countResult[0]?.count || 0) >= 5) {
    throw new Error('Maximum 5 presets per room');
  }

  const presetId = randomUUID();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO furniture_presets (id, room_id, owner_id, name, layout, created_at)
    VALUES (
      ${sql.typed.text(presetId)}, ${sql.typed.text(roomId)}, ${sql.typed.text(ownerId)},
      ${sql.typed.text(name)}, ${sql.typed.jsonb(layout)}, ${sql.typed.timestamptz(now)}
    )
  `;

  return { id: presetId, roomId, ownerId, name, layout, createdAt: now };
}

/**
 * Load a preset by ID (owner only)
 */
export async function loadPreset(presetId: string, ownerId: string, sql: any): Promise<any> {
  const results = await sql`
    SELECT id, room_id AS "roomId", owner_id AS "ownerId", name, layout, created_at AS "createdAt"
    FROM furniture_presets WHERE id = ${sql.typed.text(presetId)}
  `;

  if (results.length === 0) throw new Error('Preset not found');
  if (results[0].ownerId !== ownerId) throw new Error('Unauthorized: not preset owner');

  return results[0].layout;
}

/**
 * Delete a preset (owner only)
 */
export async function deletePreset(presetId: string, ownerId: string, sql: any): Promise<void> {
  const checkResults = await sql`
    SELECT owner_id AS "ownerId" FROM furniture_presets WHERE id = ${sql.typed.text(presetId)}
  `;

  if (checkResults.length === 0) throw new Error('Preset not found');
  if (checkResults[0].ownerId !== ownerId) throw new Error('Unauthorized: not preset owner');

  await sql`DELETE FROM furniture_presets WHERE id = ${sql.typed.text(presetId)}`;
}

/**
 * Get all presets for a room
 */
export async function getPresets(roomId: string, sql: any): Promise<FurniturePreset[]> {
  const results = await sql`
    SELECT id, room_id AS "roomId", owner_id AS "ownerId", name, layout, created_at AS "createdAt"
    FROM furniture_presets WHERE room_id = ${sql.typed.text(roomId)} ORDER BY created_at DESC
  `;

  return results.map((row: any) => ({
    id: row.id,
    roomId: row.roomId,
    ownerId: row.ownerId,
    name: row.name,
    layout: row.layout,
    createdAt: row.createdAt,
  }));
}

/**
 * Rename a preset (owner only)
 */
export async function renamePreset(
  presetId: string,
  ownerId: string,
  newName: string,
  sql: any
): Promise<void> {
  if (newName.length > 50) throw new Error('Preset name must be 50 characters or less');

  const checkResults = await sql`
    SELECT owner_id AS "ownerId" FROM furniture_presets WHERE id = ${sql.typed.text(presetId)}
  `;

  if (checkResults.length === 0) throw new Error('Preset not found');
  if (checkResults[0].ownerId !== ownerId) throw new Error('Unauthorized: not preset owner');

  await sql`
    UPDATE furniture_presets SET name = ${sql.typed.text(newName)} WHERE id = ${sql.typed.text(presetId)}
  `;
}
