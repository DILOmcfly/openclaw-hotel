import type { Sql } from 'postgres';
import { randomUUID } from 'crypto';

export type Poll = {
  id: string;
  roomId: string;
  creatorId: string;
  question: string;
  options: string[];
  expiresAt: Date | null;
  closed: boolean;
  createdAt: Date;
};

export type PollResults = {
  id: string;
  question: string;
  options: Array<{
    text: string;
    votes: number;
  }>;
  totalVotes: number;
  winner: number | null;
  closed: boolean;
  expiresAt: Date | null;
};

export type Vote = {
  pollId: string;
  agentId: string;
  optionIndex: number;
  votedAt: Date;
};

/**
 * Create a new poll in a room
 */
export async function createPoll(
  roomId: string,
  creatorId: string,
  question: string,
  options: string[],
  durationSecs: number | null,
  sql: Sql
): Promise<Poll> {
  // Validate question length
  if (!question || question.trim().length === 0) {
    throw new Error('Question is required');
  }
  if (question.length > 200) {
    throw new Error('Question must be 200 characters or less');
  }

  // Validate options
  if (!options || options.length < 2) {
    throw new Error('At least 2 options are required');
  }
  if (options.length > 6) {
    throw new Error('Maximum 6 options allowed');
  }
  if (options.some(opt => !opt || opt.trim().length === 0)) {
    throw new Error('All options must have text');
  }

  const id = randomUUID();
  const expiresAt = durationSecs
    ? new Date(Date.now() + durationSecs * 1000)
    : null;

  const [poll] = await sql<any[]>`
    INSERT INTO room_polls (id, room_id, creator_id, question, options, expires_at)
    VALUES (
      ${id},
      ${roomId},
      ${creatorId},
      ${question},
      ${JSON.stringify(options)},
      ${expiresAt}
    )
    RETURNING 
      id, 
      room_id AS "roomId", 
      creator_id AS "creatorId",
      question,
      options,
      expires_at AS "expiresAt",
      closed,
      created_at AS "createdAt"
  `;

  return {
    ...poll,
    options: poll.options,
  };
}

/**
 * Cast a vote on a poll
 */
export async function vote(
  pollId: string,
  agentId: string,
  optionIndex: number,
  sql: Sql
): Promise<void> {
  // Get poll to validate
  const [poll] = await sql<any[]>`
    SELECT id, options, closed, expires_at AS "expiresAt"
    FROM room_polls
    WHERE id = ${pollId}
  `;

  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.closed) {
    throw new Error('Poll is closed');
  }

  if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
    throw new Error('Poll has expired');
  }

  const options = poll.options;
  if (optionIndex < 0 || optionIndex >= options.length) {
    throw new Error('Invalid option index');
  }

  // Check if already voted
  const [existingVote] = await sql`
    SELECT poll_id FROM poll_votes
    WHERE poll_id = ${pollId} AND agent_id = ${agentId}
  `;

  if (existingVote) {
    throw new Error('You have already voted on this poll');
  }

  // Record vote
  await sql`
    INSERT INTO poll_votes (poll_id, agent_id, option_index)
    VALUES (${pollId}, ${agentId}, ${optionIndex})
  `;
}

/**
 * Get poll results with vote counts
 */
export async function getPollResults(pollId: string, sql: Sql): Promise<PollResults> {
  const [poll] = await sql<any[]>`
    SELECT 
      id,
      question,
      options,
      closed,
      expires_at AS "expiresAt"
    FROM room_polls
    WHERE id = ${pollId}
  `;

  if (!poll) {
    throw new Error('Poll not found');
  }

  // Get vote counts per option
  const votes = await sql<Array<{ option_index: number; count: number }>>`
    SELECT option_index, COUNT(*)::int AS count
    FROM poll_votes
    WHERE poll_id = ${pollId}
    GROUP BY option_index
  `;

  const voteCounts = new Map(votes.map(v => [v.option_index, v.count]));
  const options = poll.options.map((text: string, index: number) => ({
    text,
    votes: voteCounts.get(index) || 0,
  }));

  const totalVotes = options.reduce((sum: number, opt: any) => sum + opt.votes, 0);
  
  // Determine winner (highest vote count, null if tie or no votes)
  let winner: number | null = null;
  if (totalVotes > 0) {
    const maxVotes = Math.max(...options.map((o: any) => o.votes));
    const winners = options
      .map((opt: any, idx: number) => ({ idx, votes: opt.votes }))
      .filter((o: any) => o.votes === maxVotes);
    
    // Only set winner if there's a clear winner (no tie)
    if (winners.length === 1) {
      winner = winners[0].idx;
    }
  }

  return {
    id: poll.id,
    question: poll.question,
    options,
    totalVotes,
    winner,
    closed: poll.closed,
    expiresAt: poll.expiresAt,
  };
}

/**
 * Get active polls for a room (not closed and not expired)
 */
export async function getActivePolls(roomId: string, sql: Sql): Promise<Poll[]> {
  const polls = await sql<any[]>`
    SELECT 
      id,
      room_id AS "roomId",
      creator_id AS "creatorId",
      question,
      options,
      expires_at AS "expiresAt",
      closed,
      created_at AS "createdAt"
    FROM room_polls
    WHERE room_id = ${roomId}
      AND closed = false
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
  `;

  return polls.map(p => ({
    ...p,
    options: p.options,
  }));
}

/**
 * Manually close a poll (creator only)
 */
export async function closePoll(
  pollId: string,
  creatorId: string,
  sql: Sql
): Promise<void> {
  const [poll] = await sql<any[]>`
    SELECT id, creator_id AS "creatorId", closed
    FROM room_polls
    WHERE id = ${pollId}
  `;

  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.creatorId !== creatorId) {
    throw new Error('Only the poll creator can close it');
  }

  if (poll.closed) {
    throw new Error('Poll is already closed');
  }

  await sql`
    UPDATE room_polls
    SET closed = true
    WHERE id = ${pollId}
  `;
}
