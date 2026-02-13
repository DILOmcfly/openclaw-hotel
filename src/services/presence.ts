export interface PresenceEntry {
  agentId: string;
  roomId: string;
  joinedAt: string;
  lastSeenAt: string;
}

export class PresenceService {
  private readonly roomOccupants = new Map<string, Map<string, PresenceEntry>>();
  private readonly agentRooms = new Map<string, Set<string>>();

  joinRoom(agentId: string, roomId: string): PresenceEntry {
    const now = new Date().toISOString();

    if (!this.roomOccupants.has(roomId)) {
      this.roomOccupants.set(roomId, new Map());
    }

    const roomMap = this.roomOccupants.get(roomId)!;
    const existing = roomMap.get(agentId);
    const entry: PresenceEntry =
      existing ?? {
        agentId,
        roomId,
        joinedAt: now,
        lastSeenAt: now,
      };

    entry.lastSeenAt = now;
    roomMap.set(agentId, entry);

    if (!this.agentRooms.has(agentId)) {
      this.agentRooms.set(agentId, new Set());
    }

    this.agentRooms.get(agentId)!.add(roomId);
    return entry;
  }

  leaveRoom(agentId: string, roomId: string): void {
    this.roomOccupants.get(roomId)?.delete(agentId);
    if (this.roomOccupants.get(roomId)?.size === 0) {
      this.roomOccupants.delete(roomId);
    }

    const rooms = this.agentRooms.get(agentId);
    if (!rooms) {
      return;
    }

    rooms.delete(roomId);
    if (rooms.size === 0) {
      this.agentRooms.delete(agentId);
    }
  }

  removeAgent(agentId: string): void {
    const rooms = this.agentRooms.get(agentId);
    if (!rooms) {
      return;
    }

    for (const roomId of rooms) {
      this.roomOccupants.get(roomId)?.delete(agentId);
      if (this.roomOccupants.get(roomId)?.size === 0) {
        this.roomOccupants.delete(roomId);
      }
    }

    this.agentRooms.delete(agentId);
  }

  getOccupants(roomId: string): PresenceEntry[] {
    return Array.from(this.roomOccupants.get(roomId)?.values() ?? []);
  }

  getRoomOccupantCount(roomId: string): number {
    return this.roomOccupants.get(roomId)?.size ?? 0;
  }

  getAgentRooms(agentId: string): string[] {
    return Array.from(this.agentRooms.get(agentId) ?? []);
  }

  updateHeartbeat(agentId: string): void {
    const now = new Date().toISOString();
    for (const roomId of this.getAgentRooms(agentId)) {
      const entry = this.roomOccupants.get(roomId)?.get(agentId);
      if (entry) {
        entry.lastSeenAt = now;
      }
    }
  }
}
