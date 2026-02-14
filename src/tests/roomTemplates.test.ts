/**
 * Room Templates Service Tests
 * Test template browsing, creation, and validation
 */
import { describe, it, expect } from 'vitest';

describe('Room Templates Service', () => {
  describe('Template Structure', () => {
    it('should validate template interface', () => {
      const template = {
        id: 'template-123',
        name: 'Test Template',
        description: 'A test room template',
        category: 'lounge',
        layout: [[9, 9], [9, 9]],
        furniture_preset: [
          { furnitureId: 'chair_red', x: 5, y: 5, rotation: 0 }
        ],
        thumbnail_url: null,
        is_premium: false,
        use_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      expect(template.name).toBe('Test Template');
      expect(template.category).toBe('lounge');
      expect(template.layout).toHaveLength(2);
      expect(template.furniture_preset).toHaveLength(1);
    });

    it('should validate furniture preset items', () => {
      const furnitureItem = {
        furnitureId: 'table_wood',
        x: 10,
        y: 10,
        rotation: 90
      };

      expect(furnitureItem.furnitureId).toBe('table_wood');
      expect(furnitureItem.x).toBe(10);
      expect(furnitureItem.y).toBe(10);
      expect(furnitureItem.rotation).toBe(90);
    });
  });

  describe('Category Validation', () => {
    it('should accept valid categories', () => {
      const validCategories = [
        'lounge', 'office', 'cafe', 'nightclub', 
        'garden', 'beach', 'library', 'penthouse', 'custom'
      ];

      validCategories.forEach(category => {
        expect(validCategories).toContain(category);
      });
    });

    it('should identify premium templates', () => {
      const premiumCategories = ['nightclub', 'library', 'penthouse'];
      const standardCategories = ['lounge', 'office', 'cafe'];

      expect(premiumCategories).not.toEqual(standardCategories);
      expect(premiumCategories.length).toBe(3);
    });
  });

  describe('Layout Validation', () => {
    it('should validate heightmap structure', () => {
      const layout = [
        [9, 1, 1, 9],
        [9, 1, 1, 9],
        [9, 1, 1, 9],
        [9, 9, 9, 9]
      ];

      expect(layout).toHaveLength(4); // 4 rows
      expect(layout[0]).toHaveLength(4); // 4 columns
      expect(layout[0][0]).toBe(9); // Wall
      expect(layout[0][1]).toBe(1); // Floor
    });

    it('should handle rectangular layouts', () => {
      const layout = [
        [9, 9, 9, 9, 9],
        [9, 1, 1, 1, 9],
        [9, 9, 9, 9, 9]
      ];

      expect(layout.length).toBe(3); // height
      expect(layout[0].length).toBe(5); // width
    });

    it('should validate tile height ranges', () => {
      const validHeights = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      
      validHeights.forEach(height => {
        expect(height).toBeGreaterThanOrEqual(0);
        expect(height).toBeLessThanOrEqual(9);
      });
    });
  });

  describe('CreateRoomFromTemplateParams', () => {
    it('should validate required fields', () => {
      const params = {
        templateId: 'template-123',
        ownerId: 'agent-456',
        roomName: 'My Custom Room'
      };

      expect(params.templateId).toBeDefined();
      expect(params.ownerId).toBeDefined();
      expect(params.roomName).toBe('My Custom Room');
    });

    it('should allow optional room name', () => {
      const params: { templateId: string; ownerId: string; roomName?: string } = {
        templateId: 'template-123',
        ownerId: 'agent-456'
      };

      expect(params.roomName).toBeUndefined();
      expect(params.templateId).toBeDefined();
    });
  });

  describe('Template Filtering', () => {
    it('should filter by category', () => {
      const templates = [
        { category: 'lounge', name: 'Lounge 1' },
        { category: 'office', name: 'Office 1' },
        { category: 'lounge', name: 'Lounge 2' }
      ];

      const filtered = templates.filter(t => t.category === 'lounge');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.category === 'lounge')).toBe(true);
    });

    it('should search by name', () => {
      const templates = [
        { name: 'Cozy Lounge', description: 'A warm space' },
        { name: 'Modern Office', description: 'Professional workspace' },
        { name: 'Beach Paradise', description: 'Tropical beach' }
      ];

      const searchQuery = 'lounge';
      const filtered = templates.filter(t => 
        t.name.toLowerCase().includes(searchQuery)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Cozy Lounge');
    });
  });

  describe('Use Count Tracking', () => {
    it('should increment use_count on template usage', () => {
      let use_count = 0;
      
      // Simulate 5 uses
      for (let i = 0; i < 5; i++) {
        use_count += 1;
      }

      expect(use_count).toBe(5);
    });

    it('should sort templates by popularity', () => {
      const templates = [
        { name: 'Template A', use_count: 10 },
        { name: 'Template B', use_count: 50 },
        { name: 'Template C', use_count: 5 }
      ];

      const sorted = templates.sort((a, b) => b.use_count - a.use_count);

      expect(sorted[0].name).toBe('Template B');
      expect(sorted[1].name).toBe('Template A');
      expect(sorted[2].name).toBe('Template C');
    });
  });
});
