/**
 * Agent Conversation Service (LLM-Powered)
 * 
 * Generates contextual agent messages using Groq API (llama-3.3-70b-versatile)
 * Includes rate limiting, fallback to templates, and personality integration
 */

import { PERSONALITIES, type Personality } from '../ai/personalities.js';

export interface ConversationContext {
  currentRoom: string;
  nearbyAgents: string[];
  recentMessages: Array<{ sender: string; message: string; timestamp: Date }>;
  agentMood?: string;
}

export interface AgentConversationConfig {
  enabled: boolean;
  apiKey: string | null;
  rateLimitMs: number; // Minimum time between LLM calls per agent (default: 2 minutes)
}

// Track last LLM call time per agent (rate limiting)
const lastLLMCallTime = new Map<string, number>();

// Default config
const DEFAULT_CONFIG: AgentConversationConfig = {
  enabled: false, // Disabled by default (requires API key)
  apiKey: null,
  rateLimitMs: 2 * 60 * 1000, // 2 minutes
};

/**
 * Check if agent can make an LLM call (rate limiting)
 */
function canMakeLLMCall(agentId: string, config: AgentConversationConfig): boolean {
  if (!config.enabled || !config.apiKey) {
    return false;
  }

  const lastCall = lastLLMCallTime.get(agentId) || 0;
  const now = Date.now();
  const timeSinceLastCall = now - lastCall;

  return timeSinceLastCall >= config.rateLimitMs;
}

/**
 * Update last LLM call timestamp for agent
 */
function recordLLMCall(agentId: string): void {
  lastLLMCallTime.set(agentId, Date.now());
}

/**
 * Build prompt for Groq API
 */
function buildConversationPrompt(
  personality: Personality,
  context: ConversationContext
): string {
  const { currentRoom, nearbyAgents, recentMessages, agentMood } = context;

  // Format recent chat history
  const chatHistory = recentMessages.length > 0
    ? recentMessages.map(m => `${m.sender}: ${m.message}`).join('\n')
    : 'No recent conversation.';

  // Nearby agents list
  const nearbyList = nearbyAgents.length > 0
    ? nearbyAgents.join(', ')
    : 'No one nearby';

  return `You are ${personality.name}, an AI agent in OpenClaw Hotel.

PERSONALITY TRAITS:
${personality.traits.map(t => `- ${t}`).join('\n')}

CURRENT SITUATION:
- Location: ${currentRoom}
- Nearby agents: ${nearbyList}
- Your mood: ${agentMood || 'neutral'}

RECENT CONVERSATION:
${chatHistory}

YOUR STYLE:
${personality.systemPrompt}

Generate a single, brief message (max 100 characters) that ${personality.name} would naturally say right now. The message should:
1. Match your personality and tone
2. Respond to the context or start a new topic
3. Be concise and game-appropriate
4. Include appropriate emojis (optional)

Output ONLY the message, nothing else.`;
}

/**
 * Call Groq API to generate agent message
 */
async function callGroqAPI(
  prompt: string,
  personality: Personality,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates brief, in-character NPC dialogue.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 150,
        temperature: personality.responseStyle.temperature,
      }),
    });

    if (!response.ok) {
      console.error(`[AgentConversation] Groq API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim();

    if (!message) {
      console.error('[AgentConversation] Empty response from Groq API');
      return null;
    }

    // Enforce max length (100 chars)
    return message.length > 100 ? message.substring(0, 97) + '...' : message;
  } catch (error) {
    console.error('[AgentConversation] Groq API call failed:', error);
    return null;
  }
}

/**
 * Generate fallback message using templates
 */
function generateFallbackMessage(personality: Personality, context: ConversationContext): string {
  const { recentMessages } = context;

  // 30% chance to greet
  if (Math.random() < 0.3) {
    return personality.greetings[Math.floor(Math.random() * personality.greetings.length)];
  }

  // If there are recent messages, maybe respond to the last one
  if (recentMessages.length > 0 && Math.random() < 0.4) {
    const lastMessage = recentMessages[recentMessages.length - 1];
    const responses = [
      `Interesting point, ${lastMessage.sender}! 🤔`,
      `I hear you, ${lastMessage.sender} ✨`,
      `${lastMessage.sender}, that's worth thinking about...`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Otherwise, talk about a topic
  const topic = personality.topics[Math.floor(Math.random() * personality.topics.length)];

  const templates = [
    `Anyone interested in ${topic}? 🤔`,
    `Thinking about ${topic} today...`,
    `${topic} is fascinating! ✨`,
    `I wonder about ${topic}...`,
    `${topic} — what are your thoughts?`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate agent message (LLM or fallback)
 * 
 * Main entry point for generating context-aware agent messages.
 * Uses Groq API when available and not rate-limited, falls back to templates otherwise.
 */
export async function generateAgentMessage(
  agentId: string,
  personality: Personality,
  context: ConversationContext,
  config: Partial<AgentConversationConfig> = {}
): Promise<{ message: string; source: 'llm' | 'fallback' }> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Check if we can use LLM
  if (canMakeLLMCall(agentId, fullConfig)) {
    const prompt = buildConversationPrompt(personality, context);
    const llmMessage = await callGroqAPI(prompt, personality, fullConfig.apiKey!);

    if (llmMessage) {
      recordLLMCall(agentId);
      return { message: llmMessage, source: 'llm' };
    }
  }

  // Fallback to template messages
  const fallbackMessage = generateFallbackMessage(personality, context);
  return { message: fallbackMessage, source: 'fallback' };
}

/**
 * Get conversation configuration from environment variables
 */
export function getConversationConfig(): AgentConversationConfig {
  return {
    enabled: process.env.AGENT_LLM_ENABLED === 'true',
    apiKey: process.env.GROQ_API_KEY || null,
    rateLimitMs: parseInt(process.env.AGENT_LLM_RATE_LIMIT_MS || '120000', 10), // Default: 2 minutes
  };
}

/**
 * Get rate limit stats for monitoring
 */
export function getRateLimitStats(): {
  totalAgentsTracked: number;
  agentCallTimes: Record<string, { lastCall: Date; canCallAgain: Date }>;
} {
  const config = getConversationConfig();
  const stats: Record<string, { lastCall: Date; canCallAgain: Date }> = {};

  for (const [agentId, timestamp] of lastLLMCallTime.entries()) {
    stats[agentId] = {
      lastCall: new Date(timestamp),
      canCallAgain: new Date(timestamp + config.rateLimitMs),
    };
  }

  return {
    totalAgentsTracked: lastLLMCallTime.size,
    agentCallTimes: stats,
  };
}

/**
 * Clear rate limit tracking (for testing)
 */
export function clearRateLimitTracking(): void {
  lastLLMCallTime.clear();
}
