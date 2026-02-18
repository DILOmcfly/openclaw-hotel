/**
 * moodService.ts — T-362: Agent Mood Indicators
 *
 * Pure functions for deriving agent mood from recent activity.
 * No DOM, no PIXI — fully testable in Node environment.
 *
 * Mood hierarchy (highest priority first):
 *   chatting   → 💬  (agent is actively chatting)
 *   trading    → 🤝  (agent is in a trade)
 *   excited    → 🤩  (recent achievement)
 *   bored      → 😐  (idle ≥ 30 s, no interaction)
 *   tired      → 😴  (idle ≥ 60 s)
 *   happy      → 😊  (default / active but no specific mood)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** All supported mood identifiers */
export type ActivityMood =
  | 'chatting'
  | 'trading'
  | 'excited'
  | 'bored'
  | 'tired'
  | 'happy';

/** Activity types that can be reported for an agent */
export type ActivityType =
  | 'chat'        // agent sent/received a message
  | 'trade'       // agent is in a trade session
  | 'achievement' // agent unlocked an achievement
  | 'idle'        // no activity; use idleSince to compute duration
  | 'default';    // fallback / reset

/** Input passed to deriveMood */
export interface AgentActivity {
  /** The most recent activity type */
  type: ActivityType;
  /**
   * Timestamp (ms since epoch) when the agent went idle.
   * Only relevant when type === 'idle'.
   * If omitted the current time is used (i.e. just became idle).
   */
  idleSince?: number;
  /**
   * Current wall-clock time (ms since epoch).
   * Defaults to Date.now() — override in tests for determinism.
   */
  now?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Emoji displayed for each mood */
export const MOOD_EMOJIS: Record<ActivityMood, string> = {
  chatting: '💬',
  trading:  '🤝',
  excited:  '🤩',
  bored:    '😐',
  tired:    '😴',
  happy:    '😊',
} as const;

/**
 * Priority order for mood selection (index 0 = highest priority).
 * When multiple conditions could apply, the earliest in this list wins.
 */
export const MOOD_PRIORITIES: ActivityMood[] = [
  'chatting',
  'trading',
  'excited',
  'bored',
  'tired',
  'happy',
] as const;

/** Idle threshold for "bored" mood (milliseconds) */
export const BORED_THRESHOLD_MS = 30_000;   // 30 s

/** Idle threshold for "tired" mood (milliseconds) */
export const TIRED_THRESHOLD_MS = 60_000;   // 60 s

/** Duration a crossfade transition should take (milliseconds) */
export const CROSSFADE_DURATION_MS = 600;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns how long (ms) an agent has been idle.
 * @param idleSince - timestamp when idle started (defaults to `now`)
 * @param now       - current timestamp (defaults to Date.now())
 */
export function idleDurationMs(
  idleSince: number | undefined,
  now: number = Date.now(),
): number {
  if (idleSince === undefined) return 0;
  return Math.max(0, now - idleSince);
}

/**
 * Derive the current ActivityMood from the agent's latest activity.
 *
 * Priority (highest → lowest):
 *   chat activity        → chatting
 *   trade activity       → trading
 *   achievement activity → excited
 *   idle ≥ 60 s         → tired      (tired takes precedence over bored)
 *   idle ≥ 30 s         → bored
 *   anything else        → happy
 */
export function deriveMood(activity: AgentActivity): ActivityMood {
  const now = activity.now ?? Date.now();

  switch (activity.type) {
    case 'chat':
      return 'chatting';

    case 'trade':
      return 'trading';

    case 'achievement':
      return 'excited';

    case 'idle': {
      const elapsed = idleDurationMs(activity.idleSince, now);
      if (elapsed >= TIRED_THRESHOLD_MS) return 'tired';
      if (elapsed >= BORED_THRESHOLD_MS) return 'bored';
      // Idle but not long enough to be bored — still happy
      return 'happy';
    }

    case 'default':
    default:
      return 'happy';
  }
}

/**
 * Return the emoji string for a given mood.
 * Falls back to '😊' if an unknown mood is supplied.
 */
export function moodToEmoji(mood: ActivityMood): string {
  return MOOD_EMOJIS[mood] ?? MOOD_EMOJIS.happy;
}

/**
 * Return the priority index of a mood (lower index = higher priority).
 * Returns `Infinity` for unknown moods.
 */
export function moodPriority(mood: ActivityMood): number {
  const idx = MOOD_PRIORITIES.indexOf(mood);
  return idx === -1 ? Infinity : idx;
}

/**
 * Given two moods, return the one with higher priority (lower index).
 */
export function higherPriorityMood(a: ActivityMood, b: ActivityMood): ActivityMood {
  return moodPriority(a) <= moodPriority(b) ? a : b;
}

/**
 * Compute the crossfade alpha (0 → 1) for a transition that started
 * `elapsedMs` milliseconds ago.  Clamped to [0, 1].
 */
export function crossfadeAlpha(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / CROSSFADE_DURATION_MS));
}
