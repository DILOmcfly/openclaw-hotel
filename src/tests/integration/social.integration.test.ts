/**
 * Integration Tests: Social/Friends Flow
 * 
 * Tests the complete social interaction lifecycle:
 * - Send friend request
 * - Accept/reject friend request
 * - Direct messaging between friends
 * - Unfriend functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql, isDatabaseAvailable } from './setup.js';
import * as friendsService from '../../services/friends.js';
import * as dmService from '../../services/directMessages.js';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Social/Friends Flow', () => {
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
    // Clear friendships and DMs between tests
    await sql`DELETE FROM direct_messages`;
    await sql`DELETE FROM friendships`;
  });

  describe('Friend Request → Accept → Chat Flow', () => {
    it('should send friend request and accept', async () => {
      const requesterId = 'test-agent-1';
      const addresseeId = 'test-agent-2';

      // Send friend request
      const friendship = await friendsService.sendFriendRequest(
        requesterId,
        addresseeId,
        sql
      );

      expect(friendship).toBeDefined();
      expect(friendship.id).toBeDefined();
      expect(friendship.requesterId).toBe(requesterId);
      expect(friendship.addresseeId).toBe(addresseeId);
      expect(friendship.status).toBe('pending');
      expect(friendship.createdAt).toBeInstanceOf(Date);

      // Verify in database
      const [dbFriendship] = await sql`
        SELECT id, requester_id, addressee_id, status
        FROM friendships
        WHERE id = ${friendship.id}
      `;

      expect(dbFriendship).toBeDefined();
      expect(dbFriendship.status).toBe('pending');

      // Accept friend request (as addressee)
      const accepted = await friendsService.acceptFriendRequest(
        friendship.id,
        addresseeId,
        sql
      );

      expect(accepted.status).toBe('accepted');
      expect(accepted.acceptedAt).toBeInstanceOf(Date);

      // Verify both agents see each other as friends
      const requesterFriends = await friendsService.getFriends(requesterId, sql);
      const addresseeFriends = await friendsService.getFriends(addresseeId, sql);

      expect(requesterFriends).toHaveLength(1);
      expect(addresseeFriends).toHaveLength(1);
      expect(requesterFriends[0].friendId).toBe(addresseeId);
      expect(addresseeFriends[0].friendId).toBe(requesterId);
    });

    it('should send direct messages between friends', async () => {
      const agent1 = 'test-agent-1';
      const agent2 = 'test-agent-2';

      // Establish friendship
      const friendship = await friendsService.sendFriendRequest(agent1, agent2, sql);
      await friendsService.acceptFriendRequest(friendship.id, agent2, sql);

      // Send DM from agent1 to agent2
      const message1 = await dmService.sendDirectMessage(
        agent1,
        agent2,
        'Hello friend!',
        sql
      );

      expect(message1).toBeDefined();
      expect(message1.senderId).toBe(agent1);
      expect(message1.recipientId).toBe(agent2);
      expect(message1.content).toBe('Hello friend!');
      expect(message1.readAt).toBeNull();

      // Send reply from agent2
      const message2 = await dmService.sendDirectMessage(
        agent2,
        agent1,
        'Hi there!',
        sql
      );

      expect(message2.senderId).toBe(agent2);
      expect(message2.recipientId).toBe(agent1);

      // Get conversation for agent1
      const conversation = await dmService.getConversation(agent1, agent2, sql);

      expect(conversation).toHaveLength(2);
      expect(conversation[0].content).toBe('Hello friend!');
      expect(conversation[1].content).toBe('Hi there!');

      // Mark message as read
      await dmService.markAsRead(message1.id, agent2, sql);

      const [updatedMessage] = await sql`
        SELECT read_at FROM direct_messages WHERE id = ${message1.id}
      `;
      expect(updatedMessage.read_at).not.toBeNull();
    });

    it('should reject friend request', async () => {
      const requesterId = 'test-agent-1';
      const addresseeId = 'test-agent-2';

      // Send friend request
      const friendship = await friendsService.sendFriendRequest(
        requesterId,
        addresseeId,
        sql
      );

      // Reject (as addressee)
      const rejected = await friendsService.rejectFriendRequest(
        friendship.id,
        addresseeId,
        sql
      );

      expect(rejected.status).toBe('rejected');

      // Verify neither agent sees the other as friend
      const requesterFriends = await friendsService.getFriends(requesterId, sql);
      const addresseeFriends = await friendsService.getFriends(addresseeId, sql);

      expect(requesterFriends).toHaveLength(0);
      expect(addresseeFriends).toHaveLength(0);
    });

    it('should unfriend and remove friendship', async () => {
      const agent1 = 'test-agent-1';
      const agent2 = 'test-agent-2';

      // Establish friendship
      const friendship = await friendsService.sendFriendRequest(agent1, agent2, sql);
      await friendsService.acceptFriendRequest(friendship.id, agent2, sql);

      // Verify friendship exists
      let friends = await friendsService.getFriends(agent1, sql);
      expect(friends).toHaveLength(1);

      // Unfriend (can be initiated by either party)
      await friendsService.removeFriend(friendship.id, agent1, sql);

      // Verify friendship removed
      friends = await friendsService.getFriends(agent1, sql);
      expect(friends).toHaveLength(0);

      const agent2Friends = await friendsService.getFriends(agent2, sql);
      expect(agent2Friends).toHaveLength(0);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should prevent self-friending', async () => {
      await expect(
        friendsService.sendFriendRequest('test-agent-1', 'test-agent-1', sql)
      ).rejects.toThrow(/cannot befriend yourself/i);
    });

    it('should prevent duplicate friend requests', async () => {
      const agent1 = 'test-agent-1';
      const agent2 = 'test-agent-2';

      // Send first request
      await friendsService.sendFriendRequest(agent1, agent2, sql);

      // Try to send duplicate (should fail)
      await expect(
        friendsService.sendFriendRequest(agent1, agent2, sql)
      ).rejects.toThrow(/already exists/i);
    });

    it('should prevent DMs between non-friends', async () => {
      const agent1 = 'test-agent-1';
      const agent2 = 'test-agent-2';

      // Try to send DM without friendship
      await expect(
        dmService.sendDirectMessage(agent1, agent2, 'Unauthorized message', sql)
      ).rejects.toThrow(/not friends/i);
    });

    it('should only allow addressee to accept friend request', async () => {
      const agent1 = 'test-agent-1';
      const agent2 = 'test-agent-2';

      const friendship = await friendsService.sendFriendRequest(agent1, agent2, sql);

      // Requester tries to accept their own request (should fail)
      await expect(
        friendsService.acceptFriendRequest(friendship.id, agent1, sql)
      ).rejects.toThrow(/only the addressee can accept/i);
    });
  });
});
