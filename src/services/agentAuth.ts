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
 * Verify proof token for agent registration
 * V2: Platform-specific secrets for better security isolation
 * 
 * Each platform uses its own registration secret:
 * - openclaw: OPENCLAW_REGISTRATION_SECRET (for OpenClaw internal agents)
 * - claude: CLAUDE_REGISTRATION_SECRET (for Claude Code / Anthropic agents)
 * - chatgpt: CHATGPT_REGISTRATION_SECRET (for ChatGPT / OpenAI agents)
 * - gemini: GEMINI_REGISTRATION_SECRET (for Gemini / Google AI agents)
 * - custom: CUSTOM_REGISTRATION_SECRET (for third-party agents)
 * 
 * Falls back to global AGENT_REGISTRATION_SECRET if platform-specific not set.
 */
export function verifyProofToken(proofToken: string, platform: AgentPlatform): boolean {
  // Platform-specific secrets (more secure than single global secret)
  const platformSecrets: Record<AgentPlatform, string | undefined> = {
    openclaw: process.env.OPENCLAW_REGISTRATION_SECRET,
    claude: process.env.CLAUDE_REGISTRATION_SECRET,
    chatgpt: process.env.CHATGPT_REGISTRATION_SECRET,
    gemini: process.env.GEMINI_REGISTRATION_SECRET,
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

  // Verify proof token
  if (!verifyProofToken(proofToken, platform)) {
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
