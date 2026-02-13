import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { decodeHex, encodeHex, verify } from '../utils/crypto.js';

const CHALLENGE_TTL_SECONDS = 30;
const REGISTER_WINDOW_MS = 5 * 60 * 1000;
const JWT_TTL_SECONDS = 60 * 60;

type JwtPayload = {
  agentId: string;
  publicKey: string;
  exp: number;
};

export async function registerAgent(
  publicKey: string,
  displayName: string,
  proof: string,
  timestamp: string,
  sql: any
): Promise<{ agentId: string }> {
  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error('Invalid timestamp: must be unix milliseconds as string');
  }

  const ageMs = Math.abs(Date.now() - parsedTimestamp);
  if (ageMs >= REGISTER_WINDOW_MS) {
    throw new Error('Registration timestamp expired: must be less than 5 minutes old');
  }

  let publicKeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;

  try {
    publicKeyBytes = decodeHex(publicKey);
  } catch {
    throw new Error('Invalid public key: expected hex-encoded Ed25519 public key');
  }

  try {
    signatureBytes = decodeHex(proof);
  } catch {
    throw new Error('Invalid proof: expected hex-encoded Ed25519 signature');
  }

  const message = `REGISTER:${publicKey}:${timestamp}`;
  const isValidProof = verify(message, signatureBytes, publicKeyBytes);
  if (!isValidProof) {
    throw new Error('Invalid registration proof: Ed25519 signature verification failed');
  }

  const existing = await sql`
    SELECT id
    FROM agents
    WHERE public_key = ${Buffer.from(publicKeyBytes)}
    LIMIT 1
  `;

  if (existing.length > 0) {
    throw new Error('Agent already registered for this public key');
  }

  const inserted = await sql`
    INSERT INTO agents (public_key, display_name)
    VALUES (${Buffer.from(publicKeyBytes)}, ${displayName})
    RETURNING id
  `;

  const agentId = String(inserted[0]?.id ?? '');
  if (!agentId) {
    throw new Error('Registration failed: could not create agent record');
  }

  await sql`
    INSERT INTO audit_log (event_type, actor_agent_id, details)
    VALUES (
      'agent.register',
      ${agentId}::uuid,
      ${JSON.stringify({ publicKey, displayName })}::jsonb
    )
  `;

  return { agentId };
}

export async function createChallenge(
  publicKey: string,
  redis: any
): Promise<{ challenge: string; expiresIn: number }> {
  const challengeBytes = randomBytes(32);
  const challenge = encodeHex(challengeBytes);

  await redis.set(`challenge:${publicKey}`, challenge, 'EX', CHALLENGE_TTL_SECONDS);

  return {
    challenge,
    expiresIn: CHALLENGE_TTL_SECONDS
  };
}

export async function verifyChallenge(
  publicKey: string,
  challenge: string,
  signature: string,
  sql: any,
  redis: any
): Promise<{ token: string; expiresAt: string }> {
  const key = `challenge:${publicKey}`;
  const expectedChallenge = await redis.get(key);

  if (!expectedChallenge) {
    throw new Error('Challenge missing or expired');
  }

  if (expectedChallenge !== challenge) {
    throw new Error('Challenge mismatch');
  }

  let publicKeyBytes: Uint8Array;
  let signatureBytes: Uint8Array;

  try {
    publicKeyBytes = decodeHex(publicKey);
  } catch {
    throw new Error('Invalid public key: expected hex-encoded Ed25519 public key');
  }

  try {
    signatureBytes = decodeHex(signature);
  } catch {
    throw new Error('Invalid signature: expected hex-encoded Ed25519 signature');
  }

  const isValid = verify(challenge, signatureBytes, publicKeyBytes);
  if (!isValid) {
    throw new Error('Invalid challenge signature');
  }

  await redis.del(key);

  const agents = await sql`
    SELECT id
    FROM agents
    WHERE public_key = ${Buffer.from(publicKeyBytes)}
    LIMIT 1
  `;

  if (agents.length === 0) {
    throw new Error('Agent not found for provided public key');
  }

  const agentId = String(agents[0].id);
  const expiresAtDate = new Date(Date.now() + JWT_TTL_SECONDS * 1000);

  const token = jwt.sign(
    {
      agentId,
      publicKey
    },
    config.jwtSecret,
    {
      expiresIn: JWT_TTL_SECONDS
    }
  );

  await sql`
    INSERT INTO audit_log (event_type, actor_agent_id, details)
    VALUES (
      'agent.login',
      ${agentId}::uuid,
      ${JSON.stringify({ publicKey })}::jsonb
    )
  `;

  return {
    token,
    expiresAt: expiresAtDate.toISOString()
  };
}

export function validateToken(token: string): { agentId: string; publicKey: string } {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new Error('Invalid or expired token');
  }

  if (typeof payload === 'string') {
    throw new Error('Invalid token payload');
  }

  const agentId = payload.agentId;
  const publicKey = payload.publicKey;

  if (typeof agentId !== 'string' || typeof publicKey !== 'string') {
    throw new Error('Invalid token payload: missing agentId or publicKey');
  }

  return { agentId, publicKey };
}
