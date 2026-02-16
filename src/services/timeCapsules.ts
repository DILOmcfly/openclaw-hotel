export type TimeCapsule = {
  id: number;
  creatorId: string;
  roomId: number | null;
  title: string | null;
  message: string;
  items: string[];
  opensAt: Date;
  opened: boolean;
  openedAt: Date | null;
  viewers: string[];
  createdAt: Date;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

export function validateOpensAt(opensAt: Date): boolean {
  const now = Date.now();
  const target = new Date(opensAt).getTime();
  const diff = target - now;
  return diff >= ONE_DAY_MS && diff <= ONE_YEAR_MS;
}

const parseCapsule = (c: any): TimeCapsule => ({
  ...c,
  items: JSON.parse(c.items),
  viewers: JSON.parse(c.viewers),
});

export async function createCapsule(
  creatorId: string,
  message: string,
  opensAt: Date,
  sql: any,
  title?: string,
  roomId?: number,
  items?: string[]
): Promise<TimeCapsule> {
  if (!validateOpensAt(opensAt)) throw new Error('Opens at must be 1 day to 1 year in future');
  
  const active = await sql`SELECT COUNT(*) as count FROM time_capsules WHERE creator_id = ${creatorId} AND opened = false`;
  if (active[0].count >= 10) throw new Error('Maximum active capsules reached');

  const result = await sql`
    INSERT INTO time_capsules (creator_id, room_id, title, message, items, opens_at)
    VALUES (${creatorId}, ${roomId || null}, ${title || null}, ${message}, ${JSON.stringify(items || [])}, ${opensAt})
    RETURNING id, creator_id AS "creatorId", room_id AS "roomId", title, message, items, opens_at AS "opensAt",
      opened, opened_at AS "openedAt", viewers, created_at AS "createdAt"
  `;
  return parseCapsule(result[0]);
}

export async function openCapsule(capsuleId: number, sql: any): Promise<TimeCapsule> {
  const result = await sql`
    SELECT id, creator_id AS "creatorId", room_id AS "roomId", title, message, items,
      opens_at AS "opensAt", opened, opened_at AS "openedAt", viewers, created_at AS "createdAt"
    FROM time_capsules WHERE id = ${capsuleId}
  `;
  if (result.length === 0) throw new Error('Capsule not found');
  
  const capsule = result[0];
  if (new Date(capsule.opensAt) > new Date()) throw new Error('Capsule cannot be opened yet');
  if (capsule.opened) return parseCapsule(capsule);

  const updated = await sql`
    UPDATE time_capsules SET opened = true, opened_at = NOW() WHERE id = ${capsuleId}
    RETURNING id, creator_id AS "creatorId", room_id AS "roomId", title, message, items,
      opens_at AS "opensAt", opened, opened_at AS "openedAt", viewers, created_at AS "createdAt"
  `;
  return parseCapsule(updated[0]);
}

export async function getCapsule(capsuleId: number, sql: any): Promise<TimeCapsule | null> {
  const result = await sql`
    SELECT id, creator_id AS "creatorId", room_id AS "roomId", title, message, items,
      opens_at AS "opensAt", opened, opened_at AS "openedAt", viewers, created_at AS "createdAt"
    FROM time_capsules WHERE id = ${capsuleId}
  `;
  if (result.length === 0) return null;

  const capsule = parseCapsule(result[0]);
  if (!capsule.opened) {
    capsule.message = '[Capsule not yet opened]';
    capsule.items = [];
  }
  return capsule;
}

export async function getAgentCapsules(agentId: string, sql: any): Promise<TimeCapsule[]> {
  const result = await sql`
    SELECT id, creator_id AS "creatorId", room_id AS "roomId", title, message, items,
      opens_at AS "opensAt", opened, opened_at AS "openedAt", viewers, created_at AS "createdAt"
    FROM time_capsules WHERE creator_id = ${agentId} ORDER BY created_at DESC
  `;
  return result.map(parseCapsule);
}

export async function getRoomCapsules(roomId: number, sql: any): Promise<TimeCapsule[]> {
  const result = await sql`
    SELECT id, creator_id AS "creatorId", room_id AS "roomId", title, message, items,
      opens_at AS "opensAt", opened, opened_at AS "openedAt", viewers, created_at AS "createdAt"
    FROM time_capsules WHERE room_id = ${roomId} ORDER BY opens_at ASC
  `;
  return result.map((c: any) => {
    const capsule = parseCapsule(c);
    if (!capsule.opened) capsule.message = '[Capsule not yet opened]';
    return capsule;
  });
}

export async function getUpcoming(sql: any): Promise<TimeCapsule[]> {
  const sevenDaysFromNow = new Date(Date.now() + 7 * ONE_DAY_MS);
  const result = await sql`
    SELECT id, creator_id AS "creatorId", room_id AS "roomId", title, message, items,
      opens_at AS "opensAt", opened, opened_at AS "openedAt", viewers, created_at AS "createdAt"
    FROM time_capsules WHERE opened = false AND opens_at <= ${sevenDaysFromNow} AND opens_at > NOW()
    ORDER BY opens_at ASC
  `;
  return result.map((c: any) => ({ ...parseCapsule(c), message: '[Capsule not yet opened]' }));
}

export async function addViewer(capsuleId: number, agentId: string, sql: any): Promise<void> {
  const result = await sql`SELECT viewers, opened FROM time_capsules WHERE id = ${capsuleId}`;
  if (result.length === 0) throw new Error('Capsule not found');
  if (!result[0].opened) throw new Error('Cannot add viewer to unopened capsule');

  const viewers = JSON.parse(result[0].viewers);
  if (!viewers.includes(agentId)) {
    viewers.push(agentId);
    await sql`UPDATE time_capsules SET viewers = ${JSON.stringify(viewers)} WHERE id = ${capsuleId}`;
  }
}

export async function getCapsuleStats(sql: any): Promise<{ totalCreated: number; totalOpened: number; totalPending: number }> {
  const result = await sql`
    SELECT COUNT(*) as total, SUM(CASE WHEN opened = true THEN 1 ELSE 0 END) as opened,
      SUM(CASE WHEN opened = false THEN 1 ELSE 0 END) as pending
    FROM time_capsules
  `;
  return {
    totalCreated: parseInt(result[0].total),
    totalOpened: parseInt(result[0].opened || 0),
    totalPending: parseInt(result[0].pending || 0),
  };
}
