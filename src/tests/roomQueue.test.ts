import { describe, it, expect, beforeEach } from 'vitest';
import {
  joinQueue,
  leaveQueue,
  getQueue,
  getPosition,
  nextInQueue,
  isInQueue,
  getQueueLength,
} from '../services/roomQueue.js';

describe('Room Queue System', () => {
  const agent1 = 'agent-1';
  const agent2 = 'agent-2';
  const agent3 = 'agent-3';
  let roomCounter = 0;
  let roomId: string;

  beforeEach(() => {
    roomId = `room-${++roomCounter}`;
  });

  it('should join queue successfully', () => {
    joinQueue(roomId, agent1);
    expect(isInQueue(roomId, agent1)).toBe(true);
    expect(getQueueLength(roomId)).toBe(1);
  });

  it('should get correct position in queue', () => {
    joinQueue(roomId, agent1);
    joinQueue(roomId, agent2);
    joinQueue(roomId, agent3);
    expect(getPosition(roomId, agent1)).toBe(1);
    expect(getPosition(roomId, agent2)).toBe(2);
    expect(getPosition(roomId, agent3)).toBe(3);
  });

  it('should maintain FIFO order', () => {
    joinQueue(roomId, agent1);
    joinQueue(roomId, agent2);
    joinQueue(roomId, agent3);
    expect(nextInQueue(roomId)).toBe(agent1);
    expect(nextInQueue(roomId)).toBe(agent2);
    expect(nextInQueue(roomId)).toBe(agent3);
    expect(getQueueLength(roomId)).toBe(0);
  });

  it('should prevent duplicate entries', () => {
    joinQueue(roomId, agent1);
    expect(() => joinQueue(roomId, agent1)).toThrow('Already in queue');
    expect(getQueueLength(roomId)).toBe(1);
  });

  it('should enforce max capacity of 20', () => {
    for (let i = 0; i < 20; i++) {
      joinQueue(roomId, `agent-${i}`);
    }
    expect(getQueueLength(roomId)).toBe(20);
    expect(() => joinQueue(roomId, 'agent-21')).toThrow('Queue is full');
  });

  it('should leave queue successfully', () => {
    joinQueue(roomId, agent1);
    joinQueue(roomId, agent2);
    leaveQueue(roomId, agent1);
    expect(isInQueue(roomId, agent1)).toBe(false);
    expect(isInQueue(roomId, agent2)).toBe(true);
    expect(getQueueLength(roomId)).toBe(1);
  });

  it('should throw when leaving non-existent queue', () => {
    expect(() => leaveQueue('non-existent-room', agent1)).toThrow('Queue not found');
  });

  it('should throw when agent not in queue', () => {
    joinQueue(roomId, agent1);
    expect(() => leaveQueue(roomId, agent2)).toThrow('Not in queue');
  });

  it('should update positions after removal', () => {
    joinQueue(roomId, agent1);
    joinQueue(roomId, agent2);
    joinQueue(roomId, agent3);
    leaveQueue(roomId, agent2);
    expect(getPosition(roomId, agent1)).toBe(1);
    expect(getPosition(roomId, agent3)).toBe(2);
    expect(getPosition(roomId, agent2)).toBe(-1);
  });

  it('should return empty queue for non-existent room', () => {
    expect(getQueue('non-existent-room')).toEqual([]);
    expect(getQueueLength('non-existent-room')).toBe(0);
  });

  it('should return null when popping empty queue', () => {
    expect(nextInQueue(roomId)).toBeNull();
  });

  it('should check if agent is in queue correctly', () => {
    joinQueue(roomId, agent1);
    expect(isInQueue(roomId, agent1)).toBe(true);
    expect(isInQueue(roomId, agent2)).toBe(false);
    expect(isInQueue('other-room', agent1)).toBe(false);
  });

  it('should get full queue details', () => {
    joinQueue(roomId, agent1);
    joinQueue(roomId, agent2);
    const queue = getQueue(roomId);
    expect(queue.length).toBe(2);
    expect(queue[0].agentId).toBe(agent1);
    expect(queue[1].agentId).toBe(agent2);
    expect(queue[0].joinedAt).toBeDefined();
  });

  it('should handle multiple rooms independently', () => {
    const room1 = `room-A-${Date.now()}`;
    const room2 = `room-B-${Date.now()}`;
    joinQueue(room1, agent1);
    joinQueue(room2, agent2);
    expect(isInQueue(room1, agent1)).toBe(true);
    expect(isInQueue(room1, agent2)).toBe(false);
    expect(isInQueue(room2, agent1)).toBe(false);
    expect(isInQueue(room2, agent2)).toBe(true);
  });

  it('should track join timestamps', () => {
    const beforeJoin = new Date().toISOString();
    joinQueue(roomId, agent1);
    const timestamp = getQueue(roomId)[0].joinedAt;
    expect(timestamp).toBeDefined();
    expect(timestamp >= beforeJoin).toBe(true);
    expect(timestamp <= new Date().toISOString()).toBe(true);
  });

  it('should allow rejoining after leaving', () => {
    joinQueue(roomId, agent1);
    leaveQueue(roomId, agent1);
    expect(() => joinQueue(roomId, agent1)).not.toThrow();
    expect(isInQueue(roomId, agent1)).toBe(true);
  });

  it('should return -1 for position when not in queue', () => {
    expect(getPosition(roomId, agent1)).toBe(-1);
    expect(getPosition('non-existent', agent1)).toBe(-1);
  });
});
