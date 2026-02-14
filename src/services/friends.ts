import type { Sql } from 'postgres';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date | null;
};

export type Friend = {
  id: string;
  agentId: string;
  displayName: string;
  isOnline: boolean;
};

/**
 * Send a friend request
 */
export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string,
  sql: Sql
): Promise<Friendship> {
  if (requesterId === addresseeId) {
    throw new Error('Cannot send friend request to yourself');
  }

  // Check if friendship already exists in any direction
  const [existing] = await sql<Friendship[]>`
    SELECT id, requester_id AS "requesterId", addressee_id AS "addresseeId", status, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM friendships
    WHERE (requester_id = ${requesterId} AND addressee_id = ${addresseeId})
       OR (requester_id = ${addresseeId} AND addressee_id = ${requesterId})
  `;

  if (existing) {
    if (existing.status === 'blocked') {
      throw new Error('Cannot send friend request');
    }
    if (existing.status === 'accepted') {
      throw new Error('Already friends');
    }
    throw new Error('Friend request already sent');
  }

  // Create new friendship request
  const [friendship] = await sql<Friendship[]>`
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (${requesterId}, ${addresseeId}, 'pending')
    RETURNING id, requester_id AS "requesterId", addressee_id AS "addresseeId", status, created_at AS "createdAt", updated_at AS "updatedAt"
  `;

  return friendship;
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(
  friendshipId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  const [friendship] = await sql<Friendship[]>`
    SELECT id, requester_id AS "requesterId", addressee_id AS "addresseeId", status
    FROM friendships
    WHERE id = ${friendshipId}
  `;

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  if (friendship.addresseeId !== agentId) {
    throw new Error('Only the addressee can accept the friend request');
  }

  if (friendship.status !== 'pending') {
    throw new Error('Friend request is not pending');
  }

  await sql`
    UPDATE friendships
    SET status = 'accepted', updated_at = NOW()
    WHERE id = ${friendshipId}
  `;
}

/**
 * Reject a friend request (or remove if already accepted)
 */
export async function rejectFriendRequest(
  friendshipId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  const [friendship] = await sql<Friendship[]>`
    SELECT id, requester_id AS "requesterId", addressee_id AS "addresseeId", status
    FROM friendships
    WHERE id = ${friendshipId}
  `;

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  if (friendship.addresseeId !== agentId) {
    throw new Error('Permission denied');
  }

  // Delete the friendship
  await sql`
    DELETE FROM friendships
    WHERE id = ${friendshipId}
  `;
}

/**
 * Remove a friend (works for both requester and addressee)
 */
export async function removeFriend(
  friendshipId: string,
  agentId: string,
  sql: Sql
): Promise<void> {
  const [friendship] = await sql<Friendship[]>`
    SELECT id, requester_id AS "requesterId", addressee_id AS "addresseeId", status
    FROM friendships
    WHERE id = ${friendshipId}
  `;

  if (!friendship) {
    throw new Error('Friendship not found');
  }

  if (friendship.requesterId !== agentId && friendship.addresseeId !== agentId) {
    throw new Error('You are not part of this friendship');
  }

  await sql`
    DELETE FROM friendships
    WHERE id = ${friendshipId}
  `;
}

/**
 * Get all accepted friends for an agent
 */
export async function getFriends(agentId: string, sql: Sql): Promise<Friend[]> {
  const friendships = await sql<any[]>`
    SELECT 
      f.id AS friendship_id,
      CASE 
        WHEN f.requester_id = ${agentId} THEN f.addressee_id
        ELSE f.requester_id
      END AS agent_id,
      a.display_name
    FROM friendships f
    JOIN agents a ON (
      CASE 
        WHEN f.requester_id = ${agentId} THEN f.addressee_id
        ELSE f.requester_id
      END = a.id
    )
    WHERE (f.requester_id = ${agentId} OR f.addressee_id = ${agentId})
      AND f.status = 'accepted'
    ORDER BY a.display_name ASC
  `;

  return friendships.map(f => ({
    id: f.friendship_id,
    agentId: f.agent_id,
    displayName: f.display_name,
    isOnline: false, // Will be populated by WebSocket handler
  }));
}

/**
 * Get pending friend requests received by an agent
 */
export async function getPendingRequests(agentId: string, sql: Sql): Promise<Array<{
  id: string;
  requesterId: string;
  requesterName: string;
  createdAt: Date;
}>> {
  const requests = await sql<any[]>`
    SELECT 
      f.id,
      f.requester_id,
      a.display_name AS requester_name,
      f.created_at
    FROM friendships f
    JOIN agents a ON f.requester_id = a.id
    WHERE f.addressee_id = ${agentId}
      AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `;

  return requests.map(r => ({
    id: r.id,
    requesterId: r.requester_id,
    requesterName: r.requester_name,
    createdAt: r.created_at,
  }));
}

/**
 * Check if two agents are friends
 */
export async function areFriends(agentId1: string, agentId2: string, sql: Sql): Promise<boolean> {
  const [friendship] = await sql`
    SELECT id
    FROM friendships
    WHERE ((requester_id = ${agentId1} AND addressee_id = ${agentId2})
       OR (requester_id = ${agentId2} AND addressee_id = ${agentId1}))
      AND status = 'accepted'
  `;

  return !!friendship;
}
