export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export function gridToScreen(gridX: number, gridY: number, gridZ: number): { x: number; y: number } {
  const x = (gridX - gridY) * (TILE_WIDTH / 2);
  const y = (gridX + gridY) * (TILE_HEIGHT / 2) - gridZ * TILE_HEIGHT;
  return { x, y };
}

export function screenToGrid(screenX: number, screenY: number): { gridX: number; gridY: number } {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const gridX = (screenX / halfW + screenY / halfH) / 2;
  const gridY = (screenY / halfH - screenX / halfW) / 2;
  return { gridX, gridY };
}

export function depthSort(gridX: number, gridY: number, gridZ: number): number {
  return gridX + gridY + gridZ * 0.01;
}
