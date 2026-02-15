/**
 * Agent Settings Service
 * Manages agent preferences and configuration
 */

export type Language = 'en' | 'es' | 'de' | 'fr' | 'pt' | 'ja' | 'ko' | 'zh';
export type Theme = 'dark' | 'light' | 'retro' | 'neon';

export type AgentSettings = {
  agentId: string;
  chatColor: string;
  notificationSounds: boolean;
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  allowTrades: boolean;
  allowWhispers: boolean;
  language: Language;
  theme: Theme;
  updatedAt: string;
};

export type PartialSettings = Partial<Omit<AgentSettings, 'agentId' | 'updatedAt'>>;

const DEFAULT_SETTINGS: Omit<AgentSettings, 'agentId' | 'updatedAt'> = {
  chatColor: '#FFFFFF',
  notificationSounds: true,
  showOnlineStatus: true,
  allowFriendRequests: true,
  allowTrades: true,
  allowWhispers: true,
  language: 'en',
  theme: 'dark',
};

const VALID_LANGUAGES: Language[] = ['en', 'es', 'de', 'fr', 'pt', 'ja', 'ko', 'zh'];
const VALID_THEMES: Theme[] = ['dark', 'light', 'retro', 'neon'];

/**
 * Validate hex color code
 */
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color);
}

/**
 * Get agent settings (returns defaults if no entry exists)
 */
export async function getSettings(agentId: string, sql: any): Promise<AgentSettings> {
  const rows = await sql`
    SELECT
      agent_id AS "agentId",
      chat_color AS "chatColor",
      notification_sounds AS "notificationSounds",
      show_online_status AS "showOnlineStatus",
      allow_friend_requests AS "allowFriendRequests",
      allow_trades AS "allowTrades",
      allow_whispers AS "allowWhispers",
      language,
      theme,
      updated_at AS "updatedAt"
    FROM agent_settings
    WHERE agent_id = ${agentId}
  `;

  if (rows.length === 0) {
    return {
      agentId,
      ...DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString(),
    };
  }

  return rows[0];
}

/**
 * Update agent settings (partial update)
 */
export async function updateSettings(
  agentId: string,
  settings: PartialSettings,
  sql: any
): Promise<AgentSettings> {
  // Validate chat color if provided
  if (settings.chatColor && !isValidHexColor(settings.chatColor)) {
    throw new Error('Invalid chat color. Must be a valid hex color code (e.g., #FFFFFF)');
  }

  // Validate language if provided
  if (settings.language && !VALID_LANGUAGES.includes(settings.language)) {
    throw new Error(`Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}`);
  }

  // Validate theme if provided
  if (settings.theme && !VALID_THEMES.includes(settings.theme)) {
    throw new Error(`Invalid theme. Must be one of: ${VALID_THEMES.join(', ')}`);
  }

  // Build update object with snake_case keys for database
  const updateObj: any = { agent_id: agentId, updated_at: new Date().toISOString() };

  if (settings.chatColor !== undefined) updateObj.chat_color = settings.chatColor;
  if (settings.notificationSounds !== undefined)
    updateObj.notification_sounds = settings.notificationSounds;
  if (settings.showOnlineStatus !== undefined)
    updateObj.show_online_status = settings.showOnlineStatus;
  if (settings.allowFriendRequests !== undefined)
    updateObj.allow_friend_requests = settings.allowFriendRequests;
  if (settings.allowTrades !== undefined) updateObj.allow_trades = settings.allowTrades;
  if (settings.allowWhispers !== undefined) updateObj.allow_whispers = settings.allowWhispers;
  if (settings.language !== undefined) updateObj.language = settings.language;
  if (settings.theme !== undefined) updateObj.theme = settings.theme;

  await sql`
    INSERT INTO agent_settings ${sql(updateObj)}
    ON CONFLICT (agent_id)
    DO UPDATE SET
      chat_color = COALESCE(EXCLUDED.chat_color, agent_settings.chat_color),
      notification_sounds = COALESCE(EXCLUDED.notification_sounds, agent_settings.notification_sounds),
      show_online_status = COALESCE(EXCLUDED.show_online_status, agent_settings.show_online_status),
      allow_friend_requests = COALESCE(EXCLUDED.allow_friend_requests, agent_settings.allow_friend_requests),
      allow_trades = COALESCE(EXCLUDED.allow_trades, agent_settings.allow_trades),
      allow_whispers = COALESCE(EXCLUDED.allow_whispers, agent_settings.allow_whispers),
      language = COALESCE(EXCLUDED.language, agent_settings.language),
      theme = COALESCE(EXCLUDED.theme, agent_settings.theme),
      updated_at = EXCLUDED.updated_at
  `;

  return getSettings(agentId, sql);
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(agentId: string, sql: any): Promise<AgentSettings> {
  await sql`
    DELETE FROM agent_settings
    WHERE agent_id = ${agentId}
  `;

  return {
    agentId,
    ...DEFAULT_SETTINGS,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a single setting value
 */
export async function getSetting(agentId: string, key: keyof PartialSettings, sql: any): Promise<any> {
  const settings = await getSettings(agentId, sql);
  return settings[key];
}
