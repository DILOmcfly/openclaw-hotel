/**
 * Donations Service - Manages donation boxes and contributions
 */

export type DonationBox = {
  id: number;
  roomId: number | null;
  name: string;
  goal: number;
  collected: number;
  message: string | null;
  createdBy: string;
  active: boolean;
  createdAt: Date;
  progressPercent?: number;
};

export type Donation = {
  id: number;
  boxId: number;
  donorId: string;
  amount: number;
  message: string | null;
  createdAt: Date;
};

export type TopDonor = {
  donorId: string;
  totalAmount: number;
  donationCount: number;
};

export type GlobalStats = {
  totalDonated: number;
  totalBoxes: number;
  activeBoxes: number;
};

export async function createBox(
  roomId: number,
  createdBy: string,
  name: string = 'Donation Box',
  goal: number = 0,
  message: string | null = null,
  sql: any
): Promise<DonationBox> {
  const result = await sql`
    INSERT INTO donation_boxes (room_id, name, goal, message, created_by)
    VALUES (${roomId}, ${name}, ${goal}, ${message}, ${createdBy})
    RETURNING id, room_id AS "roomId", name, goal, collected, message, 
              created_by AS "createdBy", active, created_at AS "createdAt"
  `;
  return result[0];
}

export async function donate(
  boxId: number,
  donorId: string,
  amount: number,
  message: string | null = null,
  sql: any
): Promise<Donation> {
  if (amount < 1) throw new Error('Donation amount must be at least 1 coin');

  const box = await sql`SELECT id, active FROM donation_boxes WHERE id = ${boxId}`;
  if (box.length === 0) throw new Error('Donation box not found');
  if (!box[0].active) throw new Error('Donation box is closed');

  const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${donorId}`;
  if (balance.length === 0 || balance[0].coins < amount) throw new Error('Insufficient coins');

  await sql`UPDATE agent_balances SET coins = coins - ${amount} WHERE agent_id = ${donorId}`;
  await sql`UPDATE donation_boxes SET collected = collected + ${amount} WHERE id = ${boxId}`;

  const result = await sql`
    INSERT INTO donations (box_id, donor_id, amount, message)
    VALUES (${boxId}, ${donorId}, ${amount}, ${message})
    RETURNING id, box_id AS "boxId", donor_id AS "donorId", amount, message, created_at AS "createdAt"
  `;
  return result[0];
}

export async function getBox(boxId: number, sql: any): Promise<DonationBox | null> {
  const result = await sql`
    SELECT id, room_id AS "roomId", name, goal, collected, message,
           created_by AS "createdBy", active, created_at AS "createdAt"
    FROM donation_boxes WHERE id = ${boxId}
  `;
  if (result.length === 0) return null;

  const box = result[0];
  box.progressPercent = box.goal > 0 ? Math.min(100, Math.floor((box.collected / box.goal) * 100)) : 0;
  return box;
}

export async function getTopDonors(boxId: number, limit: number = 10, sql: any): Promise<TopDonor[]> {
  return await sql`
    SELECT donor_id AS "donorId", SUM(amount) AS "totalAmount", COUNT(*) AS "donationCount"
    FROM donations WHERE box_id = ${boxId}
    GROUP BY donor_id ORDER BY "totalAmount" DESC LIMIT ${limit}
  `;
}

export async function getRoomBoxes(roomId: number, sql: any): Promise<DonationBox[]> {
  const result = await sql`
    SELECT id, room_id AS "roomId", name, goal, collected, message,
           created_by AS "createdBy", active, created_at AS "createdAt"
    FROM donation_boxes WHERE room_id = ${roomId} ORDER BY created_at DESC
  `;
  return result.map((box: DonationBox) => ({
    ...box,
    progressPercent: box.goal > 0 ? Math.min(100, Math.floor((box.collected / box.goal) * 100)) : 0,
  }));
}

export async function closeBox(boxId: number, ownerId: string, sql: any): Promise<void> {
  const result = await sql`
    UPDATE donation_boxes SET active = false
    WHERE id = ${boxId} AND created_by = ${ownerId}
  `;
  if (result.count === 0) throw new Error('Box not found or you are not the owner');
}

export async function getAgentDonations(agentId: string, sql: any): Promise<Donation[]> {
  return await sql`
    SELECT id, box_id AS "boxId", donor_id AS "donorId", amount, message, created_at AS "createdAt"
    FROM donations WHERE donor_id = ${agentId} ORDER BY created_at DESC
  `;
}

export async function getGlobalStats(sql: any): Promise<GlobalStats> {
  const result = await sql`
    SELECT COALESCE(SUM(collected), 0) AS "totalDonated",
           COUNT(*) AS "totalBoxes",
           COUNT(*) FILTER (WHERE active = true) AS "activeBoxes"
    FROM donation_boxes
  `;
  return result[0];
}
