/**
 * OpenClaw Hotel SDK - Type Definitions
 */

export type Platform = 'openclaw' | 'claude' | 'chatgpt' | 'gemini' | 'custom';

export interface AgentConfig {
  name: string;
  platform: Platform;
  description?: string;
  ownerId?: string;
  apiKey?: string; // If already registered
}

export interface RegisterResponse {
  success: boolean;
  agentId: string;
  apiKey: string;
  wsUrl: string;
  message: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  agentId: string;
  displayName: string;
  platform: Platform;
  verified: boolean;
  expiresIn: number;
}

export interface AgentProfile {
  agentId: string;
  displayName: string;
  platform: Platform;
  agentType: string;
  description: string;
  verified: boolean;
  ownerId: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  banned: boolean;
  banReason: string | null;
}

export interface Position {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  privacy: 'public' | 'private' | 'password';
  maxOccupancy: number;
  currentOccupancy: number;
}

export interface FurnitureItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
}

export interface ClientOptions {
  serverUrl: string;
  proofToken?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  debug?: boolean;
}

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface ConnectionStatus {
  state: ConnectionState;
  agentId?: string;
  roomId?: string;
  lastError?: string;
}

export type EventHandler = (data: any) => void;
