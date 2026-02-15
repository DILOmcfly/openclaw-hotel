/**
 * Integration Tests: Authentication Flow
 * 
 * Tests the complete authentication lifecycle with real database:
 * - Agent registration
 * - Login (JWT token generation)
 * - Token validation
 * - Profile retrieval
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTests, teardownIntegrationTests, getTestSql } from './setup.js';
import * as agentAuthService from '../../services/agentAuth.js';
import * as authService from '../../services/auth.js';
import { nanoid } from 'nanoid';

let sql: ReturnType<typeof getTestSql>;

describe('Integration: Authentication Flow', () => {
  beforeAll(async () => {
    sql = await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  describe('Agent Registration → Login → Token Validation', () => {
    it('should complete full auth flow: register → authenticate → verify token', async () => {
      // Step 1: Register new agent
      const agentId = `test-agent-${nanoid(8)}`;
      const agentName = 'IntegrationTestAgent';
      const publicKey = 'test-public-key-123';
      const proof = 'test-proof-signature';

      const registrationResult = await agentAuthService.registerAgent(
        {
          agentId,
          name: agentName,
          platform: 'test',
          agentType: 'basic',
          publicKey,
          proof,
          description: 'Integration test agent',
        },
        sql
      );

      expect(registrationResult).toBeDefined();
      expect(registrationResult.apiKey).toMatch(/^ock_[A-Za-z0-9]{32}$/);
      expect(registrationResult.agentId).toBe(agentId);

      // Verify agent exists in database
      const [agent] = await sql`
        SELECT id, name, platform, agent_type, verified, api_key_hash
        FROM agents
        WHERE id = ${agentId}
      `;

      expect(agent).toBeDefined();
      expect(agent.name).toBe(agentName);
      expect(agent.platform).toBe('test');
      expect(agent.agent_type).toBe('basic');
      expect(agent.verified).toBe(true);
      expect(agent.api_key_hash).toBeDefined();

      // Step 2: Authenticate with API key (simulates agent login)
      const authResult = await agentAuthService.authenticateAgent(
        registrationResult.apiKey,
        sql
      );

      expect(authResult).toBeDefined();
      expect(authResult.agentId).toBe(agentId);
      expect(authResult.name).toBe(agentName);
      expect(authResult.platform).toBe('test');

      // Step 3: Generate JWT token (for HTTP API access)
      const token = authService.signToken({ agentId, name: agentName });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Step 4: Validate JWT token
      const decoded = authService.validateToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.agentId).toBe(agentId);
      expect(decoded.name).toBe(agentName);

      // Step 5: Verify agent profile was auto-created
      const [profile] = await sql`
        SELECT agent_id, bio, avatar_url, joined_at
        FROM agent_profiles
        WHERE agent_id = ${agentId}
      `;

      expect(profile).toBeDefined();
      expect(profile.agent_id).toBe(agentId);
      expect(profile.bio).toBe(null); // Default empty bio

      // Step 6: Verify agent balance was auto-created (500 starter coins)
      const [balance] = await sql`
        SELECT agent_id, coins, last_daily_claim
        FROM agent_balances
        WHERE agent_id = ${agentId}
      `;

      expect(balance).toBeDefined();
      expect(balance.agent_id).toBe(agentId);
      expect(balance.coins).toBe(500); // Starter bonus

      // Step 7: Verify agent appearance was auto-created
      const [appearance] = await sql`
        SELECT agent_id, skin_color, outfit, accessory
        FROM agent_appearance
        WHERE agent_id = ${agentId}
      `;

      expect(appearance).toBeDefined();
      expect(appearance.agent_id).toBe(agentId);
      expect(appearance.skin_color).toBeDefined();
      expect(appearance.outfit).toBe('casual'); // Default outfit
    });

    it('should reject duplicate agent registration', async () => {
      const agentId = `duplicate-agent-${nanoid(8)}`;

      // First registration
      await agentAuthService.registerAgent(
        {
          agentId,
          name: 'FirstAgent',
          platform: 'test',
          agentType: 'basic',
          publicKey: 'key1',
          proof: 'proof1',
        },
        sql
      );

      // Duplicate registration should fail
      await expect(
        agentAuthService.registerAgent(
          {
            agentId, // Same agent ID
            name: 'DuplicateAgent',
            platform: 'test',
            agentType: 'basic',
            publicKey: 'key2',
            proof: 'proof2',
          },
          sql
        )
      ).rejects.toThrow(/already registered/i);
    });

    it('should reject authentication with invalid API key', async () => {
      const invalidApiKey = 'ock_invalid_key_123456789012345678901234';

      await expect(
        agentAuthService.authenticateAgent(invalidApiKey, sql)
      ).rejects.toThrow(/Invalid API key/i);
    });

    it('should reject invalid JWT token', () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';

      expect(() => authService.validateToken(invalidToken)).toThrow();
    });
  });

  describe('Agent Retrieval', () => {
    it('should retrieve agent by ID after registration', async () => {
      const agentId = `retrieve-agent-${nanoid(8)}`;

      // Register agent
      await agentAuthService.registerAgent(
        {
          agentId,
          name: 'RetrieveMe',
          platform: 'test',
          agentType: 'basic',
          publicKey: 'key',
          proof: 'proof',
          description: 'Test agent for retrieval',
        },
        sql
      );

      // Retrieve agent
      const agent = await agentAuthService.getAgent(agentId, sql);

      expect(agent).toBeDefined();
      expect(agent.id).toBe(agentId);
      expect(agent.name).toBe('RetrieveMe');
      expect(agent.platform).toBe('test');
      expect(agent.description).toBe('Test agent for retrieval');
      expect(agent.verified).toBe(true);
    });

    it('should return null for non-existent agent', async () => {
      const agent = await agentAuthService.getAgent('non-existent-agent-id', sql);
      expect(agent).toBeNull();
    });
  });
});
