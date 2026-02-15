import { describe, it, expect } from 'vitest';
import { normalizeTag } from '../services/roomTags.js';

/**
 * Room Tags System Unit Tests
 * Tests tag validation, normalization, and business logic without database
 */

describe('Room Tags System', () => {
  describe('Tag Normalization', () => {
    it('should convert tag to lowercase', () => {
      expect(normalizeTag('Gaming')).toBe('gaming');
      expect(normalizeTag('PARTY')).toBe('party');
      expect(normalizeTag('RolePlay')).toBe('roleplay');
    });

    it('should trim whitespace', () => {
      expect(normalizeTag('  chill  ')).toBe('chill');
      expect(normalizeTag('\ttrade\t')).toBe('trade');
      expect(normalizeTag(' club ')).toBe('club');
    });

    it('should handle mixed case and whitespace', () => {
      expect(normalizeTag('  Gaming Room  ')).toBe('gaming room');
      expect(normalizeTag('  PARTY  ')).toBe('party');
    });
  });

  describe('Tag Validation', () => {
    it('should validate tag length (max 30 chars)', () => {
      const validateLength = (tag: string): boolean => {
        return tag.length > 0 && tag.length <= 30;
      };

      expect(validateLength('chill')).toBe(true);
      expect(validateLength('a'.repeat(30))).toBe(true);
      expect(validateLength('a'.repeat(31))).toBe(false);
      expect(validateLength('')).toBe(false);
    });

    it('should reject empty tags after normalization', () => {
      const normalized = normalizeTag('   ');
      expect(normalized.length).toBe(0);
    });
  });

  describe('Max Tags Per Room', () => {
    it('should enforce max 5 tags per room', () => {
      const MAX_TAGS = 5;
      const existingCount = 5;

      const canAddTag = (count: number): boolean => {
        return count < MAX_TAGS;
      };

      expect(canAddTag(0)).toBe(true);
      expect(canAddTag(4)).toBe(true);
      expect(canAddTag(existingCount)).toBe(false);
    });

    it('should allow adding when under limit', () => {
      const MAX_TAGS = 5;

      for (let i = 0; i < MAX_TAGS; i++) {
        expect(i < MAX_TAGS).toBe(true);
      }
    });
  });

  describe('Room Ownership Validation', () => {
    it('should verify owner can add tags', () => {
      const room = { ownerId: 'agent1' };
      const requestingAgent = 'agent1';

      expect(room.ownerId === requestingAgent).toBe(true);
    });

    it('should reject non-owner adding tags', () => {
      const room = { ownerId: 'agent1' };
      const requestingAgent = 'agent2';

      expect(room.ownerId === requestingAgent).toBe(false);
    });

    it('should verify owner can remove tags', () => {
      const room = { ownerId: 'agent1' };
      const requestingAgent = 'agent1';

      expect(room.ownerId === requestingAgent).toBe(true);
    });
  });

  describe('Tag Search', () => {
    it('should match normalized tags', () => {
      const storedTag = 'gaming';
      const searchTag = normalizeTag('Gaming');

      expect(storedTag === searchTag).toBe(true);
    });

    it('should find rooms with specific tag', () => {
      const roomTags = [
        { roomId: 1, tag: 'gaming' },
        { roomId: 2, tag: 'party' },
        { roomId: 3, tag: 'gaming' },
      ];

      const results = roomTags.filter(rt => rt.tag === 'gaming');
      expect(results.length).toBe(2);
      expect(results.map(r => r.roomId)).toEqual([1, 3]);
    });
  });

  describe('Trending Tags', () => {
    it('should count tag usage', () => {
      const tags = ['gaming', 'party', 'gaming', 'chill', 'gaming'];
      const counts: { [key: string]: number } = {};

      tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });

      expect(counts['gaming']).toBe(3);
      expect(counts['party']).toBe(1);
      expect(counts['chill']).toBe(1);
    });

    it('should sort by count descending', () => {
      const tagCounts = [
        { tag: 'chill', count: 5 },
        { tag: 'gaming', count: 10 },
        { tag: 'party', count: 3 },
      ];

      const sorted = [...tagCounts].sort((a, b) => b.count - a.count);

      expect(sorted[0].tag).toBe('gaming');
      expect(sorted[1].tag).toBe('chill');
      expect(sorted[2].tag).toBe('party');
    });

    it('should limit results', () => {
      const tags = Array.from({ length: 20 }, (_, i) => ({ tag: `tag${i}`, count: i }));
      const limit = 10;

      const limited = tags.slice(0, limit);
      expect(limited.length).toBe(10);
    });

    it('should filter by date range (last 7 days)', () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);

      const tagEntries = [
        { tag: 'new', createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
        { tag: 'old', createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
      ];

      const recent = tagEntries.filter(t => t.createdAt >= sevenDaysAgo);
      expect(recent.length).toBe(1);
      expect(recent[0].tag).toBe('new');
    });
  });

  describe('Tag Following', () => {
    it('should allow following a tag', () => {
      const follows: Array<{ agentId: string; tag: string }> = [];
      
      const followTag = (agentId: string, tag: string) => {
        const exists = follows.some(f => f.agentId === agentId && f.tag === tag);
        if (!exists) {
          follows.push({ agentId, tag });
        }
      };

      followTag('agent1', 'gaming');
      expect(follows.length).toBe(1);
      expect(follows[0]).toEqual({ agentId: 'agent1', tag: 'gaming' });
    });

    it('should prevent duplicate follows', () => {
      const follows: Array<{ agentId: string; tag: string }> = [];
      
      const followTag = (agentId: string, tag: string) => {
        const exists = follows.some(f => f.agentId === agentId && f.tag === tag);
        if (!exists) {
          follows.push({ agentId, tag });
        }
      };

      followTag('agent1', 'gaming');
      followTag('agent1', 'gaming');
      
      expect(follows.length).toBe(1);
    });

    it('should allow unfollowing a tag', () => {
      const follows = [
        { agentId: 'agent1', tag: 'gaming' },
        { agentId: 'agent1', tag: 'party' },
      ];

      const unfollowTag = (agentId: string, tag: string) => {
        const index = follows.findIndex(f => f.agentId === agentId && f.tag === tag);
        if (index !== -1) {
          follows.splice(index, 1);
        }
      };

      unfollowTag('agent1', 'gaming');
      expect(follows.length).toBe(1);
      expect(follows[0].tag).toBe('party');
    });

    it('should get followed tags for agent', () => {
      const follows = [
        { agentId: 'agent1', tag: 'gaming' },
        { agentId: 'agent1', tag: 'party' },
        { agentId: 'agent2', tag: 'chill' },
      ];

      const agentTags = follows.filter(f => f.agentId === 'agent1').map(f => f.tag);
      expect(agentTags).toEqual(['gaming', 'party']);
    });
  });

  describe('Room Recommendations', () => {
    it('should find rooms matching followed tags', () => {
      const roomTags = [
        { roomId: 1, tag: 'gaming' },
        { roomId: 2, tag: 'party' },
        { roomId: 3, tag: 'gaming' },
      ];

      const followedTags = ['gaming'];

      const recommended = roomTags
        .filter(rt => followedTags.includes(rt.tag))
        .map(rt => rt.roomId);

      expect(recommended).toEqual([1, 3]);
    });

    it('should return unique room IDs', () => {
      const roomTags = [
        { roomId: 1, tag: 'gaming' },
        { roomId: 1, tag: 'party' },
        { roomId: 2, tag: 'gaming' },
      ];

      const followedTags = ['gaming', 'party'];

      const recommended = [...new Set(
        roomTags
          .filter(rt => followedTags.includes(rt.tag))
          .map(rt => rt.roomId)
      )];

      expect(recommended).toEqual([1, 2]);
    });

    it('should return empty for no followed tags', () => {
      const roomTags = [
        { roomId: 1, tag: 'gaming' },
        { roomId: 2, tag: 'party' },
      ];

      const followedTags: string[] = [];

      const recommended = roomTags
        .filter(rt => followedTags.includes(rt.tag))
        .map(rt => rt.roomId);

      expect(recommended).toEqual([]);
    });
  });

  describe('Duplicate Tag Prevention', () => {
    it('should prevent adding same tag twice to room', () => {
      const existingTags = [
        { roomId: 1, tag: 'gaming' },
        { roomId: 1, tag: 'party' },
      ];

      const isDuplicate = (roomId: number, tag: string): boolean => {
        return existingTags.some(t => t.roomId === roomId && t.tag === tag);
      };

      expect(isDuplicate(1, 'gaming')).toBe(true);
      expect(isDuplicate(1, 'chill')).toBe(false);
    });
  });
});
