import { getTileHeight, isValidTile } from './grid.js';
import type { Position, RoomGrid } from './grid.js';

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

const DIRECTIONS = [
  { x: 1, y: 0, cost: 1 },
  { x: -1, y: 0, cost: 1 },
  { x: 0, y: 1, cost: 1 },
  { x: 0, y: -1, cost: 1 },
  { x: 1, y: 1, cost: Math.SQRT2 },
  { x: 1, y: -1, cost: Math.SQRT2 },
  { x: -1, y: 1, cost: Math.SQRT2 },
  { x: -1, y: -1, cost: Math.SQRT2 },
] as const;

const MAX_ITERATIONS = 1000;

function octileDistance(a: Position, b: Position): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);

  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function makeKey(x: number, y: number): string {
  return `${x},${y}`;
}

function reconstructPath(node: Node): Position[] {
  const path: Position[] = [];
  let current: Node | null = node;

  while (current) {
    path.push({ x: current.x, y: current.y });
    current = current.parent;
  }

  path.reverse();
  return path;
}

function isWalkable(
  grid: RoomGrid,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  blockedTiles: Set<string>,
): boolean {
  if (!isValidTile(grid, toX, toY)) {
    return false;
  }

  if (blockedTiles.has(makeKey(toX, toY))) {
    return false;
  }

  const fromHeight = getTileHeight(grid, fromX, fromY);
  const toHeight = getTileHeight(grid, toX, toY);
  const heightDiff = toHeight - fromHeight;

  if (heightDiff > 1.5) {
    return false;
  }

  if (heightDiff < -3) {
    return false;
  }

  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const isDiagonal = deltaX !== 0 && deltaY !== 0;

  if (isDiagonal) {
    if (!isValidTile(grid, fromX + deltaX, fromY)) {
      return false;
    }

    if (!isValidTile(grid, fromX, fromY + deltaY)) {
      return false;
    }

    if (blockedTiles.has(makeKey(fromX + deltaX, fromY))) {
      return false;
    }

    if (blockedTiles.has(makeKey(fromX, fromY + deltaY))) {
      return false;
    }
  }

  return true;
}

export function findPath(
  grid: RoomGrid,
  start: Position,
  end: Position,
  blockedTiles: Set<string> = new Set<string>(),
): Position[] | null {
  if (!isValidTile(grid, start.x, start.y) || !isValidTile(grid, end.x, end.y)) {
    return null;
  }

  if (blockedTiles.has(makeKey(start.x, start.y)) || blockedTiles.has(makeKey(end.x, end.y))) {
    return null;
  }

  const openList: Node[] = [];
  const closedSet = new Set<string>();
  const gScores = new Map<string, number>();

  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    h: octileDistance(start, end),
    f: octileDistance(start, end),
    parent: null,
  };

  openList.push(startNode);
  gScores.set(makeKey(start.x, start.y), 0);

  let iterations = 0;

  while (openList.length > 0 && iterations < MAX_ITERATIONS) {
    iterations += 1;

    let currentIndex = 0;
    for (let index = 1; index < openList.length; index += 1) {
      if (openList[index].f < openList[currentIndex].f) {
        currentIndex = index;
      }
    }

    const current = openList.splice(currentIndex, 1)[0];
    const currentKey = makeKey(current.x, current.y);

    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }

    closedSet.add(currentKey);

    for (const direction of DIRECTIONS) {
      const nextX = current.x + direction.x;
      const nextY = current.y + direction.y;
      const nextKey = makeKey(nextX, nextY);

      if (closedSet.has(nextKey)) {
        continue;
      }

      if (!isWalkable(grid, current.x, current.y, nextX, nextY, blockedTiles)) {
        continue;
      }

      const tentativeG = current.g + direction.cost;
      const knownG = gScores.get(nextKey);

      if (knownG !== undefined && tentativeG >= knownG) {
        continue;
      }

      const h = octileDistance({ x: nextX, y: nextY }, end);
      const node: Node = {
        x: nextX,
        y: nextY,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      };

      gScores.set(nextKey, tentativeG);

      const existingIndex = openList.findIndex((item) => item.x === nextX && item.y === nextY);
      if (existingIndex >= 0) {
        openList[existingIndex] = node;
      } else {
        openList.push(node);
      }
    }
  }

  return null;
}
