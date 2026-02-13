export type TileState = 'open' | 'closed';

export interface ParsedGrid {
  tiles: TileState[][];
  heights: number[][];
  sizeX: number;
  sizeY: number;
  doorX: number;
  doorY: number;
}

export function parseHeightmap(str: string): ParsedGrid {
  const rows = str
    .split('|')
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length === 0) {
    throw new Error('Invalid heightmap: no rows');
  }

  const sizeY = rows.length;
  const sizeX = rows[0]?.length ?? 0;

  if (sizeX === 0) {
    throw new Error('Invalid heightmap: empty row');
  }

  if (rows.some((row) => row.length !== sizeX)) {
    throw new Error('Invalid heightmap: inconsistent row width');
  }

  const tiles: TileState[][] = [];
  const heights: number[][] = [];

  for (const row of rows) {
    const tileRow: TileState[] = [];
    const heightRow: number[] = [];

    for (const char of row) {
      if (char === 'x' || char === 'X') {
        tileRow.push('closed');
        heightRow.push(0);
        continue;
      }

      if (/^[0-9]$/.test(char)) {
        tileRow.push('open');
        heightRow.push(Number(char));
        continue;
      }

      throw new Error(`Invalid heightmap tile: ${char}`);
    }

    tiles.push(tileRow);
    heights.push(heightRow);
  }

  const door = findDoor(tiles);

  return {
    tiles,
    heights,
    sizeX,
    sizeY,
    doorX: door.x,
    doorY: door.y,
  };
}

export function isValidTile(grid: ParsedGrid, x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }

  if (x < 0 || y < 0 || x >= grid.sizeX || y >= grid.sizeY) {
    return false;
  }

  return grid.tiles[y]?.[x] === 'open';
}

export function getTileHeight(grid: ParsedGrid, x: number, y: number): number {
  return grid.heights[y]?.[x] ?? 0;
}

function findDoor(tiles: TileState[][]): { x: number; y: number } {
  const sizeY = tiles.length;
  const sizeX = tiles[0]?.length ?? 0;

  for (let y = 0; y < sizeY; y += 1) {
    for (let x = 0; x < sizeX; x += 1) {
      if (tiles[y]?.[x] !== 'open') {
        continue;
      }

      const isBoundary = x === 0 || y === 0 || x === sizeX - 1 || y === sizeY - 1;
      if (isBoundary) {
        return { x, y };
      }
    }
  }

  for (let y = 0; y < sizeY; y += 1) {
    for (let x = 0; x < sizeX; x += 1) {
      if (tiles[y]?.[x] === 'open') {
        return { x, y };
      }
    }
  }

  return { x: -1, y: -1 };
}
