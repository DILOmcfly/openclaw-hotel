import { randomUUID } from 'node:crypto';
import type { Room, RoomDetails } from '../types/domain.js';
import { PresenceService } from './presence.js';

interface CreateRoomInput {
  name: string;
  description?: string;
  createdBy: string;
  maxOccupants?: number;
  isPublic?: boolean;
}

export class RoomsService {
  private readonly rooms = new Map<string, Room>();
  private readonly roomBySlug = new Map<string, string>();

  constructor(private readonly presenceService: PresenceService) {}

  createRoom(input: CreateRoomInput): Room {
    const baseSlug = slugify(input.name);
    const slug = this.uniqueSlug(baseSlug);

    const room: Room = {
      id: randomUUID(),
      name: input.name,
      slug,
      description: input.description ?? '',
      createdBy: input.createdBy,
      maxOccupants: input.maxOccupants ?? 50,
      isPublic: input.isPublic ?? true,
      createdAt: new Date().toISOString(),
      metadata: {},
    };

    this.rooms.set(room.id, room);
    this.roomBySlug.set(slug, room.id);
    return room;
  }

  listRooms(onlyPublic = true): RoomDetails[] {
    return Array.from(this.rooms.values())
      .filter((room) => (onlyPublic ? room.isPublic : true))
      .map((room) => ({
        ...room,
        occupantCount: this.presenceService.getRoomOccupantCount(room.id),
      }));
  }

  getRoom(roomId: string): RoomDetails | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      ...room,
      occupantCount: this.presenceService.getRoomOccupantCount(room.id),
    };
  }

  joinRoom(agentId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const occupants = this.presenceService.getRoomOccupantCount(roomId);
    const alreadyJoined = this.presenceService.getAgentRooms(agentId).includes(roomId);
    if (!alreadyJoined && occupants >= room.maxOccupants) {
      throw new Error('Room is full');
    }

    this.presenceService.joinRoom(agentId, roomId);
  }

  leaveRoom(agentId: string, roomId: string): void {
    if (!this.rooms.has(roomId)) {
      throw new Error('Room not found');
    }

    this.presenceService.leaveRoom(agentId, roomId);
  }

  getRoomBySlug(slug: string): Room | null {
    const roomId = this.roomBySlug.get(slug);
    if (!roomId) {
      return null;
    }

    return this.rooms.get(roomId) ?? null;
  }

  private uniqueSlug(base: string): string {
    if (!this.roomBySlug.has(base)) {
      return base;
    }

    let index = 2;
    while (this.roomBySlug.has(`${base}-${index}`)) {
      index += 1;
    }

    return `${base}-${index}`;
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
