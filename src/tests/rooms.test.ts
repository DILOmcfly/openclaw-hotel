import { describe, expect, test } from 'vitest';
import { PresenceService } from '../services/presence.js';
import { RoomsService } from '../services/rooms.js';

describe('rooms service', () => {
  test('create/list/get/join/leave', () => {
    const presence = new PresenceService();
    const rooms = new RoomsService(presence);

    const room = rooms.createRoom({
      name: 'Lobby',
      description: 'Main room',
      createdBy: 'agent-1',
    });

    const listed = rooms.listRooms(true);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.slug).toBe('lobby');

    const beforeJoin = rooms.getRoom(room.id);
    expect(beforeJoin?.occupantCount).toBe(0);

    rooms.joinRoom('agent-1', room.id);
    rooms.joinRoom('agent-2', room.id);

    const afterJoin = rooms.getRoom(room.id);
    expect(afterJoin?.occupantCount).toBe(2);

    rooms.leaveRoom('agent-2', room.id);
    const afterLeave = rooms.getRoom(room.id);
    expect(afterLeave?.occupantCount).toBe(1);
  });
});
