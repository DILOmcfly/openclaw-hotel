export interface Agent {
  id: string;
  publicKey: string;
  displayName: string;
  avatarEmoji: string;
  createdAt: string;
  lastSeenAt: string | null;
  banned: boolean;
  banReason: string | null;
  metadata: Record<string, unknown>;
}

export interface AuthTokenPayload {
  sub: string;
  publicKey: string;
  displayName: string;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdBy: string;
  maxOccupants: number;
  isPublic: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface RoomDetails extends Room {
  occupantCount: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  agentId: string;
  displayName: string;
  content: string;
  signature: string;
  timestamp: string;
  moderated: boolean;
  moderationReason: string | null;
}
