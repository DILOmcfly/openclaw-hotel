/**
 * Room Queue Service - In-memory queue system for full rooms
 */

interface QueueEntry {
  agentId: string;
  joinedAt: string;
}

const MAX_QUEUE_SIZE = 20;
const queues = new Map<string, QueueEntry[]>();

export function joinQueue(roomId: string, agentId: string): void {
  let queue = queues.get(roomId);
  if (!queue) {
    queue = [];
    queues.set(roomId, queue);
  }
  if (queue.some(entry => entry.agentId === agentId)) {
    throw new Error('Already in queue');
  }
  if (queue.length >= MAX_QUEUE_SIZE) {
    throw new Error(`Queue is full (max ${MAX_QUEUE_SIZE})`);
  }
  queue.push({ agentId, joinedAt: new Date().toISOString() });
}

export function leaveQueue(roomId: string, agentId: string): void {
  const queue = queues.get(roomId);
  if (!queue) throw new Error('Queue not found');
  const index = queue.findIndex(entry => entry.agentId === agentId);
  if (index === -1) throw new Error('Not in queue');
  queue.splice(index, 1);
}

export function getQueue(roomId: string): QueueEntry[] {
  return queues.get(roomId) || [];
}

export function getPosition(roomId: string, agentId: string): number {
  const queue = queues.get(roomId);
  if (!queue) return -1;
  const index = queue.findIndex(entry => entry.agentId === agentId);
  return index === -1 ? -1 : index + 1;
}

export function nextInQueue(roomId: string): string | null {
  const queue = queues.get(roomId);
  if (!queue || queue.length === 0) return null;
  const entry = queue.shift();
  return entry ? entry.agentId : null;
}

export function isInQueue(roomId: string, agentId: string): boolean {
  const queue = queues.get(roomId);
  return queue ? queue.some(entry => entry.agentId === agentId) : false;
}

export function getQueueLength(roomId: string): number {
  const queue = queues.get(roomId);
  return queue ? queue.length : 0;
}
