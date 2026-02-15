/** Soundboard Service - Manages room sound effects and audio triggers */

export type SoundboardSound = {
  id: number; roomId: number; name: string; soundKey: string;
  category: 'effect' | 'music' | 'ambient' | 'voice' | 'meme';
  volume: number; playCount: number; addedBy: string; createdAt: Date;
};

export type SoundboardConfig = {
  roomId: number; enabled: boolean; cooldownSeconds: number; createdAt: Date;
};

const MAX_SOUNDS_PER_ROOM = 20;
const MIN_COOLDOWN = 1;
const MAX_COOLDOWN = 60;

export async function enableSoundboard(roomId: number, sql: any): Promise<SoundboardConfig> {
  const result = await sql`
    INSERT INTO room_soundboards (room_id, enabled, cooldown_seconds)
    VALUES (${roomId}, true, 5)
    ON CONFLICT (room_id) DO UPDATE SET enabled = true
    RETURNING room_id AS "roomId", enabled, cooldown_seconds AS "cooldownSeconds", created_at AS "createdAt"
  `;
  return result[0];
}

export async function addSound(roomId: number, name: string, soundKey: string, category: string, volume: number, addedBy: string, sql: any): Promise<SoundboardSound> {
  const countResult = await sql`SELECT COUNT(*) as count FROM soundboard_sounds WHERE room_id = ${roomId}`;
  if (countResult[0].count >= MAX_SOUNDS_PER_ROOM) throw new Error(`Maximum ${MAX_SOUNDS_PER_ROOM} sounds per room`);

  const result = await sql`
    INSERT INTO soundboard_sounds (room_id, name, sound_key, category, volume, added_by)
    VALUES (${roomId}, ${name}, ${soundKey}, ${category}, ${volume}, ${addedBy})
    RETURNING id, room_id AS "roomId", name, sound_key AS "soundKey", category, volume, play_count AS "playCount", added_by AS "addedBy", created_at AS "createdAt"
  `;
  return result[0];
}

export async function removeSound(soundId: number, sql: any): Promise<boolean> {
  const result = await sql`DELETE FROM soundboard_sounds WHERE id = ${soundId}`;
  return result.count > 0;
}

export async function playSound(roomId: number, soundId: number, sql: any): Promise<{ sound: SoundboardSound; cooldownRemaining: number }> {
  const configResult = await sql`SELECT enabled, cooldown_seconds FROM room_soundboards WHERE room_id = ${roomId}`;
  if (configResult.length === 0 || !configResult[0].enabled) throw new Error('Soundboard not enabled for this room');

  const soundResult = await sql`
    UPDATE soundboard_sounds SET play_count = play_count + 1 WHERE id = ${soundId} AND room_id = ${roomId}
    RETURNING id, room_id AS "roomId", name, sound_key AS "soundKey", category, volume, play_count AS "playCount", added_by AS "addedBy", created_at AS "createdAt"
  `;
  if (soundResult.length === 0) throw new Error('Sound not found');

  return { sound: soundResult[0], cooldownRemaining: configResult[0].cooldown_seconds };
}

export async function getSounds(roomId: number, sql: any): Promise<SoundboardSound[]> {
  return await sql`
    SELECT id, room_id AS "roomId", name, sound_key AS "soundKey", category, volume, play_count AS "playCount", added_by AS "addedBy", created_at AS "createdAt"
    FROM soundboard_sounds WHERE room_id = ${roomId} ORDER BY created_at DESC
  `;
}

export async function getPopularSounds(limit: number, sql: any): Promise<SoundboardSound[]> {
  return await sql`
    SELECT id, room_id AS "roomId", name, sound_key AS "soundKey", category, volume, play_count AS "playCount", added_by AS "addedBy", created_at AS "createdAt"
    FROM soundboard_sounds WHERE play_count > 0 ORDER BY play_count DESC LIMIT ${limit}
  `;
}

export async function setCooldown(roomId: number, cooldownSeconds: number, sql: any): Promise<SoundboardConfig> {
  if (cooldownSeconds < MIN_COOLDOWN || cooldownSeconds > MAX_COOLDOWN) {
    throw new Error(`Cooldown must be between ${MIN_COOLDOWN} and ${MAX_COOLDOWN} seconds`);
  }

  const result = await sql`
    UPDATE room_soundboards SET cooldown_seconds = ${cooldownSeconds} WHERE room_id = ${roomId}
    RETURNING room_id AS "roomId", enabled, cooldown_seconds AS "cooldownSeconds", created_at AS "createdAt"
  `;
  if (result.length === 0) throw new Error('Soundboard not found');
  return result[0];
}

export async function getSoundboardStats(roomId: number, sql: any): Promise<{
  totalPlays: number; mostPopular: SoundboardSound | null; uniquePlayers: number;
}> {
  const totalResult = await sql`SELECT COALESCE(SUM(play_count), 0) as total FROM soundboard_sounds WHERE room_id = ${roomId}`;
  const popularResult = await sql`
    SELECT id, room_id AS "roomId", name, sound_key AS "soundKey", category, volume, play_count AS "playCount", added_by AS "addedBy", created_at AS "createdAt"
    FROM soundboard_sounds WHERE room_id = ${roomId} AND play_count > 0 ORDER BY play_count DESC LIMIT 1
  `;
  const playersResult = await sql`SELECT COUNT(DISTINCT added_by) as count FROM soundboard_sounds WHERE room_id = ${roomId}`;

  return {
    totalPlays: parseInt(totalResult[0].total),
    mostPopular: popularResult.length > 0 ? popularResult[0] : null,
    uniquePlayers: parseInt(playersResult[0].count),
  };
}
