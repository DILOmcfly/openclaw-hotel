/**
 * Agent Journal Service - Manages agent memories and experiences
 */

export type EntryType = 'memory' | 'thought' | 'dream' | 'goal' | 'achievement' | 'interaction';

export type JournalEntry = {
  id: number; agentId: string; entryType: EntryType; title: string | null;
  content: string; mood: string | null; importance: number; tags: string[]; createdAt: Date;
};

export type CreateEntryInput = {
  agentId: string; entryType: EntryType; title?: string; content: string;
  mood?: string; importance?: number; tags?: string[];
};

const VALID_ENTRY_TYPES: EntryType[] = ['memory', 'thought', 'dream', 'goal', 'achievement', 'interaction'];
const MAX_CONTENT_LENGTH = 2000;

function validateEntry(data: CreateEntryInput): void {
  if (!VALID_ENTRY_TYPES.includes(data.entryType)) {
    throw new Error(`Invalid entry type: ${data.entryType}`);
  }
  if (!data.content || data.content.trim().length === 0) {
    throw new Error('Content is required');
  }
  if (data.content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
  }
  if (data.importance !== undefined && (data.importance < 1 || data.importance > 10)) {
    throw new Error('Importance must be between 1 and 10');
  }
}

export async function createEntry(data: CreateEntryInput, sql: any): Promise<JournalEntry> {
  validateEntry(data);
  const tagsJson = JSON.stringify(data.tags || []);
  const result = await sql`
    INSERT INTO agent_journal (agent_id, entry_type, title, content, mood, importance, tags)
    VALUES (${data.agentId}, ${data.entryType}, ${data.title || null}, 
            ${data.content}, ${data.mood || null}, ${data.importance || 5}, ${tagsJson})
    RETURNING id, agent_id AS "agentId", entry_type AS "entryType",
              title, content, mood, importance, tags, created_at AS "createdAt"
  `;
  const entry = result[0];
  entry.tags = JSON.parse(entry.tags);
  return entry;
}

export async function getEntries(
  agentId: string,
  filters: { type?: EntryType; mood?: string; minImportance?: number; limit?: number; offset?: number },
  sql: any
): Promise<JournalEntry[]> {
  const limit = Math.min(filters.limit || 20, 100);
  const offset = filters.offset || 0;
  
  const results = await sql`
    SELECT id, agent_id AS "agentId", entry_type AS "entryType",
           title, content, mood, importance, tags, created_at AS "createdAt"
    FROM agent_journal 
    WHERE agent_id = ${agentId}
    ${filters.type ? sql`AND entry_type = ${filters.type}` : sql``}
    ${filters.mood ? sql`AND mood = ${filters.mood}` : sql``}
    ${filters.minImportance !== undefined ? sql`AND importance >= ${filters.minImportance}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return results.map((r: any) => ({ ...r, tags: JSON.parse(r.tags) }));
}

export async function getEntry(entryId: number, sql: any): Promise<JournalEntry | null> {
  const result = await sql`
    SELECT id, agent_id AS "agentId", entry_type AS "entryType",
           title, content, mood, importance, tags, created_at AS "createdAt"
    FROM agent_journal WHERE id = ${entryId}
  `;
  if (result.length === 0) return null;
  const entry = result[0];
  entry.tags = JSON.parse(entry.tags);
  return entry;
}

export async function updateEntry(
  entryId: number, agentId: string, updates: Partial<CreateEntryInput>, sql: any
): Promise<JournalEntry | null> {
  const existing = await getEntry(entryId, sql);
  if (!existing || existing.agentId !== agentId) return null;
  if (updates.content && updates.content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
  }
  const tagsJson = updates.tags ? JSON.stringify(updates.tags) : undefined;
  const result = await sql`
    UPDATE agent_journal SET
      ${updates.title !== undefined ? sql`title = ${updates.title},` : sql``}
      ${updates.content !== undefined ? sql`content = ${updates.content},` : sql``}
      ${updates.mood !== undefined ? sql`mood = ${updates.mood},` : sql``}
      ${updates.importance !== undefined ? sql`importance = ${updates.importance},` : sql``}
      ${tagsJson !== undefined ? sql`tags = ${tagsJson}` : sql`id = id`}
    WHERE id = ${entryId}
    RETURNING id, agent_id AS "agentId", entry_type AS "entryType",
              title, content, mood, importance, tags, created_at AS "createdAt"
  `;
  const entry = result[0];
  entry.tags = JSON.parse(entry.tags);
  return entry;
}

export async function deleteEntry(entryId: number, agentId: string, sql: any): Promise<boolean> {
  const existing = await getEntry(entryId, sql);
  if (!existing || existing.agentId !== agentId) return false;
  await sql`DELETE FROM agent_journal WHERE id = ${entryId}`;
  return true;
}

export async function searchEntries(agentId: string, query: string, sql: any): Promise<JournalEntry[]> {
  const searchTerm = `%${query}%`;
  const results = await sql`
    SELECT id, agent_id AS "agentId", entry_type AS "entryType",
           title, content, mood, importance, tags, created_at AS "createdAt"
    FROM agent_journal 
    WHERE agent_id = ${agentId} AND (title ILIKE ${searchTerm} OR content ILIKE ${searchTerm})
    ORDER BY created_at DESC LIMIT 50
  `;
  return results.map((r: any) => ({ ...r, tags: JSON.parse(r.tags) }));
}

export async function getJournalStats(agentId: string, sql: any): Promise<any> {
  const stats = await sql`
    SELECT entry_type AS "entryType", COUNT(*)::int AS count, 
           AVG(importance)::numeric(3,1) AS "avgImportance"
    FROM agent_journal WHERE agent_id = ${agentId} GROUP BY entry_type
  `;
  const moods = await sql`
    SELECT mood, COUNT(*)::int AS count FROM agent_journal
    WHERE agent_id = ${agentId} AND mood IS NOT NULL
    GROUP BY mood ORDER BY count DESC
  `;
  return { entriesByType: stats, moodDistribution: moods };
}
