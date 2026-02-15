import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';

export type Season = {
  id: string;
  name: string;
  theme: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  weatherOverride: string | null;
  colorScheme: Record<string, any>;
  createdAt: Date;
};

export type SeasonalItem = {
  id: string;
  seasonId: string;
  itemType: string;
  name: string;
  description: string;
  rarity: string;
  available: boolean;
};

/**
 * Create a new season
 */
export async function createSeason(
  name: string,
  theme: string,
  startDate: Date,
  endDate: Date,
  weatherOverride: string | null,
  colorScheme: Record<string, any>,
  sql: Sql
): Promise<Season> {
  const id = randomUUID();

  const [season] = await sql<Season[]>`
    INSERT INTO seasons (
      id, name, theme, start_date, end_date, weather_override, color_scheme
    )
    VALUES (
      ${id}, ${name}, ${theme}, ${startDate}, ${endDate}, ${weatherOverride}, ${JSON.stringify(colorScheme)}
    )
    RETURNING 
      id,
      name,
      theme,
      start_date AS "startDate",
      end_date AS "endDate",
      is_active AS "isActive",
      weather_override AS "weatherOverride",
      color_scheme AS "colorScheme",
      created_at AS "createdAt"
  `;

  return season;
}

/**
 * Get currently active season (one at a time)
 */
export async function getActiveSeason(sql: Sql): Promise<Season | null> {
  const [season] = await sql<Season[]>`
    SELECT 
      id,
      name,
      theme,
      start_date AS "startDate",
      end_date AS "endDate",
      is_active AS "isActive",
      weather_override AS "weatherOverride",
      color_scheme AS "colorScheme",
      created_at AS "createdAt"
    FROM seasons
    WHERE is_active = true
    LIMIT 1
  `;

  return season || null;
}

/**
 * Get season by ID
 */
export async function getSeasonById(id: string, sql: Sql): Promise<Season | null> {
  const [season] = await sql<Season[]>`
    SELECT 
      id,
      name,
      theme,
      start_date AS "startDate",
      end_date AS "endDate",
      is_active AS "isActive",
      weather_override AS "weatherOverride",
      color_scheme AS "colorScheme",
      created_at AS "createdAt"
    FROM seasons
    WHERE id = ${id}
  `;

  return season || null;
}

/**
 * Get all seasons
 */
export async function getAllSeasons(sql: Sql): Promise<Season[]> {
  const seasons = await sql<Season[]>`
    SELECT 
      id,
      name,
      theme,
      start_date AS "startDate",
      end_date AS "endDate",
      is_active AS "isActive",
      weather_override AS "weatherOverride",
      color_scheme AS "colorScheme",
      created_at AS "createdAt"
    FROM seasons
    ORDER BY start_date DESC
  `;

  return seasons;
}

/**
 * Activate a season (deactivate others first)
 */
export async function activateSeason(seasonId: string, sql: Sql): Promise<void> {
  const season = await getSeasonById(seasonId, sql);

  if (!season) {
    throw new Error('Season not found');
  }

  // Deactivate all seasons first
  await sql`
    UPDATE seasons
    SET is_active = false
    WHERE is_active = true
  `;

  // Activate the specified season
  await sql`
    UPDATE seasons
    SET is_active = true
    WHERE id = ${seasonId}
  `;
}

/**
 * Deactivate a season
 */
export async function deactivateSeason(seasonId: string, sql: Sql): Promise<void> {
  const season = await getSeasonById(seasonId, sql);

  if (!season) {
    throw new Error('Season not found');
  }

  await sql`
    UPDATE seasons
    SET is_active = false
    WHERE id = ${seasonId}
  `;
}

/**
 * Add a seasonal item
 */
export async function addSeasonalItem(
  seasonId: string,
  itemType: string,
  name: string,
  description: string,
  rarity: string,
  sql: Sql
): Promise<SeasonalItem> {
  const id = randomUUID();

  const [item] = await sql<SeasonalItem[]>`
    INSERT INTO seasonal_items (
      id, season_id, item_type, name, description, rarity
    )
    VALUES (
      ${id}, ${seasonId}, ${itemType}, ${name}, ${description}, ${rarity}
    )
    RETURNING 
      id,
      season_id AS "seasonId",
      item_type AS "itemType",
      name,
      description,
      rarity,
      available
  `;

  return item;
}

/**
 * Get seasonal items for a season
 */
export async function getSeasonalItems(seasonId: string, sql: Sql): Promise<SeasonalItem[]> {
  const items = await sql<SeasonalItem[]>`
    SELECT 
      id,
      season_id AS "seasonId",
      item_type AS "itemType",
      name,
      description,
      rarity,
      available
    FROM seasonal_items
    WHERE season_id = ${seasonId}
    ORDER BY name ASC
  `;

  return items;
}

/**
 * Check if a season is active
 */
export async function isSeasonActive(seasonId: string, sql: Sql): Promise<boolean> {
  const season = await getSeasonById(seasonId, sql);

  if (!season) {
    return false;
  }

  return season.isActive;
}
