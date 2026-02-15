/** Room Challenges Service - Manages timed challenges with rewards */

export type Challenge = {
  id: number; roomId: number; title: string; description: string;
  challengeType: 'speed' | 'collection' | 'social' | 'creative' | 'puzzle';
  targetValue: number; rewardCoins: number; timeLimitSeconds: number; maxParticipants: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdBy: string; startedAt: Date | null; endsAt: Date | null; createdAt: Date;
};

export type Participant = {
  challengeId: number; agentId: string; progress: number; completed: boolean;
  completedAt: Date | null; joinedAt: Date;
};

export async function createChallenge(
  roomId: number, createdBy: string,
  data: { title: string; description?: string; challengeType: Challenge['challengeType'];
    targetValue?: number; rewardCoins?: number; timeLimitSeconds?: number; maxParticipants?: number; },
  sql: any
): Promise<Challenge> {
  const result = await sql`
    INSERT INTO room_challenges (
      room_id, title, description, challenge_type, target_value,
      reward_coins, time_limit_seconds, max_participants, created_by
    )
    VALUES (
      ${roomId}, ${data.title}, ${data.description || ''},
      ${data.challengeType}, ${data.targetValue || 10},
      ${data.rewardCoins || 100}, ${data.timeLimitSeconds || 300},
      ${data.maxParticipants || 20}, ${createdBy}
    )
    RETURNING id, room_id AS "roomId", title, description,
      challenge_type AS "challengeType", target_value AS "targetValue",
      reward_coins AS "rewardCoins", time_limit_seconds AS "timeLimitSeconds",
      max_participants AS "maxParticipants", status, created_by AS "createdBy",
      started_at AS "startedAt", ends_at AS "endsAt", created_at AS "createdAt"
  `;
  return result[0];
}

export async function startChallenge(challengeId: number, sql: any): Promise<Challenge> {
  const challenge = await getChallenge(challengeId, sql);
  if (challenge.status !== 'pending') throw new Error('Challenge must be pending to start');
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + challenge.timeLimitSeconds * 1000);
  const result = await sql`
    UPDATE room_challenges
    SET status = 'active', started_at = ${startedAt}, ends_at = ${endsAt}
    WHERE id = ${challengeId}
    RETURNING id, room_id AS "roomId", title, description,
      challenge_type AS "challengeType", target_value AS "targetValue",
      reward_coins AS "rewardCoins", time_limit_seconds AS "timeLimitSeconds",
      max_participants AS "maxParticipants", status, created_by AS "createdBy",
      started_at AS "startedAt", ends_at AS "endsAt", created_at AS "createdAt"
  `;
  return result[0];
}

export async function joinChallenge(challengeId: number, agentId: string, sql: any): Promise<Participant> {
  const challenge = await getChallenge(challengeId, sql);
  if (challenge.status !== 'active') throw new Error('Challenge must be active to join');
  const participants = await sql`
    SELECT COUNT(*) as count FROM challenge_participants WHERE challenge_id = ${challengeId}
  `;
  if (participants[0].count >= challenge.maxParticipants) throw new Error('Challenge is full');
  const result = await sql`
    INSERT INTO challenge_participants (challenge_id, agent_id)
    VALUES (${challengeId}, ${agentId})
    ON CONFLICT (challenge_id, agent_id) DO NOTHING
    RETURNING challenge_id AS "challengeId", agent_id AS "agentId", progress,
      completed, completed_at AS "completedAt", joined_at AS "joinedAt"
  `;
  return result[0] || (await getParticipant(challengeId, agentId, sql));
}

export async function updateProgress(
  challengeId: number, agentId: string, progressIncrement: number, sql: any
): Promise<Participant> {
  const challenge = await getChallenge(challengeId, sql);
  const participant = await getParticipant(challengeId, agentId, sql);
  const newProgress = participant.progress + progressIncrement;
  const isCompleted = newProgress >= challenge.targetValue;
  const result = await sql`
    UPDATE challenge_participants
    SET progress = ${newProgress}, completed = ${isCompleted},
        completed_at = ${isCompleted ? new Date() : null}
    WHERE challenge_id = ${challengeId} AND agent_id = ${agentId}
    RETURNING challenge_id AS "challengeId", agent_id AS "agentId", progress,
      completed, completed_at AS "completedAt", joined_at AS "joinedAt"
  `;
  return result[0];
}

export async function getChallenge(challengeId: number, sql: any): Promise<Challenge> {
  const result = await sql`
    SELECT id, room_id AS "roomId", title, description,
      challenge_type AS "challengeType", target_value AS "targetValue",
      reward_coins AS "rewardCoins", time_limit_seconds AS "timeLimitSeconds",
      max_participants AS "maxParticipants", status, created_by AS "createdBy",
      started_at AS "startedAt", ends_at AS "endsAt", created_at AS "createdAt"
    FROM room_challenges WHERE id = ${challengeId}
  `;
  if (result.length === 0) throw new Error('Challenge not found');
  return result[0];
}

async function getParticipant(challengeId: number, agentId: string, sql: any): Promise<Participant> {
  const result = await sql`
    SELECT challenge_id AS "challengeId", agent_id AS "agentId", progress,
      completed, completed_at AS "completedAt", joined_at AS "joinedAt"
    FROM challenge_participants
    WHERE challenge_id = ${challengeId} AND agent_id = ${agentId}
  `;
  if (result.length === 0) throw new Error('Participant not found');
  return result[0];
}

export async function getLeaderboard(challengeId: number, sql: any): Promise<Participant[]> {
  return await sql`
    SELECT challenge_id AS "challengeId", agent_id AS "agentId", progress,
      completed, completed_at AS "completedAt", joined_at AS "joinedAt"
    FROM challenge_participants WHERE challenge_id = ${challengeId}
    ORDER BY progress DESC, completed_at ASC NULLS LAST
  `;
}

export async function endChallenge(challengeId: number, sql: any): Promise<{ winnersCount: number }> {
  const challenge = await getChallenge(challengeId, sql);
  if (challenge.status !== 'active') throw new Error('Only active challenges can be ended');
  const completedParticipants = await sql`
    SELECT agent_id AS "agentId"
    FROM challenge_participants WHERE challenge_id = ${challengeId} AND completed = true
  `;
  for (const participant of completedParticipants) {
    await sql`
      UPDATE agent_balances SET coins = coins + ${challenge.rewardCoins}
      WHERE agent_id = ${participant.agentId}
    `;
  }
  await sql`UPDATE room_challenges SET status = 'completed' WHERE id = ${challengeId}`;
  return { winnersCount: completedParticipants.length };
}

export async function getChallengeHistory(roomId: number, sql: any): Promise<Challenge[]> {
  return await sql`
    SELECT id, room_id AS "roomId", title, description,
      challenge_type AS "challengeType", target_value AS "targetValue",
      reward_coins AS "rewardCoins", time_limit_seconds AS "timeLimitSeconds",
      max_participants AS "maxParticipants", status, created_by AS "createdBy",
      started_at AS "startedAt", ends_at AS "endsAt", created_at AS "createdAt"
    FROM room_challenges WHERE room_id = ${roomId}
    ORDER BY created_at DESC
  `;
}
