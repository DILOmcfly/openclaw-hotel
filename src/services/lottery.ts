/**
 * Lottery Service - Manages agent lottery tickets and drawings
 */

export type Lottery = {
  id: number;
  name: string;
  ticketPrice: number;
  prizePool: number;
  status: 'open' | 'drawing' | 'completed';
  winnerId: string | null;
  winningNumber: number | null;
  drawAt: Date | null;
  createdAt: Date;
};

export type LotteryTicket = {
  id: number;
  lotteryId: number;
  agentId: string;
  ticketNumber: number;
  purchasedAt: Date;
};

const WINNER_SHARE = 0.8;
const HOUSE_SHARE = 0.2;

export async function createLottery(
  name: string,
  ticketPrice: number,
  drawAt: Date | null,
  sql: any
): Promise<Lottery> {
  const result = await sql`
    INSERT INTO lotteries (name, ticket_price, draw_at)
    VALUES (${name}, ${ticketPrice}, ${drawAt})
    RETURNING id, name, ticket_price AS "ticketPrice", prize_pool AS "prizePool", 
      status, winner_id AS "winnerId", winning_number AS "winningNumber", 
      draw_at AS "drawAt", created_at AS "createdAt"
  `;
  return result[0];
}

export async function buyTicket(lotteryId: number, agentId: string, sql: any): Promise<LotteryTicket> {
  const lottery = await sql`SELECT id, status, ticket_price AS "ticketPrice" FROM lotteries WHERE id = ${lotteryId}`;
  if (lottery.length === 0) throw new Error('Lottery not found');
  if (lottery[0].status !== 'open') throw new Error('Lottery is not accepting tickets');

  const ticketPrice = lottery[0].ticketPrice;
  const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${agentId}`;
  if (balance.length === 0 || balance[0].coins < ticketPrice) throw new Error('Insufficient coins');

  const takenTickets = await sql`SELECT ticket_number FROM lottery_tickets WHERE lottery_id = ${lotteryId}`;
  const takenNumbers = new Set(takenTickets.map((t: any) => t.ticket_number));

  let ticketNumber: number;
  let attempts = 0;
  do {
    ticketNumber = Math.floor(Math.random() * 1000) + 1;
    attempts++;
    if (attempts > 100) throw new Error('No available ticket numbers');
  } while (takenNumbers.has(ticketNumber));

  await sql`UPDATE agent_balances SET coins = coins - ${ticketPrice} WHERE agent_id = ${agentId}`;
  await sql`UPDATE lotteries SET prize_pool = prize_pool + ${ticketPrice} WHERE id = ${lotteryId}`;

  const ticket = await sql`
    INSERT INTO lottery_tickets (lottery_id, agent_id, ticket_number)
    VALUES (${lotteryId}, ${agentId}, ${ticketNumber})
    RETURNING id, lottery_id AS "lotteryId", agent_id AS "agentId", 
      ticket_number AS "ticketNumber", purchased_at AS "purchasedAt"
  `;
  return ticket[0];
}

export async function getActiveLottery(sql: any): Promise<Lottery | null> {
  const result = await sql`
    SELECT id, name, ticket_price AS "ticketPrice", prize_pool AS "prizePool", 
      status, winner_id AS "winnerId", winning_number AS "winningNumber", 
      draw_at AS "drawAt", created_at AS "createdAt"
    FROM lotteries WHERE status = 'open' ORDER BY created_at DESC LIMIT 1
  `;
  return result.length > 0 ? result[0] : null;
}

export async function getTickets(lotteryId: number, agentId: string, sql: any): Promise<LotteryTicket[]> {
  return await sql`
    SELECT id, lottery_id AS "lotteryId", agent_id AS "agentId", 
      ticket_number AS "ticketNumber", purchased_at AS "purchasedAt"
    FROM lottery_tickets WHERE lottery_id = ${lotteryId} AND agent_id = ${agentId}
    ORDER BY purchased_at ASC
  `;
}

export async function draw(lotteryId: number, sql: any): Promise<Lottery> {
  const lottery = await sql`SELECT id, status, prize_pool AS "prizePool" FROM lotteries WHERE id = ${lotteryId}`;
  if (lottery.length === 0) throw new Error('Lottery not found');
  if (lottery[0].status !== 'open') throw new Error('Lottery already drawn');

  const prizePool = lottery[0].prizePool;
  const tickets = await sql`SELECT ticket_number, agent_id FROM lottery_tickets WHERE lottery_id = ${lotteryId}`;

  if (tickets.length === 0) {
    await sql`UPDATE lotteries SET status = 'completed' WHERE id = ${lotteryId}`;
  } else {
    const winningTicket = tickets[Math.floor(Math.random() * tickets.length)];
    const winningNumber = winningTicket.ticket_number;
    const winnerId = winningTicket.agent_id;
    const winnerPrize = Math.floor(prizePool * WINNER_SHARE);

    if (winnerPrize > 0) {
      await sql`UPDATE agent_balances SET coins = coins + ${winnerPrize} WHERE agent_id = ${winnerId}`;
    }

    await sql`
      UPDATE lotteries SET status = 'completed', winner_id = ${winnerId}, winning_number = ${winningNumber}
      WHERE id = ${lotteryId}
    `;
  }

  const result = await sql`
    SELECT id, name, ticket_price AS "ticketPrice", prize_pool AS "prizePool", 
      status, winner_id AS "winnerId", winning_number AS "winningNumber", 
      draw_at AS "drawAt", created_at AS "createdAt"
    FROM lotteries WHERE id = ${lotteryId}
  `;
  return result[0];
}

export async function getLotteryHistory(limit: number, sql: any): Promise<Lottery[]> {
  return await sql`
    SELECT id, name, ticket_price AS "ticketPrice", prize_pool AS "prizePool", 
      status, winner_id AS "winnerId", winning_number AS "winningNumber", 
      draw_at AS "drawAt", created_at AS "createdAt"
    FROM lotteries WHERE status = 'completed' ORDER BY created_at DESC LIMIT ${limit}
  `;
}

export async function getAgentWinnings(agentId: string, sql: any): Promise<number> {
  const result = await sql`
    SELECT COALESCE(SUM(FLOOR(prize_pool * ${WINNER_SHARE})), 0) AS total
    FROM lotteries WHERE winner_id = ${agentId} AND status = 'completed'
  `;
  return result[0]?.total || 0;
}
