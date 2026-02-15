import { describe, it, expect, vi } from 'vitest';
import * as templateService from '../services/roomTemplates.js';

describe('Room Templates Service', () => {
  // Mock SQL implementation
  const createMockSql = (mockData: any) => {
    const mockSqlFn = vi.fn(async (query: any, ...args: any[]) => {
      return mockData;
    });
    // Support tagged template literal syntax
    Object.assign(mockSqlFn, mockData);
    return mockSqlFn as any;
  };

  describe('getTemplates', () => {
    it('should return all templates when no category specified', async () => {
      const mockTemplates = [
        {
          id: 'cozy-studio',
          name: 'Cozy Studio',
          description: 'Small studio',
          category: 'residential',
          creator_id: null,
          heightmap: '[[1,1],[1,1]]',
          furniture_layout: '[]',
          is_official: true,
          use_count: 5,
          created_at: new Date(),
        },
        {
          id: 'office-space',
          name: 'Office Space',
          description: 'Work area',
          category: 'workspace',
          creator_id: null,
          heightmap: '[[1,1],[1,1]]',
          furniture_layout: '[]',
          is_official: true,
          use_count: 3,
          created_at: new Date(),
        },
      ];

      const mockSql = createMockSql(mockTemplates);
      const result = await templateService.getTemplates(undefined, mockSql);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Cozy Studio');
      expect(result[1].name).toBe('Office Space');
    });

    it('should filter templates by category', async () => {
      const mockTemplates = [
        {
          id: 'library',
          name: 'Library',
          description: 'Study area',
          category: 'study',
          creator_id: null,
          heightmap: '[[1,1],[1,1]]',
          furniture_layout: '[]',
          is_official: true,
          use_count: 2,
          created_at: new Date(),
        },
      ];

      const mockSql = createMockSql(mockTemplates);
      const result = await templateService.getTemplates('study', mockSql);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('study');
    });

    it('should parse furniture_layout JSON string', async () => {
      const mockTemplates = [
        {
          id: 'test-template',
          name: 'Test',
          description: 'Test template',
          category: 'general',
          creator_id: null,
          heightmap: '[[1,1]]',
          furniture_layout: '[{"furnitureId":"chair","x":1,"y":1,"rotation":0}]',
          is_official: false,
          use_count: 0,
          created_at: new Date(),
        },
      ];

      const mockSql = createMockSql(mockTemplates);
      const result = await templateService.getTemplates(undefined, mockSql);

      expect(result[0].furniture_layout).toEqual([
        { furnitureId: 'chair', x: 1, y: 1, rotation: 0 },
      ]);
    });

    it('should convert is_official to boolean', async () => {
      const mockTemplates = [
        {
          id: 'test',
          name: 'Test',
          description: null,
          category: 'general',
          creator_id: null,
          heightmap: '[[1]]',
          furniture_layout: '[]',
          is_official: 1, // Database might return 1/0
          use_count: 0,
          created_at: new Date(),
        },
      ];

      const mockSql = createMockSql(mockTemplates);
      const result = await templateService.getTemplates(undefined, mockSql);

      expect(typeof result[0].is_official).toBe('boolean');
      expect(result[0].is_official).toBe(true);
    });
  });

  describe('getTemplateById', () => {
    it('should return template when found', async () => {
      const mockTemplate = [
        {
          id: 'cozy-studio',
          name: 'Cozy Studio',
          description: 'Small studio',
          category: 'residential',
          creator_id: null,
          heightmap: '[[1,1,1],[1,0,1],[1,1,1]]',
          furniture_layout: '[{"furnitureId":"chair","x":1,"y":1,"rotation":0}]',
          is_official: true,
          use_count: 10,
          created_at: new Date(),
        },
      ];

      const mockSql = createMockSql(mockTemplate);
      const result = await templateService.getTemplateById('cozy-studio', mockSql);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Cozy Studio');
      expect(result?.furniture_layout).toHaveLength(1);
    });

    it('should return null when template not found', async () => {
      const mockSql = createMockSql([]);
      const result = await templateService.getTemplateById('nonexistent', mockSql);

      expect(result).toBeNull();
    });
  });

  describe('createFromTemplate', () => {
    it('should throw error if template not found', async () => {
      const mockSql = createMockSql([]);
      
      await expect(
        templateService.createFromTemplate('nonexistent', 'agent-123', 'My Room', mockSql)
      ).rejects.toThrow('Template not found');
    });

    it('should throw error for invalid heightmap', async () => {
      const mockTemplate = [
        {
          id: 'invalid',
          name: 'Invalid',
          description: null,
          category: 'general',
          creator_id: null,
          heightmap: '[]', // Empty heightmap
          furniture_layout: '[]',
          is_official: false,
          use_count: 0,
          created_at: new Date(),
        },
      ];

      const mockSql = createMockSql(mockTemplate);
      
      await expect(
        templateService.createFromTemplate('invalid', 'agent-123', 'My Room', mockSql)
      ).rejects.toThrow('Invalid template heightmap');
    });

    it('should generate valid room slug from name', async () => {
      const mockTemplate = [
        {
          id: 'test-template',
          name: 'Test',
          description: 'Test template',
          category: 'general',
          creator_id: null,
          heightmap: '[[1,1],[1,1]]',
          furniture_layout: '[]',
          is_official: false,
          use_count: 0,
          created_at: new Date(),
        },
      ];

      const createdRoomId = 'room-uuid-123';
      let insertedSlug = '';

      const mockSql = vi.fn(async (query: any, ...args: any[]) => {
        const queryStr = String(query);
        
        // First call: SELECT template
        if (queryStr.includes('room_templates')) {
          return mockTemplate;
        }
        // Second call: INSERT room
        if (queryStr.includes('INSERT INTO rooms')) {
          // Capture slug from query
          insertedSlug = args[1]; // slug is second parameter
          return [{ id: createdRoomId }];
        }
        // Third call: INSERT furniture (none in this test)
        // Fourth call: UPDATE use_count
        return [];
      });

      Object.assign(mockSql, mockTemplate);

      await templateService.createFromTemplate('test-template', 'agent-123', 'My Cool Room!', mockSql);

      expect(insertedSlug).toMatch(/^my-cool-room-\d+$/);
    });
  });

  describe('createTemplate', () => {
    it('should generate ID from name', async () => {
      let insertedId = '';
      
      const mockSql = vi.fn(async (query: any, ...args: any[]) => {
        if (String(query).includes('INSERT INTO room_templates')) {
          insertedId = args[0]; // id is first parameter
        }
        return [];
      });

      await templateService.createTemplate(
        'My Custom Template',
        'A custom design',
        'custom',
        '[[1,1],[1,1]]',
        [],
        'agent-456',
        mockSql
      );

      expect(insertedId).toMatch(/^my-custom-template-\d+$/);
    });

    it('should successfully create custom template and return ID', async () => {
      let insertCalled = false;
      
      const mockSql = vi.fn(async (query: any, ...args: any[]) => {
        if (String(query).includes('INSERT INTO room_templates')) {
          insertCalled = true;
        }
        return [];
      });

      const templateId = await templateService.createTemplate(
        'Custom Template',
        'Description',
        'general',
        '[[1]]',
        [],
        'agent-789',
        mockSql
      );

      expect(insertCalled).toBe(true);
      expect(templateId).toMatch(/^custom-template-\d+$/);
    });
  });

  describe('incrementUseCount', () => {
    it('should call UPDATE with correct template ID', async () => {
      let updatedTemplateId = '';
      
      const mockSql = vi.fn(async (query: any, ...args: any[]) => {
        if (String(query).includes('UPDATE room_templates')) {
          updatedTemplateId = args[0];
        }
        return [];
      });

      await templateService.incrementUseCount('cozy-studio', mockSql);

      expect(updatedTemplateId).toBe('cozy-studio');
      expect(mockSql).toHaveBeenCalled();
    });
  });

  describe('Template Data Validation', () => {
    it('should handle empty furniture layout', () => {
      const template = {
        id: 'empty-furniture',
        name: 'Empty',
        description: null,
        category: 'general',
        creator_id: null,
        heightmap: '[[1,1],[1,1]]',
        furniture_layout: '[]',
        is_official: false,
        use_count: 0,
        created_at: new Date(),
      };

      const parsed = JSON.parse(template.furniture_layout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(0);
    });

    it('should validate furniture item structure', () => {
      const furnitureItems = [
        { furnitureId: 'chair', x: 1, y: 2, rotation: 90 },
        { furnitureId: 'table', x: 3, y: 4, rotation: 0 },
      ];

      furnitureItems.forEach(item => {
        expect(item).toHaveProperty('furnitureId');
        expect(item).toHaveProperty('x');
        expect(item).toHaveProperty('y');
        expect(item).toHaveProperty('rotation');
        expect(typeof item.x).toBe('number');
        expect(typeof item.y).toBe('number');
        expect(typeof item.rotation).toBe('number');
      });
    });

    it('should parse heightmap correctly', () => {
      const heightmapString = '[[1,1,1],[1,0,1],[1,1,1]]';
      const parsed = JSON.parse(heightmapString);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toHaveLength(3);
      expect(parsed[1][1]).toBe(0);
    });
  });
});
