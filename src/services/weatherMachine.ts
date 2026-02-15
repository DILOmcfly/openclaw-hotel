/**
 * Weather Machine Service - Manages room weather effects
 */

export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'storm' | 'aurora' | 'meteor' | 'rainbow';

export type WeatherMachine = {
  roomId: number;
  currentWeather: WeatherType;
  intensity: number;
  autoCycle: boolean;
  cycleIntervalMinutes: number;
  lastChanged: Date;
  changedBy: string | null;
};

export type WeatherHistory = {
  id: number;
  roomId: number;
  weather: WeatherType;
  durationMinutes: number;
  setBy: string | null;
  createdAt: Date;
};

const VALID_WEATHER: WeatherType[] = ['clear', 'rain', 'snow', 'fog', 'storm', 'aurora', 'meteor', 'rainbow'];

/**
 * Set weather for a room (owner only)
 */
export async function setWeather(roomId: number, weather: WeatherType, agentId: string, sql: any): Promise<WeatherMachine> {
  if (!VALID_WEATHER.includes(weather)) {
    throw new Error('Invalid weather type');
  }

  // Calculate duration of previous weather
  const existing = await sql`
    SELECT current_weather, last_changed FROM weather_machines WHERE room_id = ${roomId}
  `;

  if (existing.length > 0) {
    const prev = existing[0];
    const duration = Math.floor((Date.now() - new Date(prev.last_changed).getTime()) / 60000);
    
    await sql`
      INSERT INTO weather_history (room_id, weather, duration_minutes, set_by)
      VALUES (${roomId}, ${prev.current_weather}, ${duration}, ${agentId})
    `;
  }

  // Update or insert weather machine
  const result = await sql`
    INSERT INTO weather_machines (room_id, current_weather, changed_by, last_changed)
    VALUES (${roomId}, ${weather}, ${agentId}, NOW())
    ON CONFLICT (room_id) DO UPDATE SET
      current_weather = ${weather},
      changed_by = ${agentId},
      last_changed = NOW()
    RETURNING 
      room_id AS "roomId",
      current_weather AS "currentWeather",
      intensity,
      auto_cycle AS "autoCycle",
      cycle_interval_minutes AS "cycleIntervalMinutes",
      last_changed AS "lastChanged",
      changed_by AS "changedBy"
  `;

  return result[0];
}

/**
 * Get current weather for a room
 */
export async function getWeather(roomId: number, sql: any): Promise<WeatherMachine | null> {
  const result = await sql`
    SELECT 
      room_id AS "roomId",
      current_weather AS "currentWeather",
      intensity,
      auto_cycle AS "autoCycle",
      cycle_interval_minutes AS "cycleIntervalMinutes",
      last_changed AS "lastChanged",
      changed_by AS "changedBy"
    FROM weather_machines
    WHERE room_id = ${roomId}
  `;

  return result.length > 0 ? result[0] : null;
}

/**
 * Enable auto-cycle with interval
 */
export async function enableAutoCycle(roomId: number, intervalMinutes: number, sql: any): Promise<void> {
  await sql`
    INSERT INTO weather_machines (room_id, auto_cycle, cycle_interval_minutes)
    VALUES (${roomId}, true, ${intervalMinutes})
    ON CONFLICT (room_id) DO UPDATE SET
      auto_cycle = true,
      cycle_interval_minutes = ${intervalMinutes}
  `;
}

/**
 * Disable auto-cycle
 */
export async function disableAutoCycle(roomId: number, sql: any): Promise<void> {
  await sql`
    UPDATE weather_machines
    SET auto_cycle = false
    WHERE room_id = ${roomId}
  `;
}

/**
 * Set weather intensity (0-100)
 */
export async function setIntensity(roomId: number, intensity: number, sql: any): Promise<void> {
  if (intensity < 0 || intensity > 100) {
    throw new Error('Intensity must be between 0 and 100');
  }

  await sql`
    INSERT INTO weather_machines (room_id, intensity)
    VALUES (${roomId}, ${intensity})
    ON CONFLICT (room_id) DO UPDATE SET intensity = ${intensity}
  `;
}

/**
 * Get weather history for a room (paginated)
 */
export async function getWeatherHistory(roomId: number, limit: number, offset: number, sql: any): Promise<WeatherHistory[]> {
  const result = await sql`
    SELECT 
      id,
      room_id AS "roomId",
      weather,
      duration_minutes AS "durationMinutes",
      set_by AS "setBy",
      created_at AS "createdAt"
    FROM weather_history
    WHERE room_id = ${roomId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return result;
}

/**
 * Get most popular weather types globally
 */
export async function getPopularWeather(sql: any): Promise<{ weather: WeatherType; count: number }[]> {
  const result = await sql`
    SELECT weather, COUNT(*) as count
    FROM weather_history
    GROUP BY weather
    ORDER BY count DESC
    LIMIT 10
  `;

  return result.map((r: any) => ({ weather: r.weather, count: parseInt(r.count) }));
}

/**
 * Get weather stats per room (time spent in each weather type)
 */
export async function getWeatherStats(roomId: number, sql: any): Promise<{ weather: WeatherType; totalMinutes: number }[]> {
  const result = await sql`
    SELECT weather, SUM(duration_minutes) as total_minutes
    FROM weather_history
    WHERE room_id = ${roomId}
    GROUP BY weather
    ORDER BY total_minutes DESC
  `;

  return result.map((r: any) => ({ weather: r.weather, totalMinutes: parseInt(r.total_minutes || 0) }));
}
