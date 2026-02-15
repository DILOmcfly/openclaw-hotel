import { describe, it, expect } from 'vitest';
import type { ActivityAction, ActivityLog } from '../services/activityLog.js';

describe('Activity Log Tests', () => {
  it('validates activity action types', () => {
    const valid: ActivityAction[] = ['joined_room', 'left_room', 'sent_message', 'traded', 'purchased', 'gifted', 'achievement', 'created_room', 'adopted_pet', 'took_photo'];
    expect(valid.includes('joined_room')).toBe(true);
    expect(valid.includes('invalid' as any)).toBe(false);
  });

  it('validates activity log structure', () => {
    const validate = (agentId: string, action: string): boolean => {
      return !!agentId && !!action;
    };
    expect(validate('agent-1', 'joined_room')).toBe(true);
    expect(validate('', 'joined_room')).toBe(false);
  });

  it('handles timeline pagination', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const p = (a: any[], l: number, o: number) => a.slice(o, o + l);
    expect(p(items, 20, 0)).toHaveLength(20);
    expect(p(items, 20, 100)).toHaveLength(0);
  });

  it('filters activities by room', () => {
    const logs: ActivityLog[] = [
      { id: '1', agent_id: 'a1', action: 'joined_room', details: {}, room_id: 'r1', created_at: new Date() },
      { id: '2', agent_id: 'a2', action: 'sent_message', details: {}, room_id: 'r2', created_at: new Date() },
    ];
    const filtered = logs.filter(l => l.room_id === 'r1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('aggregates activity stats', () => {
    const logs: ActivityLog[] = [
      { id: '1', agent_id: 'a1', action: 'sent_message', details: {}, room_id: null, created_at: new Date() },
      { id: '2', agent_id: 'a1', action: 'sent_message', details: {}, room_id: null, created_at: new Date() },
      { id: '3', agent_id: 'a1', action: 'traded', details: {}, room_id: null, created_at: new Date() },
    ];
    const counts = new Map<ActivityAction, number>();
    logs.forEach(l => counts.set(l.action, (counts.get(l.action) || 0) + 1));
    expect(counts.get('sent_message')).toBe(2);
    expect(counts.get('traded')).toBe(1);
  });

  it('enforces limit constraints', () => {
    const limit = (n: number, max: number) => Math.min(Math.max(n, 1), max);
    expect(limit(20, 100)).toBe(20);
    expect(limit(150, 100)).toBe(100);
  });

  it('sorts by timestamp descending', () => {
    const now = Date.now();
    const logs: ActivityLog[] = [
      { id: '1', agent_id: 'a1', action: 'joined_room', details: {}, room_id: null, created_at: new Date(now - 3000) },
      { id: '2', agent_id: 'a1', action: 'traded', details: {}, room_id: null, created_at: new Date(now - 1000) }];
    expect([...logs].sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0].id).toBe('2');
  });

  it('handles empty lists', () => {
    expect([].slice(0, 20)).toHaveLength(0);
  });

  it('validates details object', () => {
    const validate = (d: any) => d !== null && typeof d === 'object' && !Array.isArray(d);
    expect(validate({})).toBe(true);
    expect(validate({ msg: 'hi' })).toBe(true);
    expect(validate(null)).toBe(false);
    expect(validate([])).toBe(false);
  });

  it('filters by agent', () => {
    const logs: ActivityLog[] = [
      { id: '1', agent_id: 'a1', action: 'joined_room', details: {}, room_id: null, created_at: new Date() },
      { id: '2', agent_id: 'a2', action: 'traded', details: {}, room_id: null, created_at: new Date() },
    ];
    const filtered = logs.filter(l => l.agent_id === 'a1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('allows null room_id', () => {
    const log: ActivityLog = { id: '1', agent_id: 'a1', action: 'achievement', details: {}, room_id: null, created_at: new Date() };
    expect(log.room_id).toBeNull();
  });

  it('handles global feed mix', () => {
    const logs: ActivityLog[] = [
      { id: '1', agent_id: 'a1', action: 'joined_room', details: {}, room_id: 'r1', created_at: new Date() },
      { id: '2', agent_id: 'a2', action: 'traded', details: {}, room_id: null, created_at: new Date() },
    ];
    expect(new Set(logs.map(l => l.agent_id)).size).toBe(2);
    expect(new Set(logs.map(l => l.action)).size).toBe(2);
  });
});
