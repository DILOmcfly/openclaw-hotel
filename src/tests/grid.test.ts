import { describe, expect, it } from 'vitest';

import {
  getTileHeight,
  gridToScreen,
  isValidTile,
  parseHeightmap,
  screenToGrid,
} from '../services/grid.js';
import { findPath } from '../services/pathfinder.js';

describe('grid parser and coordinate utilities', () => {
  it("parseHeightmap parses '000|000|000' into 3x3 flat grid", () => {
    const grid = parseHeightmap('000|000|000');

    expect(grid).toHaveLength(3);
    expect(grid[0]).toHaveLength(3);
    expect(grid[1]).toHaveLength(3);
    expect(grid[2]).toHaveLength(3);

    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        expect(grid[y][x].height).toBe(0);
        expect(grid[y][x].state).toBe('open');
      }
    }
  });

  it("parseHeightmap parses '012|345' heights", () => {
    const grid = parseHeightmap('012|345');

    expect(getTileHeight(grid, 0, 0)).toBe(0);
    expect(getTileHeight(grid, 1, 0)).toBe(1);
    expect(getTileHeight(grid, 2, 0)).toBe(2);
    expect(getTileHeight(grid, 0, 1)).toBe(3);
    expect(getTileHeight(grid, 1, 1)).toBe(4);
    expect(getTileHeight(grid, 2, 1)).toBe(5);
  });

  it("parseHeightmap marks 'x' tiles as closed", () => {
    const grid = parseHeightmap('00x|0x0');

    expect(grid[0][2].state).toBe('closed');
    expect(grid[1][1].state).toBe('closed');
    expect(grid[0][0].state).toBe('open');
  });

  it('isValidTile handles boundaries and closed tiles', () => {
    const grid = parseHeightmap('00x|000');

    expect(isValidTile(grid, 0, 0)).toBe(true);
    expect(isValidTile(grid, 2, 0)).toBe(false);
    expect(isValidTile(grid, -1, 0)).toBe(false);
    expect(isValidTile(grid, 0, -1)).toBe(false);
    expect(isValidTile(grid, 3, 0)).toBe(false);
    expect(isValidTile(grid, 0, 2)).toBe(false);
  });

  it('gridToScreen and screenToGrid roundtrip', () => {
    const source = { x: 4, y: 2 };
    const screen = gridToScreen(source.x, source.y);
    const grid = screenToGrid(screen.screenX, screen.screenY);

    expect(grid.gridX).toBe(source.x);
    expect(grid.gridY).toBe(source.y);
  });
});

describe('pathfinder', () => {
  it('findPath returns straight line on flat grid', () => {
    const grid = parseHeightmap('00000');
    const path = findPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 });

    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.[path.length - 1]).toEqual({ x: 4, y: 0 });
  });

  it('findPath navigates around obstacle', () => {
    const grid = parseHeightmap('000|0x0|000');
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 });

    expect(path).not.toBeNull();
    expect(path?.some((p) => p.x === 1 && p.y === 1)).toBe(false);
    expect(path?.[path.length - 1]).toEqual({ x: 2, y: 2 });
  });

  it('findPath respects allowed height differences', () => {
    const grid = parseHeightmap('012');
    const path = findPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 });

    expect(path).not.toBeNull();
    expect(path?.[path.length - 1]).toEqual({ x: 2, y: 0 });
  });

  it('findPath returns null when route is blocked', () => {
    const grid = parseHeightmap('000|000|000');
    const blockedTiles = new Set<string>(['1,0', '1,1', '1,2']);
    const path = findPath(grid, { x: 0, y: 1 }, { x: 2, y: 1 }, blockedTiles);

    expect(path).toBeNull();
  });

  it('findPath returns null for excessive height step', () => {
    const grid = parseHeightmap('03');
    const path = findPath(grid, { x: 0, y: 0 }, { x: 1, y: 0 });

    expect(path).toBeNull();
  });

  it('findPath respects max iteration safety', () => {
    const row = '0'.repeat(1201);
    const grid = parseHeightmap(row);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 1200, y: 0 });

    expect(path).toBeNull();
  });
});
