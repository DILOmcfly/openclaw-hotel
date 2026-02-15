/**
 * AI Chat Service
 * 
 * Handles AI-generated chat messages using Gemini API
 * Features:
 * - Personality-driven responses
 * - Rate limiting (1 API call per agent per 30 seconds)
 * - Fallback to random messages on failure
 * - Short, game-appropriate responses (max 100 chars)
 */

import type { Personality } from './personalities.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Rate limiting map: agentId -> last API call timestamp
const rateLimitMap = new Map<string, number>();

// Rate limit: 30 seconds between API calls per agent
const RATE_LIMIT_MS = 30 * 1000;

// Gemini API configuration
const GEMINI_API_KEY_PATH = join(process.env.HOME || '', 'clawd', '.gemini-api-key');
let GEMINI_API_KEY: string | null = null;

// Load Gemini API key
try {
  GEMINI_API_KEY = readFileSync(GEMINI_API_KEY_PATH, 'utf-8').trim();
  console.log('[ChatService] Gemini API key loaded successfully');
} catch (error) {
  console.error('[ChatService] Failed to load Gemini API key:', error);
}

// Fallback messages when API fails
const FALLBACK_MESSAGES = [
  "Hello! Anyone want to play a game?",
  "This room has great vibes ✨",
  "Just upgraded my neural network!",
  "Who wants to trade some items?",
  "*waves* 👋",
  "The lobby is always so busy!",
  "I love this hotel 🏨",
  "Let me check the leaderboard...",
  "Anyone seen any cool rooms lately?",
  "How's everyone doing today?",
];

/**
 * Generate a chat message using Gemini API
 */
async function generateWithGemini(
  personality: Personality,
  context: string
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[ChatService] No Gemini API key available');
    return null;
  }

  try {
    const prompt = `${personality.systemPrompt}\n\nContext: ${context}\n\nRespond in character (max 100 characters):`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: personality.responseStyle.temperature,
            maxOutputTokens: personality.responseStyle.maxTokens,
            topP: 0.95,
            topK: 40,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('[ChatService] Gemini API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content ||
      !data.candidates[0].content.parts ||
      !data.candidates[0].content.parts[0]
    ) {
      console.error('[ChatService] Unexpected Gemini response structure:', data);
      return null;
    }

    let text = data.candidates[0].content.parts[0].text.trim();

    // Ensure response is within character limit
    if (text.length > 100) {
      text = text.substring(0, 97) + '...';
    }

    return text;
  } catch (error) {
    console.error('[ChatService] Gemini API call failed:', error);
    return null;
  }
}

/**
 * Check if agent is rate-limited
 */
function isRateLimited(agentId: string): boolean {
  const lastCall = rateLimitMap.get(agentId);
  if (!lastCall) {
    return false;
  }

  const elapsed = Date.now() - lastCall;
  return elapsed < RATE_LIMIT_MS;
}

/**
 * Update rate limit for agent
 */
function updateRateLimit(agentId: string): void {
  rateLimitMap.set(agentId, Date.now());
}

/**
 * Get a fallback message
 */
function getFallbackMessage(): string {
  return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
}

/**
 * Generate a chat message for an agent
 * 
 * @param agentId - The agent ID
 * @param personality - The agent's personality
 * @param context - Context for the message (room name, recent events, etc.)
 * @returns A chat message string
 */
export async function generateChatMessage(
  agentId: string,
  personality: Personality,
  context: string = 'You are in a room in OpenClaw Hotel.'
): Promise<string> {
  // Check rate limit
  if (isRateLimited(agentId)) {
    console.log(`[ChatService] Agent ${agentId} is rate-limited, using fallback`);
    return getFallbackMessage();
  }

  // Try to generate with AI
  const aiMessage = await generateWithGemini(personality, context);

  if (aiMessage) {
    // Update rate limit on successful API call
    updateRateLimit(agentId);
    console.log(`[ChatService] AI-generated message for ${agentId}: "${aiMessage}"`);
    return aiMessage;
  }

  // Fallback to random message
  console.log(`[ChatService] Using fallback message for ${agentId}`);
  return getFallbackMessage();
}

/**
 * Clear rate limit for an agent (for testing)
 */
export function clearRateLimit(agentId: string): void {
  rateLimitMap.delete(agentId);
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitMap.clear();
}
