/**
 * Room Decoration Contests Service
 * Manages contests where room owners compete and spectators vote
 */

export type DecorationContest = {
  id: string;
  title: string;
  theme: string;
  status: 'open' | 'voting' | 'ended';
  entriesCloseAt: string;
  votingCloseAt: string;
  createdBy: string;
  createdAt: string;
};

export type ContestEntry = {
  contestId: string;
  roomId: string;
  ownerId: string;
  submittedAt: string;
};

export type ContestVote = {
  contestId: string;
  voterId: string;
  roomId: string;
  score: number;
  votedAt: string;
};

export type ContestResult = {
  roomId: string;
  ownerId: string;
  averageScore: number;
  voteCount: number;
  submittedAt: string;
};

/**
 * Create a new contest
 */
export async function createContest(
  title: string,
  theme: string,
  entriesCloseAt: Date,
  votingCloseAt: Date,
  createdBy: string,
  sql: any
): Promise<DecorationContest> {
  const id = crypto.randomUUID();
  
  await sql`
    INSERT INTO decoration_contests (
      id, title, theme, entries_close_at, voting_close_at, created_by
    )
    VALUES (
      ${id}, ${title}, ${theme}, ${entriesCloseAt.toISOString()}, 
      ${votingCloseAt.toISOString()}, ${createdBy}
    )
  `;

  const rows = await sql`
    SELECT
      id,
      title,
      theme,
      status,
      entries_close_at AS "entriesCloseAt",
      voting_close_at AS "votingCloseAt",
      created_by AS "createdBy",
      created_at AS "createdAt"
    FROM decoration_contests
    WHERE id = ${id}
  `;

  return rows[0];
}

/**
 * Enter a contest with a room
 * Only allowed during 'open' status, max 1 entry per agent
 */
export async function enterContest(
  contestId: string,
  roomId: string,
  ownerId: string,
  sql: any
): Promise<{ success: boolean; error?: string }> {
  // Check contest status
  const contests = await sql`
    SELECT status FROM decoration_contests WHERE id = ${contestId}
  `;

  if (contests.length === 0) {
    return { success: false, error: 'Contest not found' };
  }

  if (contests[0].status !== 'open') {
    return { success: false, error: 'Contest is not open for entries' };
  }

  // Check if agent already has an entry
  const existingEntries = await sql`
    SELECT 1 FROM contest_entries
    WHERE contest_id = ${contestId} AND owner_id = ${ownerId}
  `;

  if (existingEntries.length > 0) {
    return { success: false, error: 'Agent already has an entry in this contest' };
  }

  // Create entry
  await sql`
    INSERT INTO contest_entries (contest_id, room_id, owner_id)
    VALUES (${contestId}, ${roomId}, ${ownerId})
  `;

  return { success: true };
}

/**
 * Vote for a room in a contest
 * Only during 'voting' status, can't vote for own room
 */
export async function vote(
  contestId: string,
  voterId: string,
  roomId: string,
  score: number,
  sql: any
): Promise<{ success: boolean; error?: string }> {
  // Validate score
  if (score < 1 || score > 5) {
    return { success: false, error: 'Score must be between 1 and 5' };
  }

  // Check contest status
  const contests = await sql`
    SELECT status FROM decoration_contests WHERE id = ${contestId}
  `;

  if (contests.length === 0) {
    return { success: false, error: 'Contest not found' };
  }

  if (contests[0].status !== 'voting') {
    return { success: false, error: 'Contest is not open for voting' };
  }

  // Check if room is in contest
  const entries = await sql`
    SELECT owner_id AS "ownerId" FROM contest_entries
    WHERE contest_id = ${contestId} AND room_id = ${roomId}
  `;

  if (entries.length === 0) {
    return { success: false, error: 'Room is not entered in this contest' };
  }

  // Prevent self-voting
  if (entries[0].ownerId === voterId) {
    return { success: false, error: 'Cannot vote for your own room' };
  }

  // Insert or update vote
  await sql`
    INSERT INTO contest_votes (contest_id, voter_id, room_id, score)
    VALUES (${contestId}, ${voterId}, ${roomId}, ${score})
    ON CONFLICT (contest_id, voter_id)
    DO UPDATE SET room_id = ${roomId}, score = ${score}, voted_at = NOW()
  `;

  return { success: true };
}

/**
 * Get contest results sorted by average score
 */
export async function getResults(contestId: string, sql: any): Promise<ContestResult[]> {
  const rows = await sql`
    SELECT
      ce.room_id AS "roomId",
      ce.owner_id AS "ownerId",
      COALESCE(AVG(cv.score), 0) AS "averageScore",
      COUNT(cv.voter_id) AS "voteCount",
      ce.submitted_at AS "submittedAt"
    FROM contest_entries ce
    LEFT JOIN contest_votes cv ON ce.contest_id = cv.contest_id AND ce.room_id = cv.room_id
    WHERE ce.contest_id = ${contestId}
    GROUP BY ce.room_id, ce.owner_id, ce.submitted_at
    ORDER BY "averageScore" DESC, "voteCount" DESC, ce.submitted_at ASC
  `;

  return rows;
}

/**
 * Advance contest status: open → voting → ended
 */
export async function advanceStatus(
  contestId: string,
  sql: any
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
  const contests = await sql`
    SELECT status FROM decoration_contests WHERE id = ${contestId}
  `;

  if (contests.length === 0) {
    return { success: false, error: 'Contest not found' };
  }

  const currentStatus = contests[0].status;
  let newStatus: string;

  switch (currentStatus) {
    case 'open':
      newStatus = 'voting';
      break;
    case 'voting':
      newStatus = 'ended';
      break;
    case 'ended':
      return { success: false, error: 'Contest has already ended' };
    default:
      return { success: false, error: 'Invalid contest status' };
  }

  await sql`
    UPDATE decoration_contests
    SET status = ${newStatus}
    WHERE id = ${contestId}
  `;

  return { success: true, newStatus };
}

/**
 * Get active contests (not ended)
 */
export async function getActiveContests(sql: any): Promise<DecorationContest[]> {
  const rows = await sql`
    SELECT
      id,
      title,
      theme,
      status,
      entries_close_at AS "entriesCloseAt",
      voting_close_at AS "votingCloseAt",
      created_by AS "createdBy",
      created_at AS "createdAt"
    FROM decoration_contests
    WHERE status IN ('open', 'voting')
    ORDER BY created_at DESC
  `;

  return rows;
}
