/**
 * Viewport culling system to only render visible sprites
 * Dramatically improves performance in large rooms by hiding off-screen objects
 */

import { Container, Rectangle } from 'pixi.js';
import { screenToGrid, gridToScreen, TILE_WIDTH, TILE_HEIGHT } from './IsoRenderer.js';

export interface CullableObject {
  gridX: number;
  gridY: number;
  container: Container;
}

export class ViewportCulling {
  private worldContainer: Container;
  private viewportBounds: Rectangle = new Rectangle(0, 0, 800, 600);
  private margin: number = 2; // Tiles beyond viewport to render (prevents pop-in)
  private scale: number = 1;

  constructor(worldContainer: Container) {
    this.worldContainer = worldContainer;
  }

  /**
   * Update viewport bounds (call on window resize or camera move)
   */
  public updateViewport(screenWidth: number, screenHeight: number, scale: number = 1): void {
    this.scale = scale;
    
    // Calculate viewport in world coordinates
    const worldX = -this.worldContainer.position.x / scale;
    const worldY = -this.worldContainer.position.y / scale;
    const worldWidth = screenWidth / scale;
    const worldHeight = screenHeight / scale;

    this.viewportBounds.x = worldX;
    this.viewportBounds.y = worldY;
    this.viewportBounds.width = worldWidth;
    this.viewportBounds.height = worldHeight;
  }

  /**
   * Check if a grid position is visible in the viewport
   */
  public isVisible(gridX: number, gridY: number, gridZ: number = 0): boolean {
    const { x, y } = gridToScreen(gridX, gridY, gridZ);
    
    // Add margin in tile dimensions
    const marginX = this.margin * TILE_WIDTH;
    const marginY = this.margin * TILE_HEIGHT;

    return (
      x >= this.viewportBounds.x - marginX &&
      x <= this.viewportBounds.x + this.viewportBounds.width + marginX &&
      y >= this.viewportBounds.y - marginY &&
      y <= this.viewportBounds.y + this.viewportBounds.height + marginY
    );
  }

  /**
   * Cull a collection of objects based on viewport
   * Returns number of objects culled (made invisible)
   */
  public cullObjects(objects: CullableObject[]): number {
    let culledCount = 0;

    for (const obj of objects) {
      const visible = this.isVisible(obj.gridX, obj.gridY);
      
      if (obj.container.visible !== visible) {
        obj.container.visible = visible;
        if (!visible) {
          culledCount++;
        }
      }
    }

    return culledCount;
  }

  /**
   * Get visible grid bounds for more efficient iteration
   * Returns { minX, maxX, minY, maxY } in grid coordinates
   */
  public getVisibleGridBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    // Calculate corner points of viewport
    const topLeft = screenToGrid(this.viewportBounds.x, this.viewportBounds.y);
    const topRight = screenToGrid(
      this.viewportBounds.x + this.viewportBounds.width,
      this.viewportBounds.y
    );
    const bottomLeft = screenToGrid(
      this.viewportBounds.x,
      this.viewportBounds.y + this.viewportBounds.height
    );
    const bottomRight = screenToGrid(
      this.viewportBounds.x + this.viewportBounds.width,
      this.viewportBounds.y + this.viewportBounds.height
    );

    // Find min/max grid coordinates
    const minX = Math.floor(
      Math.min(topLeft.gridX, topRight.gridX, bottomLeft.gridX, bottomRight.gridX) - this.margin
    );
    const maxX = Math.ceil(
      Math.max(topLeft.gridX, topRight.gridX, bottomLeft.gridX, bottomRight.gridX) + this.margin
    );
    const minY = Math.floor(
      Math.min(topLeft.gridY, topRight.gridY, bottomLeft.gridY, bottomRight.gridY) - this.margin
    );
    const maxY = Math.ceil(
      Math.max(topLeft.gridY, topRight.gridY, bottomLeft.gridY, bottomRight.gridY) + this.margin
    );

    return { minX, maxX, minY, maxY };
  }

  /**
   * Set margin (in tiles) for culling
   */
  public setMargin(margin: number): void {
    this.margin = Math.max(0, margin);
  }

  /**
   * Get current viewport bounds for debugging
   */
  public getViewportBounds(): Rectangle {
    return this.viewportBounds.clone();
  }
}
