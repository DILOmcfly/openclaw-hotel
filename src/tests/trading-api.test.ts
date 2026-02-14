import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { sql } from '../db/index.js';
import { generateToken } from '../services/auth.js';

describe('Trading API Routes', () => {
  let agentId1: string;
  let agentId2: string;
  let roomId: string;
  let token1: string;
  let token2: string;

  beforeEach(async () => {
    // Create test agents
    const [agent1] = await sql`
      INSERT INTO agents (display_name, public_key)
      VALUES ('TestAgent1', decode('aabbccdd', 'hex'))
      RETURNING id
    `;
    agentId1 = agent1.id;
    token1 = generateToken(agentId1);

    const [agent2] = await sql`
      INSERT INTO agents (display_name, public_key)
      VALUES ('TestAgent2', decode('eeff0011', 'hex'))
      RETURNING id
    `;
    agentId2 = agent2.id;
    token2 = generateToken(agentId2);

    // Create test room
    const [room] = await sql`
      INSERT INTO rooms (name, slug, heightmap)
      VALUES ('Test Room', 'test-trading', '000\n000\n000')
      RETURNING id
    `;
    roomId = room.id;

    // Place agents in the same room
    await sql`
      INSERT INTO presence (agent_id, room_id, x, y)
      VALUES (${agentId1}, ${roomId}, 0, 0), (${agentId2}, ${roomId}, 1, 1)
    `;

    // Give agents inventory
    await sql`
      INSERT INTO user_inventory (agent_id, item_def_id, quantity)
      VALUES 
        (${agentId1}, 'chair_wood', 5),
        (${agentId2}, 'lamp_floor', 3)
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

  it('POST /api/trades - should create a trade request', async () => {
    const res = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    expect(res.body.trade).toBeDefined();
    expect(res.body.trade.initiatorId).toBe(agentId1);
    expect(res.body.trade.targetId).toBe(agentId2);
    expect(res.body.trade.status).toBe('pending');
  });

  it('POST /api/trades - should reject if not in same room', async () => {
    // Remove agent2 from room
    await sql`DELETE FROM presence WHERE agent_id = ${agentId2}`;

    const res = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(400);

    expect(res.body.error).toContain('same room');
  });

  it('POST /api/trades - should require authentication', async () => {
    await request(app)
      .post('/api/trades')
      .send({ targetAgentId: agentId2 })
      .expect(401);
  });

  it('GET /api/trades/:id - should get a trade with items', async () => {
    // Create trade
    const createRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    const tradeId = createRes.body.trade.id;

    // Get trade
    const res = await request(app)
      .get(`/api/trades/${tradeId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(res.body.trade).toBeDefined();
    expect(res.body.trade.id).toBe(tradeId);
    expect(res.body.items).toEqual([]);
  });

  it('PUT /api/trades/:id/items - should update offered items', async () => {
    // Create trade
    const createRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    const tradeId = createRes.body.trade.id;

    // Update items
    const res = await request(app)
      .put(`/api/trades/${tradeId}/items`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        items: [
          { itemDefId: 'chair_wood', quantity: 2 },
        ],
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify items were added
    const getRes = await request(app)
      .get(`/api/trades/${tradeId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(getRes.body.items).toHaveLength(1);
    expect(getRes.body.items[0].itemDefId).toBe('chair_wood');
  });

  it('PUT /api/trades/:id/accept - should accept a trade', async () => {
    // Create trade
    const createRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    const tradeId = createRes.body.trade.id;

    // Add items
    await request(app)
      .put(`/api/trades/${tradeId}/items`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ items: [{ itemDefId: 'chair_wood', quantity: 1 }] })
      .expect(200);

    await request(app)
      .put(`/api/trades/${tradeId}/items`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ items: [{ itemDefId: 'lamp_floor', quantity: 1 }] })
      .expect(200);

    // Agent2 accepts
    const res = await request(app)
      .put(`/api/trades/${tradeId}/accept`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify trade status
    const getRes = await request(app)
      .get(`/api/trades/${tradeId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(getRes.body.trade.status).toBe('accepted');
  });

  it('PUT /api/trades/:id/reject - should reject a trade', async () => {
    // Create trade
    const createRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    const tradeId = createRes.body.trade.id;

    // Agent2 rejects
    const res = await request(app)
      .put(`/api/trades/${tradeId}/reject`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify trade status
    const getRes = await request(app)
      .get(`/api/trades/${tradeId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);

    expect(getRes.body.trade.status).toBe('rejected');
  });

  it('PUT /api/trades/:id/cancel - should cancel a trade', async () => {
    // Create trade
    const createRes = await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    const tradeId = createRes.body.trade.id;

    // Agent1 cancels
    const res = await request(app)
      .put(`/api/trades/${tradeId}/cancel`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify trade status
    const getRes = await request(app)
      .get(`/api/trades/${tradeId}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(getRes.body.trade.status).toBe('cancelled');
  });

  it('GET /api/trades/history - should get trade history', async () => {
    // Create some trades
    await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    await request(app)
      .post('/api/trades')
      .set('Authorization', `Bearer ${token1}`)
      .send({ targetAgentId: agentId2 })
      .expect(201);

    // Get history
    const res = await request(app)
      .get('/api/trades/history')
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(res.body.trades).toBeDefined();
    expect(res.body.trades.length).toBeGreaterThanOrEqual(2);
  });
});
