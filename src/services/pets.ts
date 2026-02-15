import { randomUUID } from 'node:crypto';

export type Pet = {
  id: string;
  ownerId: string;
  name: string;
  petType: 'cat' | 'dog' | 'bird' | 'fish' | 'dragon' | 'robot';
  color: string;
  happiness: number;
  energy: number;
  isActive: boolean;
  createdAt: string;
};

const PET_COLUMNS = `id, owner_id AS "ownerId", name, pet_type AS "petType", color, happiness, energy, is_active AS "isActive", created_at AS "createdAt"`;

async function verifyOwnership(petId: string, ownerId: string, sql: any): Promise<void> {
  const result = await sql`SELECT owner_id AS "ownerId" FROM agent_pets WHERE id = ${sql.typed.text(petId)}`;
  if (result.length === 0) throw new Error('Pet not found');
  if (result[0].ownerId !== ownerId) throw new Error('Unauthorized: you do not own this pet');
}

function validateName(name: string): void {
  if (!name || name.trim().length === 0) throw new Error('Pet name is required');
  if (name.length > 50) throw new Error('Pet name must be 50 characters or less');
}

export async function adoptPet(ownerId: string, name: string, petType: Pet['petType'], color: string, sql: any): Promise<Pet> {
  const validTypes = ['cat', 'dog', 'bird', 'fish', 'dragon', 'robot'];
  if (!validTypes.includes(petType)) throw new Error('Invalid pet type');
  validateName(name);
  
  const count = await sql`SELECT COUNT(*) AS count FROM agent_pets WHERE owner_id = ${sql.typed.text(ownerId)}`;
  if (Number(count[0]?.count || 0) >= 3) throw new Error('Maximum 3 pets per agent');
  
  const result = await sql`
    INSERT INTO agent_pets (id, owner_id, name, pet_type, color, happiness, energy, is_active, created_at)
    VALUES (${sql.typed.text(randomUUID())}, ${sql.typed.text(ownerId)}, ${sql.typed.text(name.trim())}, 
            ${sql.typed.text(petType)}, ${sql.typed.text(color)}, 100, 100, false, NOW())
    RETURNING ${sql.raw(PET_COLUMNS)}`;
  return result[0];
}

export async function getMyPets(ownerId: string, sql: any): Promise<Pet[]> {
  return await sql`SELECT ${sql.raw(PET_COLUMNS)} FROM agent_pets WHERE owner_id = ${sql.typed.text(ownerId)} ORDER BY created_at DESC`;
}

export async function activatePet(petId: string, ownerId: string, sql: any): Promise<Pet> {
  await verifyOwnership(petId, ownerId, sql);
  await sql`UPDATE agent_pets SET is_active = false WHERE owner_id = ${sql.typed.text(ownerId)}`;
  const result = await sql`UPDATE agent_pets SET is_active = true WHERE id = ${sql.typed.text(petId)} RETURNING ${sql.raw(PET_COLUMNS)}`;
  return result[0];
}

export async function deactivatePet(petId: string, ownerId: string, sql: any): Promise<Pet> {
  await verifyOwnership(petId, ownerId, sql);
  const result = await sql`UPDATE agent_pets SET is_active = false WHERE id = ${sql.typed.text(petId)} RETURNING ${sql.raw(PET_COLUMNS)}`;
  return result[0];
}

/**
 * Feed a pet (costs 10 coins, increases happiness +20, max 100)
 */
export async function feedPet(petId: string, ownerId: string, sql: any): Promise<Pet> {
  // Verify ownership
  const petQuery = sql`
    SELECT owner_id AS "ownerId", happiness
    FROM agent_pets
    WHERE id = ${sql.typed.text(petId)}
  `;

  const petResults = await petQuery;

  if (petResults.length === 0) {
    throw new Error('Pet not found');
  }

  if (petResults[0].ownerId !== ownerId) {
    throw new Error('Unauthorized: you do not own this pet');
  }

  // Check coin balance
  const balanceQuery = sql`
    SELECT coins
    FROM agent_balances
    WHERE agent_id = ${sql.typed.text(ownerId)}
  `;

  const balanceResults = await balanceQuery;
  const currentCoins = balanceResults[0]?.coins || 0;

  if (currentCoins < 10) {
    throw new Error('Insufficient coins to feed pet');
  }

  // Deduct coins
  await sql`
    UPDATE agent_balances
    SET coins = coins - 10
    WHERE agent_id = ${sql.typed.text(ownerId)}
  `;

  // Increase happiness (max 100)
  const newHappiness = Math.min(petResults[0].happiness + 20, 100);

  const updateQuery = sql`
    UPDATE agent_pets
    SET happiness = ${sql.typed.int4(newHappiness)}
    WHERE id = ${sql.typed.text(petId)}
    RETURNING 
      id,
      owner_id AS "ownerId",
      name,
      pet_type AS "petType",
      color,
      happiness,
      energy,
      is_active AS "isActive",
      created_at AS "createdAt"
  `;

  const results = await updateQuery;
  return results[0];
}

/**
 * Rename a pet
 */
export async function renamePet(
  petId: string,
  ownerId: string,
  newName: string,
  sql: any
): Promise<Pet> {
  // Validate name
  if (!newName || newName.trim().length === 0) {
    throw new Error('Pet name is required');
  }

  if (newName.length > 50) {
    throw new Error('Pet name must be 50 characters or less');
  }

  // Verify ownership
  const ownerQuery = sql`
    SELECT owner_id AS "ownerId"
    FROM agent_pets
    WHERE id = ${sql.typed.text(petId)}
  `;

  const ownerResults = await ownerQuery;

  if (ownerResults.length === 0) {
    throw new Error('Pet not found');
  }

  if (ownerResults[0].ownerId !== ownerId) {
    throw new Error('Unauthorized: you do not own this pet');
  }

  // Rename pet
  const renameQuery = sql`
    UPDATE agent_pets
    SET name = ${sql.typed.text(newName.trim())}
    WHERE id = ${sql.typed.text(petId)}
    RETURNING 
      id,
      owner_id AS "ownerId",
      name,
      pet_type AS "petType",
      color,
      happiness,
      energy,
      is_active AS "isActive",
      created_at AS "createdAt"
  `;

  const results = await renameQuery;
  return results[0];
}

/**
 * Release (delete) a pet
 */
export async function releasePet(petId: string, ownerId: string, sql: any): Promise<void> {
  // Verify ownership
  const ownerQuery = sql`
    SELECT owner_id AS "ownerId"
    FROM agent_pets
    WHERE id = ${sql.typed.text(petId)}
  `;

  const ownerResults = await ownerQuery;

  if (ownerResults.length === 0) {
    throw new Error('Pet not found');
  }

  if (ownerResults[0].ownerId !== ownerId) {
    throw new Error('Unauthorized: you do not own this pet');
  }

  // Delete pet
  await sql`
    DELETE FROM agent_pets
    WHERE id = ${sql.typed.text(petId)}
  `;
}

/**
 * Get currently active pet for an agent
 */
export async function getActivePet(ownerId: string, sql: any): Promise<Pet | null> {
  const query = sql`
    SELECT 
      id,
      owner_id AS "ownerId",
      name,
      pet_type AS "petType",
      color,
      happiness,
      energy,
      is_active AS "isActive",
      created_at AS "createdAt"
    FROM agent_pets
    WHERE owner_id = ${sql.typed.text(ownerId)} AND is_active = true
    LIMIT 1
  `;

  const results = await query;
  return results[0] || null;
}
