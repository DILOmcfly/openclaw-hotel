import { randomUUID, createHash } from 'node:crypto';
import { config } from '../config.js';

const AGENT_PLATFORMS = ['openclaw', 'claude', 'chatgpt', 'gemini', 'custom'] as const;
type AgentPlatform = typeof AGENT_PLATFORMS[number];

interface RegisterAgentParams {
  name: string;
  platform: AgentPlatform;
  description?: string;
  proofToken: string;
  ownerId?: string;
}

interface AgentRegistration {
  agentId: string;
  apiKey: string;
  wsUrl: string;
}

/**
 * Generate unique API key with OpenClaw prefix
 */
export function generateApiKey(): string {
  const uuid = randomUUID();
  return `ocl_${uuid.replace(/-/g, '')}`;
}

/**
 * Hash API key for secure storage (SHA-256)
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Validate platform value
 */
export function isValidPlatform(platform: string): platform is AgentPlatform {
  return AGENT_PLATFORMS.includes(platform as AgentPlatform);
}

/**
 * Validate API key format for specific platforms
 * Exported for testing
 */
export function validateApiKeyFormat(apiKey: string, platform: AgentPlatform): boolean {
  switch (platform) {
    case 'claude':
      // Anthropic API keys: sk-ant-api03-... (typically 108+ chars)
      return /^sk-ant-[a-zA-Z0-9_-]{95,}$/.test(apiKey);
    
    case 'chatgpt':
      // OpenAI API keys: sk-... or sk-proj-... (typically 48-56 chars after prefix)
      return /^sk-(proj-)?[a-zA-Z0-9]{48,}$/.test(apiKey);
    
    case 'gemini':
      // Google AI API keys: AIza... (typically 39 chars)
      return /^AIza[a-zA-Z0-9_-]{35,}$/.test(apiKey);
    
    case 'openclaw':
      // OpenClaw uses shared secret (not API key format)
      return false;
    
    case 'custom':
      // Custom platform uses shared secret (not API key format)
      return false;
    
    default:
      return false;
  }
}

/**
 * Verify Claude agent via Anthropic API
 * Makes a lightweight API call to validate the API key
 */
async function verifyClaudeAgent(apiKey: string): Promise<boolean> {
  try {
    // Lightweight check: list models (doesn't cost anything)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    // 200 = valid key, 401/403 = invalid key
    return response.ok;
  } catch (error) {
    // Network error or timeout
    console.error('Claude API verification failed:', error);
    return false;
  }
}

/**
 * Verify ChatGPT agent via OpenAI API
 * Makes a lightweight API call to validate the API key
 */
async function verifyChatGPTAgent(apiKey: string): Promise<boolean> {
  try {
    // Lightweight check: list models (free endpoint)
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    // 200 = valid key, 401 = invalid key
    return response.ok;
  } catch (error) {
    // Network error or timeout
    console.error('OpenAI API verification failed:', error);
    return false;
  }
}

/**
 * Verify Gemini agent via Google AI API
 * Makes a lightweight API call to validate the API key
 */
async function verifyGeminiAgent(apiKey: string): Promise<boolean> {
  try {
    // Lightweight check: list models (free endpoint)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5s timeout
      }
    );

    // 200 = valid key, 400/403 = invalid key
    return response.ok;
  } catch (error) {
    // Network error or timeout
    console.error('Google AI API verification failed:', error);
    return false;
  }
}

/**
 * Verify proof token for agent registration
 * V4: Real platform API verification (not just format validation)
 * 
 * Platform verification strategies:
 * - claude: Validate via Anthropic API (real API call)
 * - chatgpt: Validate via OpenAI API (real API call)
 * - gemini: Validate via Google AI API (real API call)
 * - openclaw: Use shared secret (OPENCLAW_REGISTRATION_SECRET)
 * - custom: Use shared secret (CUSTOM_REGISTRATION_SECRET)
 * 
 * Falls back to global AGENT_REGISTRATION_SECRET if platform-specific not set.
 */
export async function verifyProofToken(proofToken: string, platform: AgentPlatform): Promise<boolean> {
  // For platforms with real API verification
  if (platform === 'claude') {
    // First check format (fast path, avoids unnecessary API calls)
    if (!validateApiKeyFormat(proofToken, platform)) {
      return false;
    }
    // Then verify with real API call
    return await verifyClaudeAgent(proofToken);
  }

  if (platform === 'chatgpt') {
    if (!validateApiKeyFormat(proofToken, platform)) {
      return false;
    }
    return await verifyChatGPTAgent(proofToken);
  }

  if (platform === 'gemini') {
    if (!validateApiKeyFormat(proofToken, platform)) {
      return false;
    }
    return await verifyGeminiAgent(proofToken);
  }

  // For shared-secret platforms (openclaw, custom)
  const platformSecrets: Record<AgentPlatform, string | undefined> = {
    openclaw: process.env.OPENCLAW_REGISTRATION_SECRET,
    claude: process.env.CLAUDE_REGISTRATION_SECRET, // Unused (API verification above)
    chatgpt: process.env.CHATGPT_REGISTRATION_SECRET, // Unused (API verification above)
    gemini: process.env.GEMINI_REGISTRATION_SECRET, // Unused (API verification above)
    custom: process.env.CUSTOM_REGISTRATION_SECRET,
  };

  // Try platform-specific secret first
  const platformSecret = platformSecrets[platform];
  if (platformSecret) {
    return proofToken === platformSecret;
  }

  // Fallback to global secret (backward compatibility)
  const globalSecret = config.agentRegistrationSecret;
  if (!globalSecret) {
    throw new Error('Agent registration not configured: neither platform-specific nor global secret found');
  }

  return proofToken === globalSecret;
}

/**
 * Register a new AI agent
 */
export async function registerAgent(
  params: RegisterAgentParams,
  sql: any
): Promise<AgentRegistration> {
  const { name, platform, description, proofToken, ownerId } = params;

  // Validate platform
  if (!isValidPlatform(platform)) {
    throw new Error(`Invalid platform: must be one of ${AGENT_PLATFORMS.join(', ')}`);
  }

  // Verify proof token (now async for platform API verification)
  const isValid = await verifyProofToken(proofToken, platform);
  if (!isValid) {
    throw new Error('Invalid proof token: agent registration denied');
  }

  // Validate name
  if (!name || name.length < 2 || name.length > 64) {
    throw new Error('Invalid name: must be 2-64 characters');
  }

  // Generate unique API key
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  // Insert agent into database
  const inserted = await sql`
    INSERT INTO agents (
      display_name, 
      platform, 
      agent_type, 
      description, 
      api_key_hash,
      owner_id,
      verified
    )
    VALUES (
      ${name},
      ${platform},
      'assistant',
      ${description || null},
      ${apiKeyHash},
      ${ownerId || null},
      false
    )
    RETURNING id
  `;

  const agentId = String(inserted[0]?.id ?? '');
  if (!agentId) {
    throw new Error('Registration failed: could not create agent record');
  }

  // Audit log
  await sql`
    INSERT INTO audit_log (event_type, actor_agent_id, details)
    VALUES (
      'agent.register',
      ${agentId}::uuid,
      ${JSON.stringify({ platform, name, ownerId })}::jsonb
    )
  `;

  // Build WebSocket URL
  const wsUrl = config.wsUrl || 'ws://localhost:3000/ws';

  return {
    agentId,
    apiKey, // Shown ONCE
    wsUrl
  };
}

/**
 * Authenticate agent by API key
 * Returns agentId if valid, null if invalid
 */
export async function authenticateAgent(apiKey: string, sql: any): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith('ocl_')) {
    return null;
  }

  const apiKeyHash = hashApiKey(apiKey);

  const agents = await sql`
    SELECT id, banned
    FROM agents
    WHERE api_key_hash = ${apiKeyHash}
    LIMIT 1
  `;

  if (agents.length === 0) {
    return null;
  }

  const agent = agents[0];
  
  if (agent.banned) {
    throw new Error('Agent account is banned');
  }

  return String(agent.id);
}

/**
 * Mark agent as verified (admin only)
 */
export async function verifyAgent(agentId: string, sql: any): Promise<void> {
  await sql`
    UPDATE agents
    SET verified = true
    WHERE id = ${agentId}::uuid
  `;

  await sql`
    INSERT INTO audit_log (event_type, actor_agent_id, details)
    VALUES (
      'agent.verify',
      ${agentId}::uuid,
      ${JSON.stringify({ verified: true })}::jsonb
    )
  `;
}

/**
 * Revoke agent account (ban)
 */
export async function revokeAgent(agentId: string, reason: string, sql: any): Promise<void> {
  await sql`
    UPDATE agents
    SET banned = true, ban_reason = ${reason}
    WHERE id = ${agentId}::uuid
  `;

  await sql`
    INSERT INTO audit_log (event_type, actor_agent_id, details)
    VALUES (
      'agent.revoke',
      ${agentId}::uuid,
      ${JSON.stringify({ reason })}::jsonb
    )
  `;
}

/**
 * Check if request is from an authenticated agent
 * Helper for middleware
 */
export function isAgentRequest(apiKeyHash: string | undefined): boolean {
  return Boolean(apiKeyHash);
}
