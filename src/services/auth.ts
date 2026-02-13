import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import type { Agent, AuthTokenPayload } from '../types/domain.js';
import { hexToBytes, verify, randomHex } from '../utils/crypto.js';

interface RegisterAgentInput {
  publicKey: string;
  displayName: string;
  avatarEmoji?: string;
  proof: string;
  timestamp: string;
}

interface ChallengeRecord {
  challenge: string;
  expiresAt: number;
}

export class AuthService {
  private readonly agentsById = new Map<string, Agent>();
  private readonly agentIdByPublicKey = new Map<string, string>();
  private readonly challenges = new Map<string, ChallengeRecord>();

  registerAgent(input: RegisterAgentInput): Agent {
    const publicKey = input.publicKey.toLowerCase();
    const proof = input.proof.toLowerCase();

    this.assertPublicKey(publicKey);

    if (this.agentIdByPublicKey.has(publicKey)) {
      throw new Error('Agent already registered');
    }

    const parsedTimestamp = Date.parse(input.timestamp);
    if (Number.isNaN(parsedTimestamp)) {
      throw new Error('Invalid registration timestamp');
    }

    const age = Math.abs(Date.now() - parsedTimestamp);
    if (age > 5 * 60 * 1000) {
      throw new Error('Registration proof expired');
    }

    const message = `REGISTER:${publicKey}:${input.timestamp}`;
    const valid = verify(message, hexToBytes(proof), hexToBytes(publicKey));
    if (!valid) {
      throw new Error('Invalid registration proof');
    }

    const agent: Agent = {
      id: randomUUID(),
      publicKey,
      displayName: input.displayName,
      avatarEmoji: input.avatarEmoji ?? '🤖',
      createdAt: new Date().toISOString(),
      lastSeenAt: null,
      banned: false,
      banReason: null,
      metadata: {},
    };

    this.agentsById.set(agent.id, agent);
    this.agentIdByPublicKey.set(publicKey, agent.id);

    return agent;
  }

  createChallenge(publicKeyInput: string): { challenge: string; expiresIn: number } {
    const publicKey = publicKeyInput.toLowerCase();
    this.assertPublicKey(publicKey);

    if (!this.agentIdByPublicKey.has(publicKey)) {
      throw new Error('Agent not registered');
    }

    const challenge = randomHex(32);
    const expiresIn = 30;
    this.challenges.set(publicKey, {
      challenge,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return { challenge, expiresIn };
  }

  verifyChallenge(publicKeyInput: string, challengeInput: string, signatureInput: string): { token: string; expiresAt: string } {
    const publicKey = publicKeyInput.toLowerCase();
    const challenge = challengeInput.toLowerCase();
    const signature = signatureInput.toLowerCase();

    this.assertPublicKey(publicKey);

    const challengeRecord = this.challenges.get(publicKey);
    if (!challengeRecord) {
      throw new Error('Challenge not found');
    }

    if (challengeRecord.expiresAt < Date.now()) {
      this.challenges.delete(publicKey);
      throw new Error('Challenge expired');
    }

    if (challengeRecord.challenge !== challenge) {
      throw new Error('Challenge mismatch');
    }

    const valid = verify(hexToBytes(challenge), hexToBytes(signature), hexToBytes(publicKey));
    if (!valid) {
      throw new Error('Invalid challenge signature');
    }

    this.challenges.delete(publicKey);

    const agentId = this.agentIdByPublicKey.get(publicKey);
    if (!agentId) {
      throw new Error('Agent not registered');
    }

    const agent = this.agentsById.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.lastSeenAt = new Date().toISOString();

    const payload: AuthTokenPayload = {
      sub: agent.id,
      publicKey: agent.publicKey,
      displayName: agent.displayName,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    return {
      token,
      expiresAt: new Date(Date.now() + config.jwt.expiresIn * 1000).toISOString(),
    };
  }

  validateToken(token: string): AuthTokenPayload {
    const payload = jwt.verify(token, config.jwt.secret) as AuthTokenPayload;
    if (!payload.sub || !payload.publicKey || !payload.displayName) {
      throw new Error('Invalid token payload');
    }

    return payload;
  }

  getAgentById(agentId: string): Agent | null {
    return this.agentsById.get(agentId) ?? null;
  }

  getAgentByPublicKey(publicKeyInput: string): Agent | null {
    const id = this.agentIdByPublicKey.get(publicKeyInput.toLowerCase());
    if (!id) {
      return null;
    }

    return this.agentsById.get(id) ?? null;
  }

  private assertPublicKey(publicKey: string): void {
    const bytes = hexToBytes(publicKey);
    if (bytes.length !== 32) {
      throw new Error('Invalid Ed25519 public key length');
    }
  }
}
