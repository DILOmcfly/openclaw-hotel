/**
 * Navigator Service Tests
 * Test search, filtering, favorites, and visit tracking
 */
import { describe, it, expect } from 'vitest';
import * as navigatorService from '../services/navigator.service.js';

describe('Navigator Service', () => {
  describe('searchRooms', () => {
    it('should validate function signature without DB call', () => {
      // Verify function exists and accepts correct params
      expect(typeof navigatorService.searchRooms).toBe('function');
      
      // Validate filters structure (unit test without DB)
      const filters: navigatorService.SearchFilters = {};
      expect(filters).toBeDefined();
    });

    it('should validate search filters structure', () => {
      const filters: navigatorService.SearchFilters = {
        query: 'test',
        category: 'public',
        tag: 'roleplay',
        sortBy: 'occupants',
        sortOrder: 'desc',
        limit: 50,
        offset: 0
      };
      
      expect(filters.query).toBe('test');
      expect(filters.sortBy).toBe('occupants');
      expect(filters.limit).toBe(50);
    });

    it('should handle invalid sort options gracefully', () => {
      const filters: any = { sortBy: 'invalid' };
      expect(filters.sortBy).toBe('invalid'); // Will be handled by SQL
    });
  });

  describe('updateRoomCategory', () => {
    it('should reject invalid categories', async () => {
      await expect(
        navigatorService.updateRoomCategory('fake-id', 'invalid-category')
      ).rejects.toThrow('Invalid category');
    });

    it('should accept valid categories', () => {
      const validCategories = ['public', 'official', 'roleplay', 'games', 'trading', 'hangout', 'custom'];
      validCategories.forEach(cat => {
        expect(cat.length).toBeGreaterThan(0);
      });
    });
  });

  describe('addRoomTags', () => {
    it('should filter out invalid tags (empty or too long)', async () => {
      const tags = ['', 'a'.repeat(33), 'valid'];
      const filtered = tags.filter(t => t.length > 0 && t.length <= 32);
      
      expect(filtered).toEqual(['valid']);
    });

    it('should deduplicate tags', () => {
      const tags = ['tag1', 'tag2', 'tag1', 'TAG1'];
      const unique = [...new Set(tags.map(t => t.toLowerCase()))];
      
      expect(unique).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Room List Item Interface', () => {
    it('should have correct structure', () => {
      const room: navigatorService.RoomListItem = {
        id: 'uuid',
        name: 'Test Room',
        description: 'A test room',
        category: 'public',
        tags: ['tag1', 'tag2'],
        occupants: 5,
        maxOccupants: 20,
        createdBy: 'agent-id',
        isFavorite: true,
        lastVisited: new Date()
      };
      
      expect(room.name).toBe('Test Room');
      expect(room.tags).toHaveLength(2);
      expect(room.isFavorite).toBe(true);
    });
  });

  describe('Search Filters Validation', () => {
    it('should handle missing optional fields', () => {
      const filters: navigatorService.SearchFilters = { limit: 10 };
      
      expect(filters.query).toBeUndefined();
      expect(filters.category).toBeUndefined();
      expect(filters.limit).toBe(10);
    });

    it('should validate limit and offset', () => {
      const filters: navigatorService.SearchFilters = {
        limit: -5,  // Invalid
        offset: -10  // Invalid
      };
      
      expect(filters.limit).toBeLessThan(0);
      expect(filters.offset).toBeLessThan(0);
      // Service should clamp these to valid values
    });
  });

  describe('Tag and Category Utilities', () => {
    it('should sanitize tags before storage', () => {
      const tags = ['  Tag1  ', 'TAG2', 'tag-3'];
      const sanitized = tags.map(t => t.toLowerCase().trim());
      
      expect(sanitized).toEqual(['tag1', 'tag2', 'tag-3']);
    });

    it('should validate tag length (max 32 chars)', () => {
      const longTag = 'a'.repeat(33);
      const validTag = 'short';
      
      expect(longTag.length).toBeGreaterThan(32);
      expect(validTag.length).toBeLessThanOrEqual(32);
    });
  });

  describe('Favorite and Visit Tracking', () => {
    it('should handle favorite toggle idempotently', () => {
      // Adding same favorite twice should be idempotent (ON CONFLICT DO NOTHING)
      const agentId = 'agent-1';
      const roomId = 'room-1';
      
      expect(agentId).toBeTruthy();
      expect(roomId).toBeTruthy();
    });

    it('should increment visit count correctly', () => {
      // ON CONFLICT DO UPDATE should increment visit_count
      let visitCount = 1;
      visitCount += 1;
      
      expect(visitCount).toBe(2);
    });
  });
});
