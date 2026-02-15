/**
 * Puzzles Service - Manages collaborative room puzzles
 */

export type Puzzle = {
  id: number; roomId: number; title: string;
  puzzleType: 'word' | 'math' | 'logic' | 'pattern' | 'trivia';
  answer: string; hint: string | null; maxAttempts: number; rewardCoins: number;
  status: 'active' | 'solved' | 'expired'; solvedBy: string | null;
  solvedAt: Date | null; createdBy: string; createdAt: Date;
};

export type PuzzleAttempt = {
  id: number; puzzleId: number; agentId: string;
  guess: string; correct: boolean; attemptedAt: Date;
};

export async function createPuzzle(
  roomId: number, agentId: string, title: string, puzzleType: string,
  answer: string, hint: string | null, maxAttempts: number, rewardCoins: number, sql: any
): Promise<Puzzle> {
  const result = await sql`
    INSERT INTO room_puzzles (room_id, title, puzzle_type, answer, hint, max_attempts, reward_coins, created_by)
    VALUES (${roomId}, ${title}, ${puzzleType}, ${answer}, ${hint}, ${maxAttempts}, ${rewardCoins}, ${agentId})
    RETURNING id, room_id AS "roomId", title, puzzle_type AS "puzzleType", answer, hint,
      max_attempts AS "maxAttempts", reward_coins AS "rewardCoins", status,
      solved_by AS "solvedBy", solved_at AS "solvedAt", created_by AS "createdBy", created_at AS "createdAt"
  `;
  return result[0];
}

export async function submitGuess(
  puzzleId: number, agentId: string, guess: string, sql: any
): Promise<{ correct: boolean; reward: number; message: string }> {
  const puzzleResult = await sql`
    SELECT id, answer, status, max_attempts AS "maxAttempts", reward_coins AS "rewardCoins"
    FROM room_puzzles WHERE id = ${puzzleId}
  `;
  if (puzzleResult.length === 0) throw new Error('Puzzle not found');

  const puzzle = puzzleResult[0];
  if (puzzle.status !== 'active') return { correct: false, reward: 0, message: 'Puzzle is not active' };

  const attemptCount = await sql`SELECT COUNT(*) as count FROM puzzle_attempts WHERE puzzle_id = ${puzzleId}`;
  if (parseInt(attemptCount[0].count) >= puzzle.maxAttempts) {
    await sql`UPDATE room_puzzles SET status = 'expired' WHERE id = ${puzzleId}`;
    return { correct: false, reward: 0, message: 'Max attempts reached' };
  }

  const correct = guess.trim().toLowerCase() === puzzle.answer.trim().toLowerCase();
  await sql`INSERT INTO puzzle_attempts (puzzle_id, agent_id, guess, correct)
    VALUES (${puzzleId}, ${agentId}, ${guess}, ${correct})`;

  if (correct) {
    await sql`UPDATE room_puzzles SET status = 'solved', solved_by = ${agentId}, solved_at = NOW()
      WHERE id = ${puzzleId}`;
    await sql`UPDATE agent_balances SET coins = coins + ${puzzle.rewardCoins} WHERE agent_id = ${agentId}`;
    return { correct: true, reward: puzzle.rewardCoins, message: 'Correct! Puzzle solved!' };
  }
  return { correct: false, reward: 0, message: 'Incorrect guess' };
}

export async function getHint(puzzleId: number, sql: any): Promise<string | null> {
  const failedAttempts = await sql`
    SELECT COUNT(*) as count FROM puzzle_attempts WHERE puzzle_id = ${puzzleId} AND correct = false
  `;
  if (parseInt(failedAttempts[0].count) < 3) return null;
  const result = await sql`SELECT hint FROM room_puzzles WHERE id = ${puzzleId}`;
  return result[0]?.hint || null;
}

export async function getPuzzle(puzzleId: number, sql: any): Promise<Puzzle | null> {
  const result = await sql`
    SELECT id, room_id AS "roomId", title, puzzle_type AS "puzzleType",
      CASE WHEN status = 'solved' THEN answer ELSE NULL END as answer, hint,
      max_attempts AS "maxAttempts", reward_coins AS "rewardCoins", status,
      solved_by AS "solvedBy", solved_at AS "solvedAt", created_by AS "createdBy", created_at AS "createdAt"
    FROM room_puzzles WHERE id = ${puzzleId}
  `;
  return result[0] || null;
}

export async function getRoomPuzzles(roomId: number, sql: any): Promise<Puzzle[]> {
  return await sql`
    SELECT id, room_id AS "roomId", title, puzzle_type AS "puzzleType",
      CASE WHEN status = 'solved' THEN answer ELSE NULL END as answer, hint,
      max_attempts AS "maxAttempts", reward_coins AS "rewardCoins", status,
      solved_by AS "solvedBy", solved_at AS "solvedAt", created_by AS "createdBy", created_at AS "createdAt"
    FROM room_puzzles WHERE room_id = ${roomId} ORDER BY created_at DESC
  `;
}

export async function getAgentSolvedPuzzles(agentId: string, sql: any): Promise<Puzzle[]> {
  return await sql`
    SELECT id, room_id AS "roomId", title, puzzle_type AS "puzzleType", answer, hint,
      max_attempts AS "maxAttempts", reward_coins AS "rewardCoins", status,
      solved_by AS "solvedBy", solved_at AS "solvedAt", created_by AS "createdBy", created_at AS "createdAt"
    FROM room_puzzles WHERE solved_by = ${agentId} ORDER BY solved_at DESC
  `;
}

export async function getPuzzleStats(sql: any): Promise<{
  totalCreated: number; solvedPercentage: number; avgAttemptsToSolve: number;
}> {
  const totalResult = await sql`SELECT COUNT(*) as count FROM room_puzzles`;
  const solvedResult = await sql`SELECT COUNT(*) as count FROM room_puzzles WHERE status = 'solved'`;
  const totalCreated = parseInt(totalResult[0].count);
  const totalSolved = parseInt(solvedResult[0].count);
  const solvedPercentage = totalCreated > 0 ? (totalSolved / totalCreated) * 100 : 0;

  const avgResult = await sql`
    SELECT AVG(attempt_count) as avg FROM (
      SELECT puzzle_id, COUNT(*) as attempt_count FROM puzzle_attempts
      WHERE puzzle_id IN (SELECT id FROM room_puzzles WHERE status = 'solved')
      GROUP BY puzzle_id
    ) subquery
  `;
  const avgAttemptsToSolve = parseFloat(avgResult[0]?.avg || '0');
  return { totalCreated, solvedPercentage, avgAttemptsToSolve };
}

export async function getLeaderboard(limit: number, sql: any): Promise<Array<{
  agentId: string; puzzlesSolved: number;
}>> {
  return await sql`
    SELECT solved_by AS "agentId", COUNT(*) as "puzzlesSolved"
    FROM room_puzzles WHERE status = 'solved' AND solved_by IS NOT NULL
    GROUP BY solved_by ORDER BY COUNT(*) DESC LIMIT ${limit}
  `;
}
