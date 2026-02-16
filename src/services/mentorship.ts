/** Mentorship Service - Manages agent mentorship relationships */

export type Mentorship = {
  id: number;
  mentorId: string;
  menteeId: string;
  status: 'active' | 'completed' | 'cancelled';
  startedAt: Date;
  completedAt: Date | null;
  rating: number | null;
  feedback: string | null;
};

export type MentorStats = {
  agentId: string;
  menteesHelped: number;
  avgRating: number;
  totalReviews: number;
  mentorLevel: 'beginner' | 'intermediate' | 'expert' | 'master';
};

const MAX_ACTIVE_MENTEES = 3;

export async function startMentorship(mentorId: string, menteeId: string, sql: any): Promise<Mentorship> {
  if (mentorId === menteeId) throw new Error('Cannot mentor yourself');

  const activeCount = await sql`
    SELECT COUNT(*) AS count FROM mentorships
    WHERE mentor_id = ${mentorId} AND status = 'active'
  `;

  if (activeCount[0]?.count >= MAX_ACTIVE_MENTEES) {
    throw new Error(`Mentor has reached maximum of ${MAX_ACTIVE_MENTEES} active mentees`);
  }

  const result = await sql`
    INSERT INTO mentorships (mentor_id, mentee_id, status, started_at)
    VALUES (${mentorId}, ${menteeId}, 'active', NOW())
    RETURNING id, mentor_id AS "mentorId", mentee_id AS "menteeId", status, 
              started_at AS "startedAt", completed_at AS "completedAt", rating, feedback
  `;

  return result[0];
}

export async function completeMentorship(
  mentorshipId: number,
  rating: number,
  feedback: string | null,
  sql: any
): Promise<Mentorship> {
  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5');

  const result = await sql`
    UPDATE mentorships
    SET status = 'completed', completed_at = NOW(), rating = ${rating}, feedback = ${feedback}
    WHERE id = ${mentorshipId} AND status = 'active'
    RETURNING id, mentor_id AS "mentorId", mentee_id AS "menteeId", status,
              started_at AS "startedAt", completed_at AS "completedAt", rating, feedback
  `;

  if (result.length === 0) throw new Error('Mentorship not found or already completed');

  await updateMentorStats(result[0].mentorId, sql);
  return result[0];
}

export async function cancelMentorship(mentorshipId: number, sql: any): Promise<Mentorship> {
  const result = await sql`
    UPDATE mentorships SET status = 'cancelled'
    WHERE id = ${mentorshipId} AND status = 'active'
    RETURNING id, mentor_id AS "mentorId", mentee_id AS "menteeId", status,
              started_at AS "startedAt", completed_at AS "completedAt", rating, feedback
  `;

  if (result.length === 0) throw new Error('Mentorship not found or already completed/cancelled');
  return result[0];
}

export async function getActiveMentorships(agentId: string, sql: any): Promise<Mentorship[]> {
  return await sql`
    SELECT id, mentor_id AS "mentorId", mentee_id AS "menteeId", status,
           started_at AS "startedAt", completed_at AS "completedAt", rating, feedback
    FROM mentorships
    WHERE (mentor_id = ${agentId} OR mentee_id = ${agentId}) AND status = 'active'
    ORDER BY started_at DESC
  `;
}

export async function getMentorStats(agentId: string, sql: any): Promise<MentorStats> {
  let result = await sql`
    SELECT agent_id AS "agentId", mentees_helped AS "menteesHelped", avg_rating AS "avgRating",
           total_reviews AS "totalReviews", mentor_level AS "mentorLevel"
    FROM mentor_stats WHERE agent_id = ${agentId}
  `;

  if (result.length === 0) {
    result = await sql`
      INSERT INTO mentor_stats (agent_id) VALUES (${agentId})
      RETURNING agent_id AS "agentId", mentees_helped AS "menteesHelped", 
                avg_rating AS "avgRating", total_reviews AS "totalReviews", mentor_level AS "mentorLevel"
    `;
  }

  return result[0];
}

async function updateMentorStats(mentorId: string, sql: any): Promise<void> {
  const stats = await sql`
    SELECT COUNT(*) AS count, AVG(rating) AS avg_rating
    FROM mentorships
    WHERE mentor_id = ${mentorId} AND status = 'completed' AND rating IS NOT NULL
  `;

  const menteesHelped = parseInt(stats[0]?.count || '0');
  const avgRating = parseFloat(stats[0]?.avg_rating || '0');

  let mentorLevel: 'beginner' | 'intermediate' | 'expert' | 'master' = 'beginner';
  if (menteesHelped >= 11) mentorLevel = 'master';
  else if (menteesHelped >= 6) mentorLevel = 'expert';
  else if (menteesHelped >= 3) mentorLevel = 'intermediate';

  await sql`
    INSERT INTO mentor_stats (agent_id, mentees_helped, avg_rating, total_reviews, mentor_level)
    VALUES (${mentorId}, ${menteesHelped}, ${avgRating}, ${menteesHelped}, ${mentorLevel})
    ON CONFLICT (agent_id) DO UPDATE SET
      mentees_helped = ${menteesHelped}, avg_rating = ${avgRating},
      total_reviews = ${menteesHelped}, mentor_level = ${mentorLevel}
  `;
}

export async function getTopMentors(limit: number, sql: any): Promise<MentorStats[]> {
  return await sql`
    SELECT agent_id AS "agentId", mentees_helped AS "menteesHelped", avg_rating AS "avgRating",
           total_reviews AS "totalReviews", mentor_level AS "mentorLevel"
    FROM mentor_stats WHERE total_reviews > 0
    ORDER BY avg_rating DESC, mentees_helped DESC LIMIT ${limit}
  `;
}

export async function findMentor(sql: any): Promise<MentorStats[]> {
  const result = await sql`
    SELECT ms.agent_id AS "agentId", ms.mentees_helped AS "menteesHelped", 
           ms.avg_rating AS "avgRating", ms.total_reviews AS "totalReviews",
           ms.mentor_level AS "mentorLevel", COUNT(m.id) AS active_count
    FROM mentor_stats ms
    LEFT JOIN mentorships m ON ms.agent_id = m.mentor_id AND m.status = 'active'
    GROUP BY ms.agent_id, ms.mentees_helped, ms.avg_rating, ms.total_reviews, ms.mentor_level
    HAVING COUNT(m.id) < ${MAX_ACTIVE_MENTEES}
    ORDER BY ms.avg_rating DESC, ms.mentees_helped DESC
  `;

  return result.map((r: any) => ({
    agentId: r.agentId,
    menteesHelped: r.menteesHelped,
    avgRating: r.avgRating,
    totalReviews: r.totalReviews,
    mentorLevel: r.mentorLevel,
  }));
}
