/**
 * Room Themes Service - Manages themed decoration packs for rooms
 */

export type RoomTheme = {
  id: number; name: string; description: string | null; category: string;
  floorPattern: string | null; wallColor: string | null; ambientSound: string | null;
  weather: string | null; lighting: string | null; furnitureList: string[]; price: number; createdAt: Date;
};

export type AppliedTheme = {
  roomId: number; themeId: number; appliedBy: string | null; appliedAt: Date;
};

export type ThemeSettings = {
  floorPattern: string | null; wallColor: string | null; ambientSound: string | null;
  weather: string | null; lighting: string | null; furnitureList: string[];
};

const mapTheme = (r: any): RoomTheme => ({
  ...r, furnitureList: JSON.parse(r.furnitureList || '[]')
});

export async function getAllThemes(sql: any): Promise<RoomTheme[]> {
  const result = await sql`
    SELECT id, name, description, category, floor_pattern AS "floorPattern",
           wall_color AS "wallColor", ambient_sound AS "ambientSound",
           weather, lighting, furniture_list AS "furnitureList", price, created_at AS "createdAt"
    FROM room_themes
    ORDER BY category, price
  `;
  return result.map(mapTheme);
}

export async function getThemeById(themeId: number, sql: any): Promise<RoomTheme | null> {
  const result = await sql`
    SELECT id, name, description, category, floor_pattern AS "floorPattern",
           wall_color AS "wallColor", ambient_sound AS "ambientSound",
           weather, lighting, furniture_list AS "furnitureList", price, created_at AS "createdAt"
    FROM room_themes WHERE id = ${themeId}
  `;
  if (result.length === 0) return null;
  return mapTheme(result[0]);
}

export async function applyTheme(
  roomId: number, themeId: number, agentId: string, sql: any
): Promise<{ success: boolean; settings?: ThemeSettings; error?: string }> {
  const theme = await getThemeById(themeId, sql);
  if (!theme) return { success: false, error: 'Theme not found' };

  const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${agentId}`;
  if (balance.length === 0 || balance[0].coins < theme.price) {
    return { success: false, error: 'Insufficient coins' };
  }

  await sql`UPDATE agent_balances SET coins = coins - ${theme.price} WHERE agent_id = ${agentId}`;
  await sql`
    INSERT INTO applied_themes (room_id, theme_id, applied_by, applied_at)
    VALUES (${roomId}, ${themeId}, ${agentId}, NOW())
    ON CONFLICT (room_id) DO UPDATE SET theme_id = ${themeId}, applied_by = ${agentId}, applied_at = NOW()
  `;

  return {
    success: true,
    settings: {
      floorPattern: theme.floorPattern, wallColor: theme.wallColor,
      ambientSound: theme.ambientSound, weather: theme.weather,
      lighting: theme.lighting, furnitureList: theme.furnitureList
    }
  };
}

export async function removeTheme(roomId: number, sql: any): Promise<boolean> {
  const result = await sql`DELETE FROM applied_themes WHERE room_id = ${roomId} RETURNING room_id`;
  return result.length > 0;
}

export async function getAppliedTheme(roomId: number, sql: any): Promise<(AppliedTheme & RoomTheme) | null> {
  const result = await sql`
    SELECT at.room_id AS "roomId", at.theme_id AS "themeId", at.applied_by AS "appliedBy",
           at.applied_at AS "appliedAt", rt.name, rt.description, rt.category,
           rt.floor_pattern AS "floorPattern", rt.wall_color AS "wallColor",
           rt.ambient_sound AS "ambientSound", rt.weather, rt.lighting,
           rt.furniture_list AS "furnitureList", rt.price, rt.created_at AS "createdAt"
    FROM applied_themes at
    JOIN room_themes rt ON at.theme_id = rt.id
    WHERE at.room_id = ${roomId}
  `;
  if (result.length === 0) return null;
  return { ...result[0], id: result[0].themeId, furnitureList: JSON.parse(result[0].furnitureList || '[]') };
}

export async function getThemesByCategory(category: string, sql: any): Promise<RoomTheme[]> {
  const result = await sql`
    SELECT id, name, description, category, floor_pattern AS "floorPattern",
           wall_color AS "wallColor", ambient_sound AS "ambientSound",
           weather, lighting, furniture_list AS "furnitureList", price, created_at AS "createdAt"
    FROM room_themes WHERE category = ${category} ORDER BY price
  `;
  return result.map(mapTheme);
}

export async function getPopularThemes(limit: number, sql: any): Promise<(RoomTheme & { applicationCount: number })[]> {
  const result = await sql`
    SELECT rt.id, rt.name, rt.description, rt.category, rt.floor_pattern AS "floorPattern",
           rt.wall_color AS "wallColor", rt.ambient_sound AS "ambientSound",
           rt.weather, rt.lighting, rt.furniture_list AS "furnitureList", rt.price,
           rt.created_at AS "createdAt", COUNT(at.room_id) AS "applicationCount"
    FROM room_themes rt
    LEFT JOIN applied_themes at ON rt.id = at.theme_id
    GROUP BY rt.id ORDER BY COUNT(at.room_id) DESC, rt.price LIMIT ${limit}
  `;
  return result.map((r: any) => ({
    ...r, furnitureList: JSON.parse(r.furnitureList || '[]'), applicationCount: parseInt(r.applicationCount)
  }));
}

export async function previewTheme(themeId: number, sql: any): Promise<ThemeSettings | null> {
  const theme = await getThemeById(themeId, sql);
  if (!theme) return null;
  return {
    floorPattern: theme.floorPattern, wallColor: theme.wallColor,
    ambientSound: theme.ambientSound, weather: theme.weather,
    lighting: theme.lighting, furnitureList: theme.furnitureList
  };
}
