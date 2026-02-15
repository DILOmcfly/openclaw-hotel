import { randomUUID } from 'node:crypto';

export type WallItem = {
  id: string;
  roomId: string;
  wall: 'north' | 'south' | 'east' | 'west';
  positionX: number;
  positionY: number;
  itemType: 'poster' | 'clock' | 'sign' | 'mirror' | 'shelf' | 'painting' | 'banner' | 'window';
  content: string;
  placedBy: string;
  createdAt: string;
};

const WALL_ITEM_COLUMNS = `id, room_id AS "roomId", wall, position_x AS "positionX", position_y AS "positionY", item_type AS "itemType", content, placed_by AS "placedBy", created_at AS "createdAt"`;
const VALID_WALLS = ['north', 'south', 'east', 'west'];
const VALID_ITEM_TYPES = ['poster', 'clock', 'sign', 'mirror', 'shelf', 'painting', 'banner', 'window'];

async function verifyRoomOwnership(roomId: string, agentId: string, sql: any): Promise<boolean> {
  const result = await sql`SELECT owner_id AS "ownerId" FROM rooms WHERE id = ${sql.typed.text(roomId)}`;
  return result.length > 0 && result[0].ownerId === agentId;
}

async function verifyItemOwnership(itemId: string, agentId: string, sql: any): Promise<boolean> {
  const result = await sql`SELECT room_id AS "roomId", placed_by AS "placedBy" FROM room_wall_items WHERE id = ${sql.typed.text(itemId)}`;
  if (result.length === 0) throw new Error('Wall item not found');
  const isRoomOwner = await verifyRoomOwnership(result[0].roomId, agentId, sql);
  return result[0].placedBy === agentId || isRoomOwner;
}

function validatePosition(pos: number): void {
  if (pos < 0 || pos > 1) throw new Error('Position must be between 0 and 1');
}

export async function placeItem(roomId: string, wall: string, posX: number, posY: number, itemType: string, content: string, placedBy: string, sql: any): Promise<WallItem> {
  if (!VALID_WALLS.includes(wall)) throw new Error('Invalid wall');
  if (!VALID_ITEM_TYPES.includes(itemType)) throw new Error('Invalid item type');
  validatePosition(posX);
  validatePosition(posY);

  const result = await sql`
    INSERT INTO room_wall_items (id, room_id, wall, position_x, position_y, item_type, content, placed_by, created_at)
    VALUES (${sql.typed.text(randomUUID())}, ${sql.typed.text(roomId)}, ${sql.typed.text(wall)}, 
            ${sql.typed.float8(posX)}, ${sql.typed.float8(posY)}, ${sql.typed.text(itemType)}, 
            ${sql.typed.text(content)}, ${sql.typed.text(placedBy)}, NOW())
    RETURNING ${sql.raw(WALL_ITEM_COLUMNS)}`;
  return result[0];
}

export async function removeItem(itemId: string, agentId: string, sql: any): Promise<void> {
  const canRemove = await verifyItemOwnership(itemId, agentId, sql);
  if (!canRemove) throw new Error('Unauthorized: you cannot remove this item');
  await sql`DELETE FROM room_wall_items WHERE id = ${sql.typed.text(itemId)}`;
}

export async function getWallItems(roomId: string, wall: string | undefined, sql: any): Promise<WallItem[]> {
  if (wall) {
    if (!VALID_WALLS.includes(wall)) throw new Error('Invalid wall');
    return await sql`SELECT ${sql.raw(WALL_ITEM_COLUMNS)} FROM room_wall_items WHERE room_id = ${sql.typed.text(roomId)} AND wall = ${sql.typed.text(wall)} ORDER BY created_at DESC`;
  }
  return await sql`SELECT ${sql.raw(WALL_ITEM_COLUMNS)} FROM room_wall_items WHERE room_id = ${sql.typed.text(roomId)} ORDER BY created_at DESC`;
}

export async function moveItem(itemId: string, newPosX: number, newPosY: number, agentId: string, sql: any): Promise<WallItem> {
  validatePosition(newPosX);
  validatePosition(newPosY);
  const canMove = await verifyItemOwnership(itemId, agentId, sql);
  if (!canMove) throw new Error('Unauthorized: you cannot move this item');
  
  const result = await sql`
    UPDATE room_wall_items 
    SET position_x = ${sql.typed.float8(newPosX)}, position_y = ${sql.typed.float8(newPosY)}
    WHERE id = ${sql.typed.text(itemId)} 
    RETURNING ${sql.raw(WALL_ITEM_COLUMNS)}`;
  return result[0];
}

export async function updateContent(itemId: string, content: string, agentId: string, sql: any): Promise<WallItem> {
  const canUpdate = await verifyItemOwnership(itemId, agentId, sql);
  if (!canUpdate) throw new Error('Unauthorized: you cannot update this item');
  
  const result = await sql`
    UPDATE room_wall_items 
    SET content = ${sql.typed.text(content)}
    WHERE id = ${sql.typed.text(itemId)} 
    RETURNING ${sql.raw(WALL_ITEM_COLUMNS)}`;
  return result[0];
}
