import { getTileHeight, isValidTile, type ParsedGrid } from './grid.js';

export interface Position {
  x: number;
  y: number;
  z?: number;
}

export const DIAGONAL_MOVE_POINTS: Position[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: -1 },
];

export const MAX_LIFT_HEIGHT = 1.5;
export const MAX_DROP_HEIGHT = 3.0;

interface ItemDefinitionLike {
  width: number;
  depth: number;
  walkable?: boolean;
  canSit?: boolean;
}

interface PathItemLike {
  x: number;
  y: number;
  rotation?: number;
  walkable?: boolean;
  canSit?: boolean;
  itemDef?: ItemDefinitionLike;
  tiles?: Position[];
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function buildTileBlockingMap(items: PathItemLike[]): Map<string, { walkable: boolean; canSit: boolean }> {
  const map = new Map<string, { walkable: boolean; canSit: boolean }>();

  for (const item of items) {
    const walkable = item.walkable ?? item.itemDef?.walkable ?? false;
    const canSit = item.canSit ?? item.itemDef?.canSit ?? false;
    const occupiedTiles = item.tiles ?? expandItemTiles(item);

    for (const tile of occupiedTiles) {
      const k = key(tile.x, tile.y);
      const prev = map.get(k);
      if (!prev) {
        map.set(k, { walkable, canSit });
        continue;
      }

      map.set(k, {
        walkable: prev.walkable && walkable,
        canSit: prev.canSit || canSit,
      });
    }
  }

  return map;
}

function expandItemTiles(item: PathItemLike): Position[] {
  const definition = item.itemDef;
  if (!definition) {
    return [{ x: item.x, y: item.y }];
  }

  const rotation = normalizeRotation(item.rotation ?? 0);
  const swap = rotation === 2 || rotation === 6;
  const width = swap ? definition.depth : definition.width;
  const depth = swap ? definition.width : definition.depth;

  const tiles: Position[] = [];
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < depth; dy += 1) {
      tiles.push({ x: item.x + dx, y: item.y + dy });
    }
  }

  return tiles;
}

function normalizeRotation(rotation: number): number {
  const normalized = ((rotation % 8) + 8) % 8;
  if (normalized === 0 || normalized === 2 || normalized === 4 || normalized === 6) {
    return normalized;
  }

  throw new Error('Invalid rotation; expected 0, 2, 4, or 6');
}

export function isValidStep(
  grid: ParsedGrid,
  items: PathItemLike[],
  from: Position,
  to: Position,
  isFinal: boolean,
): boolean {
  if (!isValidTile(grid, to.x, to.y)) {
    return false;
  }

  const fromHeight = getTileHeight(grid, from.x, from.y);
  const toHeight = getTileHeight(grid, to.x, to.y);

  const rise = toHeight - fromHeight;
  if (rise > MAX_LIFT_HEIGHT) {
    return false;
  }

  const drop = fromHeight - toHeight;
  if (drop > MAX_DROP_HEIGHT) {
    return false;
  }

  const blockingMap = buildTileBlockingMap(items);
  const occupancy = blockingMap.get(key(to.x, to.y));
  if (!occupancy) {
    return true;
  }

  if (occupancy.walkable) {
    return true;
  }

  if (isFinal && occupancy.canSit) {
    return true;
  }

  return false;
}

export function findPath(grid: ParsedGrid, items: PathItemLike[], start: Position, end: Position): Position[] {
  if (!isValidTile(grid, start.x, start.y) || !isValidTile(grid, end.x, end.y)) {
    return [];
  }

  if (start.x === end.x && start.y === end.y) {
    return [{ x: start.x, y: start.y, z: getTileHeight(grid, start.x, start.y) }];
  }

  const blockingMap = buildTileBlockingMap(items);

  const openSet = new Set<string>([key(start.x, start.y)]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);
  const fScore = new Map<string, number>([[key(start.x, start.y), heuristic(start, end)]]);

  while (openSet.size > 0) {
    const currentKey = lowestScore(openSet, fScore);
    if (!currentKey) {
      break;
    }

    const [currentX, currentY] = currentKey.split(',').map((n) => Number(n));

    if (currentX === end.x && currentY === end.y) {
      return reconstructPath(cameFrom, currentKey).map(({ x, y }) => ({
        x,
        y,
        z: getTileHeight(grid, x, y),
      }));
    }

    openSet.delete(currentKey);

    for (const point of DIAGONAL_MOVE_POINTS) {
      const nextX = currentX + point.x;
      const nextY = currentY + point.y;

      if (!isValidTile(grid, nextX, nextY)) {
        continue;
      }

      const isDiagonal = point.x !== 0 && point.y !== 0;
      if (isDiagonal) {
        const sideAKey = key(currentX + point.x, currentY);
        const sideBKey = key(currentX, currentY + point.y);
        const sideABlocked = !isValidTile(grid, currentX + point.x, currentY) || isBlocked(blockingMap, sideAKey, false);
        const sideBBlocked = !isValidTile(grid, currentX, currentY + point.y) || isBlocked(blockingMap, sideBKey, false);
        if (sideABlocked && sideBBlocked) {
          continue;
        }
      }

      const final = nextX === end.x && nextY === end.y;
      const nextKey = key(nextX, nextY);
      if (!isValidStepWithMap(grid, blockingMap, { x: currentX, y: currentY }, { x: nextX, y: nextY }, final)) {
        continue;
      }

      const currentScore = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;
      const tentativeGScore = currentScore + movementCost(point.x, point.y);

      if (tentativeGScore >= (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentativeGScore);
      fScore.set(nextKey, tentativeGScore + heuristic({ x: nextX, y: nextY }, end));
      openSet.add(nextKey);
    }
  }

  return [];
}

function isBlocked(
  blockingMap: Map<string, { walkable: boolean; canSit: boolean }>,
  tileKey: string,
  isFinal: boolean,
): boolean {
  const tile = blockingMap.get(tileKey);
  if (!tile) {
    return false;
  }

  if (tile.walkable) {
    return false;
  }

  if (isFinal && tile.canSit) {
    return false;
  }

  return true;
}

function isValidStepWithMap(
  grid: ParsedGrid,
  blockingMap: Map<string, { walkable: boolean; canSit: boolean }>,
  from: Position,
  to: Position,
  isFinal: boolean,
): boolean {
  if (!isValidTile(grid, to.x, to.y)) {
    return false;
  }

  const fromHeight = getTileHeight(grid, from.x, from.y);
  const toHeight = getTileHeight(grid, to.x, to.y);

  const rise = toHeight - fromHeight;
  if (rise > MAX_LIFT_HEIGHT) {
    return false;
  }

  const drop = fromHeight - toHeight;
  if (drop > MAX_DROP_HEIGHT) {
    return false;
  }

  return !isBlocked(blockingMap, key(to.x, to.y), isFinal);
}

function movementCost(dx: number, dy: number): number {
  return dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
}

function heuristic(a: Position, b: Position): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const diagonal = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diagonal;
  return diagonal * Math.SQRT2 + straight;
}

function lowestScore(openSet: Set<string>, fScore: Map<string, number>): string | null {
  let bestKey: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of openSet) {
    const candidateScore = fScore.get(candidate) ?? Number.POSITIVE_INFINITY;
    if (candidateScore < bestScore) {
      bestScore = candidateScore;
      bestKey = candidate;
    }
  }

  return bestKey;
}

function reconstructPath(cameFrom: Map<string, string>, current: string): Position[] {
  const positions: Position[] = [decode(current)];
  let pointer: string | undefined = current;

  while (pointer && cameFrom.has(pointer)) {
    const prev = cameFrom.get(pointer);
    if (!prev) {
      break;
    }

    positions.push(decode(prev));
    pointer = prev;
  }

  positions.reverse();
  return positions;
}

function decode(encoded: string): Position {
  const [x, y] = encoded.split(',').map((n) => Number(n));
  return { x, y };
}
