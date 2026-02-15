/**
 * Trivia Service - Daily trivia game with coin rewards
 */

export type TriviaQuestion = {
  id: number;
  question: string;
  options: string[];
  correctOption: number;
  category: string;
  difficulty: string;
  rewardCoins: number;
  createdAt: Date;
};

export type TriviaAnswer = {
  id: number;
  questionId: number;
  agentId: string;
  selectedOption: number;
  correct: boolean;
  answeredAt: Date;
};

export type TriviaStats = {
  totalAnswered: number;
  correctAnswers: number;
  correctPercentage: number;
  coinsEarned: number;
};

export type LeaderboardEntry = {
  agentId: string;
  correctAnswers: number;
  totalAnswered: number;
  accuracy: number;
};

export type QuestionStats = {
  questionId: number;
  totalAttempts: number;
  correctAttempts: number;
  successRate: number;
};

/**
 * Get 5 random unanswered questions for an agent
 */
export async function getDailyQuestions(agentId: string, sql: any): Promise<TriviaQuestion[]> {
  const result = await sql`
    SELECT q.id, q.question, q.options, q.correct_option AS "correctOption",
           q.category, q.difficulty, q.reward_coins AS "rewardCoins", q.created_at AS "createdAt"
    FROM trivia_questions q
    WHERE q.id NOT IN (
      SELECT question_id FROM trivia_answers WHERE agent_id = ${agentId}
    )
    ORDER BY RANDOM()
    LIMIT 5
  `;

  return result.map((r: any) => ({
    ...r,
    options: JSON.parse(r.options),
  }));
}

/**
 * Answer a trivia question (one attempt per question)
 */
export async function answerQuestion(
  agentId: string,
  questionId: number,
  selectedOption: number,
  sql: any
): Promise<{ correct: boolean; coinsAwarded: number; correctOption: number }> {
  // Check if already answered
  const existing = await sql`
    SELECT id FROM trivia_answers
    WHERE question_id = ${questionId} AND agent_id = ${agentId}
  `;

  if (existing.length > 0) {
    throw new Error('Question already answered');
  }

  // Validate selectedOption
  if (selectedOption < 0 || selectedOption > 3) {
    throw new Error('Invalid option selected');
  }

  // Get question details
  const questions = await sql`
    SELECT correct_option AS "correctOption", reward_coins AS "rewardCoins"
    FROM trivia_questions
    WHERE id = ${questionId}
  `;

  if (questions.length === 0) {
    throw new Error('Question not found');
  }

  const { correctOption, rewardCoins } = questions[0];
  const correct = selectedOption === correctOption;
  const coinsAwarded = correct ? rewardCoins : 0;

  // Record answer
  await sql`
    INSERT INTO trivia_answers (question_id, agent_id, selected_option, correct)
    VALUES (${questionId}, ${agentId}, ${selectedOption}, ${correct})
  `;

  // Award coins if correct
  if (coinsAwarded > 0) {
    await sql`
      UPDATE agent_balances
      SET coins = coins + ${coinsAwarded}
      WHERE agent_id = ${agentId}
    `;
  }

  return { correct, coinsAwarded, correctOption };
}

/**
 * Get agent's trivia statistics
 */
export async function getAgentStats(agentId: string, sql: any): Promise<TriviaStats> {
  const result = await sql`
    SELECT 
      COUNT(*) AS total_answered,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS correct_answers
    FROM trivia_answers
    WHERE agent_id = ${agentId}
  `;

  const totalAnswered = parseInt(result[0]?.total_answered || '0');
  const correctAnswers = parseInt(result[0]?.correct_answers || '0');
  const correctPercentage = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

  // Calculate total coins earned
  const coinsResult = await sql`
    SELECT SUM(q.reward_coins) AS coins_earned
    FROM trivia_answers a
    JOIN trivia_questions q ON a.question_id = q.id
    WHERE a.agent_id = ${agentId} AND a.correct = true
  `;

  const coinsEarned = parseInt(coinsResult[0]?.coins_earned || '0');

  return {
    totalAnswered,
    correctAnswers,
    correctPercentage,
    coinsEarned,
  };
}

/**
 * Get leaderboard by correct answers
 */
export async function getLeaderboard(limit: number, sql: any): Promise<LeaderboardEntry[]> {
  const result = await sql`
    SELECT 
      agent_id AS "agentId",
      COUNT(*) AS total_answered,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS correct_answers
    FROM trivia_answers
    GROUP BY agent_id
    HAVING COUNT(*) > 0
    ORDER BY correct_answers DESC, total_answered ASC
    LIMIT ${limit}
  `;

  return result.map((r: any) => ({
    agentId: r.agentId,
    correctAnswers: parseInt(r.correct_answers),
    totalAnswered: parseInt(r.total_answered),
    accuracy: Math.round((parseInt(r.correct_answers) / parseInt(r.total_answered)) * 100),
  }));
}

/**
 * Get statistics for a specific question
 */
export async function getQuestionStats(questionId: number, sql: any): Promise<QuestionStats> {
  const result = await sql`
    SELECT 
      COUNT(*) AS total_attempts,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END) AS correct_attempts
    FROM trivia_answers
    WHERE question_id = ${questionId}
  `;

  const totalAttempts = parseInt(result[0]?.total_attempts || '0');
  const correctAttempts = parseInt(result[0]?.correct_attempts || '0');
  const successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  return {
    questionId,
    totalAttempts,
    correctAttempts,
    successRate,
  };
}

/**
 * Get agent's current streak of consecutive correct answers
 */
export async function getStreak(agentId: string, sql: any): Promise<number> {
  const answers = await sql`
    SELECT correct
    FROM trivia_answers
    WHERE agent_id = ${agentId}
    ORDER BY answered_at DESC
  `;

  let streak = 0;
  for (const answer of answers) {
    if (answer.correct) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
