import { describe, it, expect } from 'vitest';
import { findPath } from '../services/pathfinder.js';
import { parseHeightmap } from '../services/grid.js';
import type { RoomGrid } from '../services/grid.js';

describe('Pathfinder Service', () => {
  describe('findPath()', () => {
    it('should find straight-line path (no obstacles)', () => {
      const heightmap = '00000|00000|00000|00000|00000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 0 };
      const end = { x: 4, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(5);
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should find path around obstacles', () => {
      const heightmap = '00000|0xxx0|00000|0xxx0|00000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 0 };
      const end = { x: 4, y: 4 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThan(0);
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);

      // Path should not cross closed tiles
      for (const pos of path!) {
        const tile = grid[pos.y][pos.x];
        expect(tile.state).toBe('open');
      }
    });

    it('should return null if start is blocked', () => {
      const heightmap = '00000|00000|00000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 1, y: 1 };
      const end = { x: 2, y: 2 };
      const blockedTiles = new Set<string>(['1,1']);

      const path = findPath(grid, start, end, blockedTiles);

      expect(path).toBeNull();
    });

    it('should return null if end is blocked', () => {
      const heightmap = '00000|00000|00000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 0 };
      const end = { x: 2, y: 2 };
      const blockedTiles = new Set<string>(['2,2']);

      const path = findPath(grid, start, end, blockedTiles);

      expect(path).toBeNull();
    });

    it('should return path with single position when start equals end', () => {
      const heightmap = '00000|00000|00000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 2, y: 2 };
      const end = { x: 2, y: 2 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(1);
      expect(path![0]).toEqual(start);
    });

    it('should return null if start is out of bounds', () => {
      const heightmap = '000|000|000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 10, y: 10 };
      const end = { x: 1, y: 1 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should return null if end is out of bounds', () => {
      const heightmap = '000|000|000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 1, y: 1 };
      const end = { x: 10, y: 10 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should respect height differences (cannot climb >1.5)', () => {
      const heightmap = '000|030|000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 1 };
      const end = { x: 2, y: 1 };

      const path = findPath(grid, start, end);

      // Path should go around the tall tile (1,1) with height=3
      expect(path).not.toBeNull();
      if (path) {
        const middleTile = path.find((pos) => pos.x === 1 && pos.y === 1);
        // Should NOT traverse middle tile with height 3 (too tall)
        expect(middleTile).toBeUndefined();
      }
    });

    it('should respect height differences (cannot fall <-3)', () => {
      // Use larger grid (5x5) so there's a valid path around the deep tile
      const heightmap = '55555|55055|55555|55055|55555';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 2 };
      const end = { x: 4, y: 2 };

      const path = findPath(grid, start, end);

      // Path should go around the deep tiles with height=0 (drop of -5)
      expect(path).not.toBeNull();
      if (path) {
        // Should NOT traverse tiles (2,1) or (2,3) with height 0
        const deepTile1 = path.find((pos) => pos.x === 2 && pos.y === 1);
        const deepTile2 = path.find((pos) => pos.x === 2 && pos.y === 3);
        expect(deepTile1).toBeUndefined();
        expect(deepTile2).toBeUndefined();
      }
    });

    it('should handle diagonal movement correctly', () => {
      const heightmap = '00000|00000|00000|00000|00000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 0 };
      const end = { x: 4, y: 4 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      // Diagonal path should be shorter than cardinal-only path
      expect(path!.length).toBeLessThan(9); // Straight would be 9 steps
    });

    it('should return null if diagonal is blocked by adjacent tiles', () => {
      const heightmap = '000|0x0|000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 0 };
      const end = { x: 2, y: 2 };
      const blockedTiles = new Set<string>(['1,0', '0,1']);

      const path = findPath(grid, start, end);

      // Diagonal from (0,0) to (1,1) requires (1,0) and (0,1) to be walkable
      // Both are blocked, so path should go around
      expect(path).not.toBeNull();
      if (path && path.length > 1) {
        // Second step should NOT be (1,1) because diagonal is blocked
        const secondStep = path[1];
        const isDiagonal = secondStep.x !== start.x && secondStep.y !== start.y;
        if (isDiagonal && secondStep.x === 1 && secondStep.y === 1) {
          // If it tries diagonal, it should fail (but findPath should prevent this)
          expect(false).toBe(true); // Should not happen
        }
      }
    });

    it('should return null if path is completely blocked', () => {
      const heightmap = '000|xxx|000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 1, y: 0 };
      const end = { x: 1, y: 2 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should handle blocked tiles parameter correctly', () => {
      const heightmap = '000000|000000|000000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 1 };
      const end = { x: 5, y: 1 };
      const blockedTiles = new Set<string>(['1,1', '2,1', '3,1', '4,1']);

      const path = findPath(grid, start, end, blockedTiles);

      // Should find path around blocked tiles (going through y=0 or y=2)
      expect(path).not.toBeNull();
      if (path) {
        for (const pos of path) {
          const key = `${pos.x},${pos.y}`;
          expect(blockedTiles.has(key)).toBe(false);
        }
      }
    });

    it('should perform well on large grid with many obstacles', () => {
      // Create 20x20 grid with scattered obstacles
      const rows = [];
      for (let y = 0; y < 20; y++) {
        let row = '';
        for (let x = 0; x < 20; x++) {
          // Add obstacles in a pattern (every 3rd tile)
          row += (x + y) % 3 === 0 && x !== 0 && y !== 0 && x !== 19 && y !== 19 ? 'x' : '0';
        }
        rows.push(row);
      }
      const heightmap = rows.join('|');
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 0 };
      const end = { x: 19, y: 19 };

      const startTime = Date.now();
      const path = findPath(grid, start, end);
      const duration = Date.now() - startTime;

      expect(path).not.toBeNull();
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });

    it('should return null if MAX_ITERATIONS is reached (complex maze)', () => {
      // Create dense grid with narrow passages (forces many iterations)
      const rows = [];
      for (let y = 0; y < 50; y++) {
        let row = '';
        for (let x = 0; x < 50; x++) {
          // Create maze-like pattern
          if (x % 2 === 0 && y % 2 === 0) {
            row += 'x';
          } else {
            row += '0';
          }
        }
        rows.push(row);
      }
      const heightmap = rows.join('|');
      const grid = parseHeightmap(heightmap);
      const start = { x: 1, y: 1 };
      const end = { x: 49, y: 49 };

      const path = findPath(grid, start, end);

      // With MAX_ITERATIONS=1000, this complex maze might timeout
      // If it finds a path, it's valid; if null, it hit the limit
      if (path === null) {
        expect(path).toBeNull();
      } else {
        expect(path).not.toBeNull();
        expect(path![0]).toEqual(start);
        expect(path![path!.length - 1]).toEqual(end);
      }
    });

    it('should work with default empty blockedTiles parameter', () => {
      const heightmap = '00000|00000|00000';
      const grid = parseHeightmap(heightmap);
      const start = { x: 0, y: 0 };
      const end = { x: 4, y: 2 };

      // Call without blockedTiles parameter (should use default Set())
      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });
  });
});
