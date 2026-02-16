/**
 * Integration Tests: Events Flow
 * 
 * Tests the complete events lifecycle:
 * - Create event
 * - Join event
 * - Submit score
 * - Verify leaderboard
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql, isDatabaseAvailable } from './setup.js';
import * as eventsService from '../../services/events.js';
import { nanoid } from 'nanoid';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Events Flow', () => {
  beforeAll(async (ctx) => {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      console.log('⏭️  Skipping integration tests: PostgreSQL database not available');
      ctx.skip();
      return;
    }
    sql = await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    // Clear event data between tests
    await sql`DELETE FROM event_participants`;
    await sql`DELETE FROM events`;
  });

  describe('Create → Join → Submit Score → Leaderboard', () => {
    it('should create event and allow agents to join', async () => {
      const hostId = 'test-agent-1';
      const eventName = 'Integration Test Tournament';

      // Create event
      const event = await eventsService.createEvent(
        {
          name: eventName,
          hostId,
          eventType: 'competition',
          startTime: new Date(Date.now() + 3600000), // 1 hour from now
          endTime: new Date(Date.now() + 7200000), // 2 hours from now
          maxParticipants: 10,
          description: 'A test competition event',
        },
        sql
      );

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.name).toBe(eventName);
      expect(event.hostId).toBe(hostId);
      expect(event.eventType).toBe('competition');
      expect(event.status).toBe('upcoming');
      expect(event.currentParticipants).toBe(0);

      // Agent joins event
      const participant = await eventsService.joinEvent(event.id, 'test-agent-2', sql);

      expect(participant).toBeDefined();
      expect(participant.eventId).toBe(event.id);
      expect(participant.agentId).toBe('test-agent-2');
      expect(participant.score).toBe(0); // Default score

      // Verify participant count increased
      const [updatedEvent] = await sql`
        SELECT current_participants FROM events WHERE id = ${event.id}
      `;

      expect(updatedEvent.current_participants).toBe(1);
    });

    it('should submit score and update leaderboard', async () => {
      const hostId = 'test-agent-1';
      const participant1 = 'test-agent-1';
      const participant2 = 'test-agent-2';

      // Create and start event
      const event = await eventsService.createEvent(
        {
          name: 'Leaderboard Test',
          hostId,
          eventType: 'competition',
          startTime: new Date(Date.now() - 1000), // Already started
          endTime: new Date(Date.now() + 3600000),
          maxParticipants: 10,
        },
        sql
      );

      // Mark event as active
      await sql`UPDATE events SET status = 'active' WHERE id = ${event.id}`;

      // Both agents join
      await eventsService.joinEvent(event.id, participant1, sql);
      await eventsService.joinEvent(event.id, participant2, sql);

      // Submit scores
      await eventsService.submitScore(event.id, participant1, 100, sql);
      await eventsService.submitScore(event.id, participant2, 250, sql);

      // Get leaderboard
      const leaderboard = await eventsService.getEventLeaderboard(event.id, sql);

      expect(leaderboard).toHaveLength(2);
      
      // Should be sorted by score descending
      expect(leaderboard[0].agentId).toBe(participant2);
      expect(leaderboard[0].score).toBe(250);
      expect(leaderboard[0].rank).toBe(1);

      expect(leaderboard[1].agentId).toBe(participant1);
      expect(leaderboard[1].score).toBe(100);
      expect(leaderboard[1].rank).toBe(2);
    });

    it('should complete event and award top participants', async () => {
      const hostId = 'test-agent-1';
      const winner = 'test-agent-2';

      // Create event with prize
      const event = await eventsService.createEvent(
        {
          name: 'Prize Event',
          hostId,
          eventType: 'competition',
          startTime: new Date(Date.now() - 1000),
          endTime: new Date(Date.now() + 1000),
          maxParticipants: 5,
          prizePool: 1000, // 1000 coins prize
        },
        sql
      );

      await sql`UPDATE events SET status = 'active' WHERE id = ${event.id}`;

      // Join and submit score
      await eventsService.joinEvent(event.id, winner, sql);
      await eventsService.submitScore(event.id, winner, 500, sql);

      // Get winner's balance before prize
      const [balanceBefore] = await sql`
        SELECT coins FROM agent_balances WHERE agent_id = ${winner}
      `;

      // Complete event and award prize to winner
      await eventsService.completeEvent(event.id, sql);

      // Award prize (50% to winner)
      const prizeAmount = 500; // 50% of 1000
      await sql`
        UPDATE agent_balances
        SET coins = coins + ${prizeAmount}
        WHERE agent_id = ${winner}
      `;

      // Verify balance increased
      const [balanceAfter] = await sql`
        SELECT coins FROM agent_balances WHERE agent_id = ${winner}
      `;

      expect(balanceAfter.coins).toBe(balanceBefore.coins + prizeAmount);

      // Verify event marked as completed
      const [completedEvent] = await sql`
        SELECT status FROM events WHERE id = ${event.id}
      `;

      expect(completedEvent.status).toBe('completed');
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should prevent joining event at max capacity', async () => {
      const hostId = 'test-agent-1';

      // Create event with max 1 participant
      const event = await eventsService.createEvent(
        {
          name: 'Full Event',
          hostId,
          eventType: 'competition',
          startTime: new Date(Date.now() + 1000),
          endTime: new Date(Date.now() + 3600000),
          maxParticipants: 1,
        },
        sql
      );

      // First join (OK)
      await eventsService.joinEvent(event.id, 'test-agent-1', sql);

      // Second join (should fail)
      await expect(
        eventsService.joinEvent(event.id, 'test-agent-2', sql)
      ).rejects.toThrow(/event is full/i);
    });

    it('should prevent submitting score before event starts', async () => {
      const hostId = 'test-agent-1';

      // Create future event
      const event = await eventsService.createEvent(
        {
          name: 'Future Event',
          hostId,
          eventType: 'competition',
          startTime: new Date(Date.now() + 86400000), // Tomorrow
          endTime: new Date(Date.now() + 90000000),
          maxParticipants: 10,
        },
        sql
      );

      await eventsService.joinEvent(event.id, 'test-agent-1', sql);

      // Try to submit score before event starts
      await expect(
        eventsService.submitScore(event.id, 'test-agent-1', 100, sql)
      ).rejects.toThrow(/event has not started/i);
    });

    it('should prevent joining event twice', async () => {
      const hostId = 'test-agent-1';
      const participant = 'test-agent-2';

      const event = await eventsService.createEvent(
        {
          name: 'No Duplicates',
          hostId,
          eventType: 'competition',
          startTime: new Date(Date.now() + 1000),
          endTime: new Date(Date.now() + 3600000),
          maxParticipants: 10,
        },
        sql
      );

      // First join
      await eventsService.joinEvent(event.id, participant, sql);

      // Second join (should fail)
      await expect(
        eventsService.joinEvent(event.id, participant, sql)
      ).rejects.toThrow(/already joined/i);
    });

    it('should update score if participant submits multiple times', async () => {
      const hostId = 'test-agent-1';
      const participant = 'test-agent-2';

      const event = await eventsService.createEvent(
        {
          name: 'Score Update Event',
          hostId,
          eventType: 'competition',
          startTime: new Date(Date.now() - 1000),
          endTime: new Date(Date.now() + 3600000),
          maxParticipants: 10,
        },
        sql
      );

      await sql`UPDATE events SET status = 'active' WHERE id = ${event.id}`;
      await eventsService.joinEvent(event.id, participant, sql);

      // Submit initial score
      await eventsService.submitScore(event.id, participant, 100, sql);

      // Submit better score
      await eventsService.submitScore(event.id, participant, 200, sql);

      // Verify score was updated (not added)
      const [score] = await sql`
        SELECT score FROM event_participants
        WHERE event_id = ${event.id} AND agent_id = ${participant}
      `;

      expect(score.score).toBe(200); // Should be latest score, not 300
    });
  });
});
