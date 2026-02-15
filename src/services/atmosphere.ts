export type Weather = 'clear' | 'rain' | 'snow' | 'fog' | 'storm' | 'sunny' | 'night' | 'sunset';
export type Lighting = 'normal' | 'dim' | 'dark' | 'bright' | 'neon' | 'candlelight';
export type AmbientSound = 'none' | 'rain' | 'wind' | 'birds' | 'ocean' | 'city' | 'forest' | 'fire';

export type RoomAtmosphere = {
  roomId: string;
  weather: Weather;
  lighting: Lighting;
  ambientSound: AmbientSound;
  colorTint: string;
  updatedAt: string;
};

const VALID_WEATHER: Weather[] = ['clear', 'rain', 'snow', 'fog', 'storm', 'sunny', 'night', 'sunset'];
const VALID_LIGHTING: Lighting[] = ['normal', 'dim', 'dark', 'bright', 'neon', 'candlelight'];
const VALID_SOUNDS: AmbientSound[] = ['none', 'rain', 'wind', 'birds', 'ocean', 'city', 'forest', 'fire'];

export function isValidHexColor(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

export async function setWeather(roomId: string, weather: Weather, sql: any): Promise<RoomAtmosphere> {
  if (!VALID_WEATHER.includes(weather)) {
    throw new Error(`Invalid weather. Must be one of: ${VALID_WEATHER.join(', ')}`);
  }
  await sql`INSERT INTO room_atmosphere ${sql({ room_id: roomId, weather, updated_at: new Date().toISOString() })} ON CONFLICT (room_id) DO UPDATE SET weather = EXCLUDED.weather, updated_at = EXCLUDED.updated_at`;
  return getAtmosphere(roomId, sql);
}

export async function setLighting(roomId: string, lighting: Lighting, sql: any): Promise<RoomAtmosphere> {
  if (!VALID_LIGHTING.includes(lighting)) {
    throw new Error(`Invalid lighting. Must be one of: ${VALID_LIGHTING.join(', ')}`);
  }
  await sql`INSERT INTO room_atmosphere ${sql({ room_id: roomId, lighting, updated_at: new Date().toISOString() })} ON CONFLICT (room_id) DO UPDATE SET lighting = EXCLUDED.lighting, updated_at = EXCLUDED.updated_at`;
  return getAtmosphere(roomId, sql);
}

export async function setAmbientSound(roomId: string, sound: AmbientSound, sql: any): Promise<RoomAtmosphere> {
  if (!VALID_SOUNDS.includes(sound)) {
    throw new Error(`Invalid ambient sound. Must be one of: ${VALID_SOUNDS.join(', ')}`);
  }
  await sql`INSERT INTO room_atmosphere ${sql({ room_id: roomId, ambient_sound: sound, updated_at: new Date().toISOString() })} ON CONFLICT (room_id) DO UPDATE SET ambient_sound = EXCLUDED.ambient_sound, updated_at = EXCLUDED.updated_at`;
  return getAtmosphere(roomId, sql);
}

export async function setColorTint(roomId: string, hex: string, sql: any): Promise<RoomAtmosphere> {
  if (!isValidHexColor(hex)) {
    throw new Error('Invalid hex color. Must be in format #RGB or #RRGGBB');
  }
  await sql`INSERT INTO room_atmosphere ${sql({ room_id: roomId, color_tint: hex, updated_at: new Date().toISOString() })} ON CONFLICT (room_id) DO UPDATE SET color_tint = EXCLUDED.color_tint, updated_at = EXCLUDED.updated_at`;
  return getAtmosphere(roomId, sql);
}

export async function getAtmosphere(roomId: string, sql: any): Promise<RoomAtmosphere> {
  const rows = await sql`SELECT room_id AS "roomId", weather, lighting, ambient_sound AS "ambientSound", color_tint AS "colorTint", updated_at AS "updatedAt" FROM room_atmosphere WHERE room_id = ${roomId}`;
  if (rows.length === 0) {
    return { roomId, weather: 'clear', lighting: 'normal', ambientSound: 'none', colorTint: '#FFFFFF', updatedAt: new Date().toISOString() };
  }
  return rows[0];
}

export async function resetAtmosphere(roomId: string, sql: any): Promise<RoomAtmosphere> {
  await sql`INSERT INTO room_atmosphere ${sql({ room_id: roomId, weather: 'clear', lighting: 'normal', ambient_sound: 'none', color_tint: '#FFFFFF', updated_at: new Date().toISOString() })} ON CONFLICT (room_id) DO UPDATE SET weather = 'clear', lighting = 'normal', ambient_sound = 'none', color_tint = '#FFFFFF', updated_at = EXCLUDED.updated_at`;
  return getAtmosphere(roomId, sql);
}
