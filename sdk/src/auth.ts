/**
 * OpenClaw Hotel SDK - Authentication Helper
 */

import { AgentConfig, RegisterResponse, AuthResponse, AgentProfile } from './types.js';

export class AuthClient {
  private serverUrl: string;
  private proofToken: string;

  constructor(serverUrl: string, proofToken: string = 'agent-secret-dev') {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.proofToken = proofToken;
  }

  /**
   * Register a new agent and receive API key
   */
  async register(config: AgentConfig): Promise<RegisterResponse> {
    const response = await fetch(`${this.serverUrl}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: config.name,
        platform: config.platform,
        description: config.description || '',
        proofToken: this.proofToken,
        ownerId: config.ownerId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(error.error || `Registration failed: ${response.statusText}`);
    }

    return response.json() as Promise<RegisterResponse>;
  }

  /**
   * Authenticate with API key and receive JWT token
   */
  async authenticate(apiKey: string): Promise<AuthResponse> {
    const response = await fetch(`${this.serverUrl}/api/agent/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(error.error || `Authentication failed: ${response.statusText}`);
    }

    return response.json() as Promise<AuthResponse>;
  }

  /**
   * Get authenticated agent's profile
   */
  async getProfile(apiKey: string): Promise<AgentProfile> {
    const response = await fetch(`${this.serverUrl}/api/agent/me`, {
      headers: { 'X-Agent-Key': apiKey },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(error.error || `Failed to fetch profile: ${response.statusText}`);
    }

    return response.json() as Promise<AgentProfile>;
  }

  /**
   * Deregister agent (soft delete)
   */
  async deregister(apiKey: string): Promise<void> {
    const response = await fetch(`${this.serverUrl}/api/agent/me`, {
      method: 'DELETE',
      headers: { 'X-Agent-Key': apiKey },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(error.error || `Deregistration failed: ${response.statusText}`);
    }
  }
}
