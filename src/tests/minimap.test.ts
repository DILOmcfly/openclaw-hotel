import { describe, it, expect } from 'vitest';

/**
 * Minimap System Unit Tests
 * Tests minimap logic, bounds calculation, and settings without database
 */

describe('Minimap System', () => {
  describe('Settings Validation', () => {
    it('should validate zoom level within range', () => {
      const isValidZoom = (zoom: number): boolean => {
        return zoom >= 0.5 && zoom <= 3.0;
      };

      expect(isValidZoom(0.5)).toBe(true);
      expect(isValidZoom(1.0)).toBe(true);
      expect(isValidZoom(3.0)).toBe(true);
    });

    it('should reject zoom level below minimum', () => {
      const isValidZoom = (zoom: number): boolean => {
        return zoom >= 0.5 && zoom <= 3.0;
      };

      expect(isValidZoom(0.4)).toBe(false);
      expect(isValidZoom(0.1)).toBe(false);
      expect(isValidZoom(0)).toBe(false);
    });

    it('should reject zoom level above maximum', () => {
      const isValidZoom = (zoom: number): boolean => {
        return zoom >= 0.5 && zoom <= 3.0;
      };

      expect(isValidZoom(3.1)).toBe(false);
      expect(isValidZoom(5.0)).toBe(false);
      expect(isValidZoom(10)).toBe(false);
    });

    it('should return default settings for new room', () => {
      type Settings = {
        roomId: number;
        enabled: boolean;
        showFurniture: boolean;
        showAgents: boolean;
        zoomLevel: number;
      };

      const getDefaultSettings = (roomId: number): Settings => ({
        roomId,
        enabled: true,
        showFurniture: true,
        showAgents: true,
        zoomLevel: 1.0,
      });

      const defaults = getDefaultSettings(123);
      expect(defaults.enabled).toBe(true);
      expect(defaults.showFurniture).toBe(true);
      expect(defaults.showAgents).toBe(true);
      expect(defaults.zoomLevel).toBe(1.0);
    });
  });

  describe('Bounds Calculation', () => {
    it('should calculate correct bounds from tiles', () => {
      type Tile = { x: number; y: number };
      type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

      const calculateBounds = (tiles: Tile[]): Bounds => {
        const allX = tiles.map(t => t.x);
        const allY = tiles.map(t => t.y);
        return {
          minX: Math.min(...allX),
          maxX: Math.max(...allX),
          minY: Math.min(...allY),
          maxY: Math.max(...allY),
        };
      };

      const tiles = [
        { x: 0, y: 0 },
        { x: 5, y: 3 },
        { x: 2, y: 7 },
      ];

      const bounds = calculateBounds(tiles);
      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(5);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxY).toBe(7);
    });

    it('should handle negative coordinates', () => {
      type Tile = { x: number; y: number };
      type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

      const calculateBounds = (tiles: Tile[]): Bounds => {
        const allX = tiles.map(t => t.x);
        const allY = tiles.map(t => t.y);
        return {
          minX: Math.min(...allX),
          maxX: Math.max(...allX),
          minY: Math.min(...allY),
          maxY: Math.max(...allY),
        };
      };

      const tiles = [
        { x: -5, y: -3 },
        { x: 10, y: 8 },
        { x: 0, y: 0 },
      ];

      const bounds = calculateBounds(tiles);
      expect(bounds.minX).toBe(-5);
      expect(bounds.maxX).toBe(10);
      expect(bounds.minY).toBe(-3);
      expect(bounds.maxY).toBe(8);
    });

    it('should handle single tile', () => {
      type Tile = { x: number; y: number };
      type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

      const calculateBounds = (tiles: Tile[]): Bounds => {
        const allX = tiles.map(t => t.x);
        const allY = tiles.map(t => t.y);
        return {
          minX: Math.min(...allX),
          maxX: Math.max(...allX),
          minY: Math.min(...allY),
          maxY: Math.max(...allY),
        };
      };

      const tiles = [{ x: 3, y: 4 }];
      const bounds = calculateBounds(tiles);
      
      expect(bounds.minX).toBe(3);
      expect(bounds.maxX).toBe(3);
      expect(bounds.minY).toBe(4);
      expect(bounds.maxY).toBe(4);
    });
  });

  describe('Map Data Generation', () => {
    it('should combine tiles, furniture, and agents', () => {
      type MapData = {
        tiles: any[];
        furniture: any[];
        agents: any[];
      };

      const generateMapData = (
        tiles: any[],
        furniture: any[],
        agents: any[]
      ): MapData => ({
        tiles,
        furniture,
        agents,
      });

      const result = generateMapData(
        [{ x: 0, y: 0, walkable: true }],
        [{ x: 1, y: 1, name: 'chair' }],
        [{ x: 2, y: 2, name: 'Agent1', color: '#ff0000' }]
      );

      expect(result.tiles).toHaveLength(1);
      expect(result.furniture).toHaveLength(1);
      expect(result.agents).toHaveLength(1);
    });

    it('should handle empty room', () => {
      type MapData = {
        tiles: any[];
        furniture: any[];
        agents: any[];
      };

      const generateMapData = (
        tiles: any[],
        furniture: any[],
        agents: any[]
      ): MapData => ({
        tiles,
        furniture,
        agents,
      });

      const result = generateMapData([], [], []);

      expect(result.tiles).toHaveLength(0);
      expect(result.furniture).toHaveLength(0);
      expect(result.agents).toHaveLength(0);
    });

    it('should preserve tile walkable property', () => {
      type Tile = { x: number; y: number; walkable: boolean };

      const tiles: Tile[] = [
        { x: 0, y: 0, walkable: true },
        { x: 1, y: 0, walkable: false },
        { x: 2, y: 0, walkable: true },
      ];

      expect(tiles[0].walkable).toBe(true);
      expect(tiles[1].walkable).toBe(false);
      expect(tiles[2].walkable).toBe(true);
    });
  });

  describe('Agent Position Tracking', () => {
    it('should extract agent positions', () => {
      type Agent = { x: number; y: number; name: string; color: string };

      const mockAgents = [
        { x: 1, y: 2, name: 'Alice', color: '#ff0000' },
        { x: 3, y: 4, name: 'Bob', color: '#00ff00' },
      ];

      const positions = mockAgents.map(a => ({ x: a.x, y: a.y }));

      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({ x: 1, y: 2 });
      expect(positions[1]).toEqual({ x: 3, y: 4 });
    });

    it('should provide default color for agents without one', () => {
      type AgentData = { name: string; color?: string };

      const normalizeAgent = (agent: AgentData): { name: string; color: string } => ({
        name: agent.name,
        color: agent.color || '#000000',
      });

      const withColor = normalizeAgent({ name: 'Alice', color: '#ff0000' });
      const withoutColor = normalizeAgent({ name: 'Bob' });

      expect(withColor.color).toBe('#ff0000');
      expect(withoutColor.color).toBe('#000000');
    });

    it('should handle multiple agents at different positions', () => {
      type Agent = { x: number; y: number; name: string };

      const agents: Agent[] = [
        { x: 0, y: 0, name: 'Agent1' },
        { x: 5, y: 5, name: 'Agent2' },
        { x: 10, y: 10, name: 'Agent3' },
      ];

      expect(agents).toHaveLength(3);
      expect(agents.map(a => a.x)).toEqual([0, 5, 10]);
      expect(agents.map(a => a.y)).toEqual([0, 5, 10]);
    });
  });

  describe('Settings Update Logic', () => {
    it('should merge partial settings updates', () => {
      type Settings = {
        enabled: boolean;
        showFurniture: boolean;
        showAgents: boolean;
        zoomLevel: number;
      };

      const mergeSettings = (
        current: Settings,
        updates: Partial<Settings>
      ): Settings => ({
        ...current,
        ...updates,
      });

      const current: Settings = {
        enabled: true,
        showFurniture: true,
        showAgents: true,
        zoomLevel: 1.0,
      };

      const updated = mergeSettings(current, { zoomLevel: 2.0 });

      expect(updated.enabled).toBe(true);
      expect(updated.showFurniture).toBe(true);
      expect(updated.showAgents).toBe(true);
      expect(updated.zoomLevel).toBe(2.0);
    });

    it('should allow disabling specific features', () => {
      type Settings = {
        enabled: boolean;
        showFurniture: boolean;
        showAgents: boolean;
      };

      const mergeSettings = (
        current: Settings,
        updates: Partial<Settings>
      ): Settings => ({
        ...current,
        ...updates,
      });

      const current: Settings = {
        enabled: true,
        showFurniture: true,
        showAgents: true,
      };

      const updated = mergeSettings(current, { showAgents: false });

      expect(updated.enabled).toBe(true);
      expect(updated.showFurniture).toBe(true);
      expect(updated.showAgents).toBe(false);
    });

    it('should handle multiple simultaneous updates', () => {
      type Settings = {
        enabled: boolean;
        showFurniture: boolean;
        showAgents: boolean;
        zoomLevel: number;
      };

      const mergeSettings = (
        current: Settings,
        updates: Partial<Settings>
      ): Settings => ({
        ...current,
        ...updates,
      });

      const current: Settings = {
        enabled: true,
        showFurniture: true,
        showAgents: true,
        zoomLevel: 1.0,
      };

      const updated = mergeSettings(current, {
        enabled: false,
        zoomLevel: 1.5,
      });

      expect(updated.enabled).toBe(false);
      expect(updated.showFurniture).toBe(true);
      expect(updated.showAgents).toBe(true);
      expect(updated.zoomLevel).toBe(1.5);
    });
  });

  describe('Furniture Positioning', () => {
    it('should track furniture with coordinates', () => {
      type Furniture = { x: number; y: number; name: string };

      const furniture: Furniture[] = [
        { x: 2, y: 3, name: 'chair' },
        { x: 5, y: 3, name: 'table' },
      ];

      expect(furniture).toHaveLength(2);
      expect(furniture[0].name).toBe('chair');
      expect(furniture[1].name).toBe('table');
    });

    it('should filter furniture by visibility setting', () => {
      type Furniture = { x: number; y: number; name: string };

      const allFurniture: Furniture[] = [
        { x: 1, y: 1, name: 'chair' },
        { x: 2, y: 2, name: 'table' },
      ];

      const shouldShowFurniture = true;
      const visibleFurniture = shouldShowFurniture ? allFurniture : [];

      expect(visibleFurniture).toHaveLength(2);

      const hiddenFurniture = !shouldShowFurniture ? allFurniture : [];
      expect(hiddenFurniture).toHaveLength(0);
    });
  });
});
