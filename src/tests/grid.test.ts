import { beforeEach, describe, expect, test } from 'vitest';
import { clearFurnitureState, getRoomFurniture, placeFurniture, removeFurniture, setRoomGrid } from '../services/furniture.js';
import { parseHeightmap } from '../services/grid.js';
import { findPath } from '../services/pathfinder.js';

describe('grid + pathfinding + furniture', () => {
  beforeEach(() => {
    clearFurnitureState();
  });

  test('parseHeightmap simple map', () => {
    const grid = parseHeightmap('xxx|x1x|xxx');

    expect(grid.sizeX).toBe(3);
    expect(grid.sizeY).toBe(3);
    expect(grid.tiles[1]?.[1]).toBe('open');
    expect(grid.heights[1]?.[1]).toBe(1);
    expect(grid.doorX).toBe(1);
    expect(grid.doorY).toBe(1);
  });

  test('parseHeightmap complex map', () => {
    const grid = parseHeightmap('xxxxxx|x1200x|x2x30x|x2222x|xxxxxx');

    expect(grid.sizeX).toBe(6);
    expect(grid.sizeY).toBe(5);
    expect(grid.tiles[2]?.[2]).toBe('closed');
    expect(grid.heights[1]?.[3]).toBe(0);
    expect(grid.heights[2]?.[3]).toBe(3);
    expect(grid.doorX).toBe(1);
    expect(grid.doorY).toBe(1);
  });

  test('pathfinding simple path', () => {
    const grid = parseHeightmap('xxxxx|x000x|x000x|x000x|xxxxx');

    const path = findPath(grid, [], { x: 1, y: 1 }, { x: 3, y: 3 });

    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toMatchObject({ x: 1, y: 1, z: 0 });
    expect(path[path.length - 1]).toMatchObject({ x: 3, y: 3, z: 0 });
  });

  test('pathfinding with obstacles', () => {
    const grid = parseHeightmap('xxxxxxx|x00000x|x00000x|x00000x|x00000x|xxxxxxx');
    const roomId = 'room-obstacles';

    setRoomGrid(roomId, grid);
    placeFurniture(roomId, 'table_round', 2, 2, 0, 'agent-1');

    const items = getRoomFurniture(roomId);
    const path = findPath(grid, items, { x: 1, y: 1 }, { x: 5, y: 4 });

    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toMatchObject({ x: 5, y: 4 });
    expect(path.some((tile) => tile.x === 2 && tile.y === 2)).toBe(false);
  });

  test('pathfinding no-path scenario', () => {
    const grid = parseHeightmap('xxxxx|x0x0x|xxxxx');
    const path = findPath(grid, [], { x: 1, y: 1 }, { x: 3, y: 1 });

    expect(path).toEqual([]);
  });

  test('furniture placement, collision, remove', () => {
    const grid = parseHeightmap('xxxxx|x000x|x000x|x000x|xxxxx');
    const roomId = 'room-furniture';

    setRoomGrid(roomId, grid);

    const placed = placeFurniture(roomId, 'chair_wood', 2, 2, 0, 'agent-1');
    expect(placed.itemDefId).toBe('chair_wood');
    expect(getRoomFurniture(roomId)).toHaveLength(1);

    expect(() => placeFurniture(roomId, 'plant_small', 2, 2, 0, 'agent-2')).toThrow(
      'Furniture collision detected',
    );

    expect(removeFurniture(roomId, placed.id)).toBe(true);
    expect(getRoomFurniture(roomId)).toHaveLength(0);
  });
});
