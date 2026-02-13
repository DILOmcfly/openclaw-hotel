export type TileState = 'open' | 'closed';

export interface RoomTile {
  x: number;
  y: number;
  height: number;
  state: TileState;
}

export type RoomGrid = RoomTile[][];

export interface Position {
  x: number;
  y: number;
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

export function parseHeightmap(str: string): RoomGrid {
  const rows = str.split('|');

  return rows.map((row, y) =>
    row.split('').map((char, x) => {
      if (char === 'x') {
        return { x, y, height: 0, state: 'closed' };
      }

      return {
        x,
        y,
        height: Number.parseInt(char, 10),
        state: 'open',
      };
    }),
  );
}

export function isValidTile(grid: RoomGrid, x: number, y: number): boolean {
  if (y < 0 || y >= grid.length) {
    return false;
  }

  if (x < 0 || x >= grid[y].length) {
    return false;
  }

  return grid[y][x].state !== 'closed';
}

export function getTileHeight(grid: RoomGrid, x: number, y: number): number {
  return grid[y][x].height;
}

export function gridToScreen(
  x: number,
  y: number,
): { screenX: number; screenY: number } {
  const screenX = (x - y) * (TILE_WIDTH / 2);
  const screenY = (x + y) * (TILE_HEIGHT / 2);

  return { screenX, screenY };
}

export function screenToGrid(
  screenX: number,
  screenY: number,
): { gridX: number; gridY: number } {
  const gridX = Math.round(screenX / TILE_WIDTH + screenY / TILE_HEIGHT);
  const gridY = Math.round(screenY / TILE_HEIGHT - screenX / TILE_WIDTH);

  return { gridX, gridY };
}
