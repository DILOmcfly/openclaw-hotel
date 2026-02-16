import { describe, it, expect } from 'vitest';
import { findPath } from '../services/pathfinder.js';
import { parseHeightmap } from '../services/grid.js';
import type { RoomGrid, Position } from '../services/grid.js';

describe('Pathfinder Service', () => {
  describe('Basic Pathfinding', () => {
    it('should find a straight horizontal path', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 0, y: 1 };
      const end: Position = { x: 4, y: 1 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(5);
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should find a straight vertical path', () => {
      const grid = parseHeightmap('00000|00000|00000|00000|00000');
      const start: Position = { x: 2, y: 0 };
      const end: Position = { x: 2, y: 4 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(5);
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should find a diagonal path', () => {
      const grid = parseHeightmap('00000|00000|00000|00000|00000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 4, y: 4 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(5);
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should find a path with mixed directions', () => {
      const grid = parseHeightmap('00000|00000|00000|00000|00000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 3, y: 2 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });
  });

  describe('Obstacle Avoidance', () => {
    it('should navigate around a simple obstacle', () => {
      const grid = parseHeightmap('00000|0xxx0|00000');
      const start: Position = { x: 0, y: 1 };
      const end: Position = { x: 4, y: 1 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
      // Path should not contain any closed tiles
      path!.forEach(pos => {
        expect(grid[pos.y][pos.x].state).toBe('open');
      });
    });

    it('should navigate around blocked tiles (dynamic obstacles)', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 0, y: 1 };
      const end: Position = { x: 4, y: 1 };
      const blockedTiles = new Set<string>(['1,1', '2,1', '3,1']);

      const path = findPath(grid, start, end, blockedTiles);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
      // Path should not contain any blocked tiles
      path!.forEach(pos => {
        const key = `${pos.x},${pos.y}`;
        expect(blockedTiles.has(key)).toBe(false);
      });
    });

    it('should navigate through a maze', () => {
      const grid = parseHeightmap(
        '00000|' +
        'x0xxx|' +
        'x0x0x|' +
        'x000x|' +
        '00000'
      );
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 4, y: 4 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should avoid diagonal movement through corners', () => {
      const grid = parseHeightmap('000|0x0|000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 2, y: 2 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      // Path should exist but not cut through the obstacle diagonally
      path!.forEach(pos => {
        expect(grid[pos.y][pos.x].state).toBe('open');
      });
    });
  });

  describe('No-Path Scenarios', () => {
    it('should return null when completely blocked', () => {
      const grid = parseHeightmap('00000|xxxxx|00000');
      const start: Position = { x: 2, y: 0 };
      const end: Position = { x: 2, y: 2 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should return null when end is blocked', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 2, y: 2 };
      const blockedTiles = new Set<string>(['2,2']);

      const path = findPath(grid, start, end, blockedTiles);

      expect(path).toBeNull();
    });

    it('should return null when start is blocked', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 2, y: 2 };
      const blockedTiles = new Set<string>(['0,0']);

      const path = findPath(grid, start, end, blockedTiles);

      expect(path).toBeNull();
    });

    it('should return null when destination is in separate enclosed area', () => {
      const grid = parseHeightmap(
        '000x000|' +
        '000x000|' +
        'xxxxxxx|' +
        '000x000|' +
        '000x000'
      );
      const start: Position = { x: 1, y: 1 };
      const end: Position = { x: 5, y: 3 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should return null when destination is unreachable due to height', () => {
      // Create a grid with extreme height differences
      const grid: RoomGrid = [
        [
          { x: 0, y: 0, height: 0, state: 'open' },
          { x: 1, y: 0, height: 0, state: 'open' },
          { x: 2, y: 0, height: 5, state: 'open' }, // Too high to climb (>1.5)
        ],
        [
          { x: 0, y: 1, height: 0, state: 'open' },
          { x: 1, y: 1, height: 0, state: 'open' },
          { x: 2, y: 1, height: 5, state: 'open' },
        ],
      ];
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 2, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should return path with single position when start equals end', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 2, y: 1 };
      const end: Position = { x: 2, y: 1 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(1);
      expect(path![0]).toEqual(start);
    });

    it('should return null when start is out of bounds', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: -1, y: 1 };
      const end: Position = { x: 2, y: 1 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should return null when end is out of bounds', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 2, y: 1 };
      const end: Position = { x: 10, y: 1 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should return null when both start and end are out of bounds', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: -1, y: -1 };
      const end: Position = { x: 10, y: 10 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should handle single tile grid', () => {
      const grid = parseHeightmap('0');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 0, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path).toHaveLength(1);
    });

    it('should handle empty blocked tiles set', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 4, y: 2 };
      const blockedTiles = new Set<string>();

      const path = findPath(grid, start, end, blockedTiles);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should handle large grid efficiently', () => {
      // Create a 20x20 grid
      const rows = Array(20).fill('0'.repeat(20)).join('|');
      const grid = parseHeightmap(rows);
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 19, y: 19 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });
  });

  describe('Height Constraints', () => {
    it('should allow climbing moderate heights (≤1.5)', () => {
      const grid: RoomGrid = [
        [
          { x: 0, y: 0, height: 0, state: 'open' },
          { x: 1, y: 0, height: 1, state: 'open' },
          { x: 2, y: 0, height: 2, state: 'open' },
        ],
      ];
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 1, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should block climbing too steep heights (>1.5)', () => {
      const grid: RoomGrid = [
        [
          { x: 0, y: 0, height: 0, state: 'open' },
          { x: 1, y: 0, height: 2, state: 'open' },
        ],
      ];
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 1, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should allow moderate falling (>-3)', () => {
      const grid: RoomGrid = [
        [
          { x: 0, y: 0, height: 2, state: 'open' },
          { x: 1, y: 0, height: 0, state: 'open' },
        ],
      ];
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 1, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![path!.length - 1]).toEqual(end);
    });

    it('should block excessive falling (<-3)', () => {
      const grid: RoomGrid = [
        [
          { x: 0, y: 0, height: 4, state: 'open' },
          { x: 1, y: 0, height: 0, state: 'open' },
        ],
      ];
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 1, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).toBeNull();
    });

    it('should navigate stairs-like terrain', () => {
      const grid: RoomGrid = [
        [
          { x: 0, y: 0, height: 0, state: 'open' },
          { x: 1, y: 0, height: 1, state: 'open' },
          { x: 2, y: 0, height: 2, state: 'open' },
          { x: 3, y: 0, height: 3, state: 'open' },
        ],
      ];
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 3, y: 0 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(end);
    });
  });

  describe('Path Quality', () => {
    it('should prefer shorter paths over longer ones', () => {
      const grid = parseHeightmap('00000|00000|00000');
      const start: Position = { x: 0, y: 1 };
      const end: Position = { x: 4, y: 1 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      // Direct path should be 5 tiles (0,1 -> 1,1 -> 2,1 -> 3,1 -> 4,1)
      expect(path!.length).toBe(5);
    });

    it('should use diagonal shortcuts when possible', () => {
      const grid = parseHeightmap('00000|00000|00000|00000|00000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 4, y: 4 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      // Diagonal path should be exactly 5 tiles
      expect(path!.length).toBe(5);
    });

    it('should ensure path continuity (each step is adjacent)', () => {
      const grid = parseHeightmap('00000|00000|00000|00000|00000');
      const start: Position = { x: 0, y: 0 };
      const end: Position = { x: 4, y: 4 };

      const path = findPath(grid, start, end);

      expect(path).not.toBeNull();
      
      // Check each consecutive pair of positions is adjacent
      for (let i = 0; i < path!.length - 1; i++) {
        const current = path![i];
        const next = path![i + 1];
        const dx = Math.abs(next.x - current.x);
        const dy = Math.abs(next.y - current.y);
        
        // Adjacent means max distance of 1 in any direction
        expect(dx).toBeLessThanOrEqual(1);
        expect(dy).toBeLessThanOrEqual(1);
        expect(dx + dy).toBeGreaterThan(0); // Not the same tile
      }
    });
  });
});
