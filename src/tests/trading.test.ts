import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  createTrade,
  getTrade,
  getTradeItems,
  updateTradeItems,
  acceptTrade,
  rejectTrade,
  cancelTrade,
  getTradeHistory,
  validateSameRoom,
  checkRateLimit,
} from '../services/trading.js';
import { sql } from '../db/index.js';
import { randomUUID } from 'node:crypto';

describe('Trading Service', () => {
  let agentId1: string;
  let agentId2: string;
  let roomId: string;

  beforeEach(async () => {
    // Create test agents
    const [agent1] = await sql`
      INSERT INTO agents (display_name, public_key)
      VALUES ('TestAgent1', decode('00112233', 'hex'))
      RETURNING id
    `;
    agentId1 = agent1.id;

    const [agent2] = await sql`
      INSERT INTO agents (display_name, public_key)
      VALUES ('TestAgent2', decode('44556677', 'hex'))
      RETURNING id
    `;
    agentId2 = agent2.id;

    // Create test room
    const [room] = await sql`
      INSERT INTO rooms (name, slug, heightmap)
      VALUES ('Test Room', 'test', '000\n000\n000')
      RETURNING id
    `;
    roomId = room.id;

    // Place agents in the same room
    await sql`
      INSERT INTO presence (agent_id, room_id, x, y)
      VALUES (${agentId1}, ${roomId}, 0, 0), (${agentId2}, ${roomId}, 1, 1)
    `;

    // Give agents some inventory
    await sql`
      INSERT INTO user_inventory (agent_id, item_def_id, quantity)
      VALUES 
        (${agentId1}, 'chair_wood', 5),
        (${agentId1}, 'table_round', 2),
        (${agentId2}, 'lamp_floor', 3),
        (${agentId2}, 'plant_pot', 1)
    `;
  });

  afterEach(async () => {
    // Cleanup
    await sql`DELETE FROM trade_items WHERE trade_id IN (SELECT id FROM trades WHERE initiator_id = ${agentId1} OR target_id = ${agentId1})`;
    await sql`DELETE FROM trades WHERE initiator_id = ${agentId1} OR target_id = ${agentId1}`;
    await sql`DELETE FROM user_inventory WHERE agent_id IN (${agentId1}, ${agentId2})`;
    await sql`DELETE FROM presence WHERE agent_id IN (${agentId1}, ${agentId2})`;
    await sql`DELETE FROM agents WHERE id IN (${agentId1}, ${agentId2})`;
    await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  });

  it('should create a trade request', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    expect(trade).toBeDefined();
    expect(trade.initiatorId).toBe(agentId1);
    expect(trade.targetId).toBe(agentId2);
    expect(trade.status).toBe('pending');
  });

  it('should prevent self-trading', async () => {
    await expect(createTrade(agentId1, agentId1, sql)).rejects.toThrow('Cannot trade with yourself');
  });

  it('should enforce rate limiting', async () => {
    // Create 5 trades (max limit)
    for (let i = 0; i < 5; i++) {
      await createTrade(agentId1, agentId2, sql);
    }

    // 6th trade should fail
    await expect(createTrade(agentId1, agentId2, sql)).rejects.toThrow('rate limit');
  });

  it('should get a trade by ID', async () => {
    const created = await createTrade(agentId1, agentId2, sql);
    const fetched = await getTrade(created.id, sql);
    
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.initiatorId).toBe(agentId1);
  });

  it('should update trade items', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    const items = [
      { itemDefId: 'chair_wood', quantity: 2 },
      { itemDefId: 'table_round', quantity: 1 },
    ];
    
    await updateTradeItems(trade.id, agentId1, items, sql);
    
    const tradeItems = await getTradeItems(trade.id, sql);
    expect(tradeItems).toHaveLength(2);
    expect(tradeItems[0].itemDefId).toBe('chair_wood');
    expect(tradeItems[0].quantity).toBe(2);
  });

  it('should reject updating items not in inventory', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    const items = [
      { itemDefId: 'chair_wood', quantity: 10 }, // Only have 5
    ];
    
    await expect(updateTradeItems(trade.id, agentId1, items, sql)).rejects.toThrow('Insufficient');
  });

  it('should accept a trade and transfer items atomically', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    // Agent1 offers 2 chairs
    await updateTradeItems(trade.id, agentId1, [
      { itemDefId: 'chair_wood', quantity: 2 },
    ], sql);
    
    // Agent2 offers 1 lamp
    await updateTradeItems(trade.id, agentId2, [
      { itemDefId: 'lamp_floor', quantity: 1 },
    ], sql);
    
    // Agent2 accepts
    await acceptTrade(trade.id, agentId2, sql);
    
    // Verify inventories updated
    const [agent1Chairs] = await sql`
      SELECT quantity FROM user_inventory 
      WHERE agent_id = ${agentId1} AND item_def_id = 'chair_wood'
    `;
    expect(agent1Chairs.quantity).toBe(3); // 5 - 2 = 3
    
    const [agent1Lamps] = await sql`
      SELECT quantity FROM user_inventory 
      WHERE agent_id = ${agentId1} AND item_def_id = 'lamp_floor'
    `;
    expect(agent1Lamps.quantity).toBe(1); // Received 1
    
    const [agent2Lamps] = await sql`
      SELECT quantity FROM user_inventory 
      WHERE agent_id = ${agentId2} AND item_def_id = 'lamp_floor'
    `;
    expect(agent2Lamps.quantity).toBe(2); // 3 - 1 = 2
    
    const [agent2Chairs] = await sql`
      SELECT quantity FROM user_inventory 
      WHERE agent_id = ${agentId2} AND item_def_id = 'chair_wood'
    `;
    expect(agent2Chairs.quantity).toBe(2); // Received 2
    
    // Verify trade status
    const updatedTrade = await getTrade(trade.id, sql);
    expect(updatedTrade?.status).toBe('accepted');
  });

  it('should only allow target to accept trade', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    await expect(acceptTrade(trade.id, agentId1, sql)).rejects.toThrow('Only the target');
  });

  it('should reject a trade', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    await rejectTrade(trade.id, agentId2, sql);
    
    const updatedTrade = await getTrade(trade.id, sql);
    expect(updatedTrade?.status).toBe('rejected');
  });

  it('should only allow target to reject trade', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    await expect(rejectTrade(trade.id, agentId1, sql)).rejects.toThrow('Only the target');
  });

  it('should cancel a trade', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    await cancelTrade(trade.id, agentId1, sql);
    
    const updatedTrade = await getTrade(trade.id, sql);
    expect(updatedTrade?.status).toBe('cancelled');
  });

  it('should only allow initiator to cancel trade', async () => {
    const trade = await createTrade(agentId1, agentId2, sql);
    
    await expect(cancelTrade(trade.id, agentId2, sql)).rejects.toThrow('Only the initiator');
  });

  it('should get trade history', async () => {
    await createTrade(agentId1, agentId2, sql);
    await createTrade(agentId1, agentId2, sql);
    
    const history = await getTradeHistory(agentId1, sql);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate agents in same room', async () => {
    const result = await validateSameRoom(agentId1, agentId2, sql);
    expect(result).toBe(roomId);
  });

  it('should return null for agents not in same room', async () => {
    // Remove agent2 from room
    await sql`DELETE FROM presence WHERE agent_id = ${agentId2}`;
    
    const result = await validateSameRoom(agentId1, agentId2, sql);
    expect(result).toBeNull();
  });
});
