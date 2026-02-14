/**
 * FurnitureManager - Handles furniture rendering, placement, and interaction
 * Replaces the placeholder FurnitureRenderer with full sprite support
 */

import { Container, Sprite, Graphics, Texture } from 'pixi.js';
import { gridToScreen, depthSort, screenToGrid, TILE_WIDTH, TILE_HEIGHT } from './IsoRenderer.js';
import { AssetLoader } from '../AssetLoader.js';
import type { HotelWSClient } from '../ws/client.js';
import { ObjectPool } from './ObjectPool.js';
import { memoryProfiler } from './MemoryProfiler.js';
import { ViewportCulling } from './ViewportCulling.js';

export interface FurnitureItem {
  id: string;
  itemDefId: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  placedBy?: string;
}

// Mapping from backend itemDefId to sprite filename (without furn_ prefix and .png)
// AssetLoader will create placeholder sprites for missing items
const ITEM_SPRITE_MAP: Record<string, string> = {
  chair_wood: 'chair',
  table_round: 'table',
  lamp_floor: 'lamp',
  plant_pot: 'plant', // Will use colored placeholder
  bookshelf: 'bookshelf',
  sofa_2seat: 'sofa', // Will use colored placeholder
  desk_office: 'desk', // Will use colored placeholder
  bed_single: 'bed',
};

// Furniture dimensions for collision preview (from backend catalog)
const ITEM_DIMENSIONS: Record<string, { width: number; depth: number; height: number }> = {
  chair_wood: { width: 1, depth: 1, height: 1.0 },
  table_round: { width: 2, depth: 2, height: 0.8 },
  lamp_floor: { width: 1, depth: 1, height: 1.5 },
  plant_pot: { width: 1, depth: 1, height: 0.5 },
  bookshelf: { width: 2, depth: 1, height: 2.0 },
  sofa_2seat: { width: 2, depth: 1, height: 0.8 },
  desk_office: { width: 2, depth: 1, height: 0.8 },
  bed_single: { width: 1, depth: 2, height: 0.6 },
};

type PlacementMode = {
  itemDefId: string;
  previewContainer: Container;
  rotation: number;
};

export class FurnitureManager {
  private items: Map<string, { item: FurnitureItem; container: Container }> = new Map();
  private world: Container;
  private ws: HotelWSClient | null = null;
  private currentRoomId: string = 'lobby';
  private placementMode: PlacementMode | null = null;
  private selectedItemId: string | null = null;
  private dragMode: { itemId: string; offsetX: number; offsetY: number } | null = null;
  private containerPool: ObjectPool<Container>;
  private viewportCulling: ViewportCulling;
  private textureCache: Map<string, Texture | Promise<Texture>> = new Map();
  private loadingPlaceholder: Texture | null = null;

  // Callbacks
  public onPlacementSuccess?: () => void;
  public onPlacementFailed?: (reason: string) => void;
  public onItemSelected?: (itemId: string) => void;
  public onContextMenu?: (itemId: string, screenX: number, screenY: number) => void;

  constructor(world: Container) {
    this.world = world;
    
    // Initialize object pool for containers
    this.containerPool = new ObjectPool({
      factory: () => {
        const container = new Container();
        memoryProfiler.trackContainerCreate();
        return container;
      },
      reset: (container) => {
        container.removeChildren();
        container.position.set(0, 0);
        container.visible = true;
        container.alpha = 1;
        container.scale.set(1, 1);
        container.rotation = 0;
        container.zIndex = 0;
        container.eventMode = 'none';
        container.cursor = 'default';
        container.removeAllListeners();
      },
      destroy: (container) => {
        container.destroy({ children: true });
        memoryProfiler.trackContainerDestroy();
      },
      maxSize: 100,
      preAllocate: 20,
    });

    // Initialize viewport culling
    this.viewportCulling = new ViewportCulling(world);
    
    // Create loading placeholder texture
    this.loadingPlaceholder = this.createLoadingPlaceholder();
  }

  /**
   * Create loading placeholder texture (gray box with "loading...")
   */
  private createLoadingPlaceholder(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Gray box
    ctx.fillStyle = '#999999';
    ctx.fillRect(0, 16, 48, 48);
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 16, 48, 48);
    
    // "Loading..." text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOADING', 24, 36);
    ctx.fillText('...', 24, 46);
    
    return Texture.from(canvas);
  }

  /**
   * Lazy load furniture texture (only load when first needed)
   */
  private async loadFurnitureTexture(spriteKey: string): Promise<Texture> {
    // Check if already in cache
    const cached = this.textureCache.get(spriteKey);
    if (cached) {
      if (cached instanceof Promise) {
        return await cached;
      }
      return cached;
    }

    // Check if AssetLoader already has it
    let texture = AssetLoader.getFurnitureTexture(spriteKey);
    if (texture) {
      this.textureCache.set(spriteKey, texture);
      return texture;
    }

    // If not available, return placeholder for now
    // (In a real implementation, you'd load from server here)
    console.log(`[FurnitureManager] Lazy loading texture: ${spriteKey}`);
    
    // Simulate async loading (replace with actual fetch if needed)
    const loadingPromise = new Promise<Texture>((resolve) => {
      setTimeout(() => {
        // Try again after a delay
        texture = AssetLoader.getFurnitureTexture(spriteKey);
        if (texture) {
          this.textureCache.set(spriteKey, texture);
          resolve(texture);
        } else {
          // Still not available, use placeholder
          resolve(this.loadingPlaceholder!);
        }
      }, 100);
    });

    this.textureCache.set(spriteKey, loadingPromise);
    return await loadingPromise;
  }

  /**
   * Update viewport for culling
   */
  public updateViewport(screenWidth: number, screenHeight: number, scale: number = 1): void {
    this.viewportCulling.updateViewport(screenWidth, screenHeight, scale);
  }

  /**
   * Perform viewport culling on all furniture
   */
  public cullFurniture(): number {
    const cullableObjects = Array.from(this.items.values()).map(entry => ({
      gridX: entry.item.x,
      gridY: entry.item.y,
      container: entry.container,
    }));
    
    return this.viewportCulling.cullObjects(cullableObjects);
  }

  /**
   * Connect to WebSocket for real-time furniture updates
   */
  public connectWS(ws: HotelWSClient, roomId: string): void {
    this.ws = ws;
    this.currentRoomId = roomId;

    // Listen for furniture events
    ws.on('furniture.placed', (msg) => {
      const item = msg.item as FurnitureItem;
      if (item && msg.roomId === this.currentRoomId) {
        this.addFurniture(item);
      }
    });

    ws.on('furniture.removed', (msg) => {
      const itemId = msg.itemId as string;
      if (msg.roomId === this.currentRoomId) {
        this.removeFurniture(itemId);
      }
    });

    // When joining a room, get existing furniture
    ws.on('room.joined', (msg) => {
      if (msg.roomId === this.currentRoomId && msg.items) {
        this.clear();
        const items = msg.items as FurnitureItem[];
        items.forEach((item) => this.addFurniture(item));
      }
    });
  }

  /**
   * Add or update furniture in the room
   */
  public async addFurniture(item: FurnitureItem): Promise<void> {
    // Remove existing if updating
    if (this.items.has(item.id)) {
      this.removeFurniture(item.id);
    }

    const container = this.containerPool.acquire();
    const spriteKey = ITEM_SPRITE_MAP[item.itemDefId] || 'chair'; // fallback
    
    // Start with loading placeholder
    let sprite = new Sprite(this.loadingPlaceholder!);
    sprite.anchor.set(0.5, 1);
    container.addChild(sprite);
    memoryProfiler.trackSpriteCreate();
    
    // Lazy load the actual texture
    this.loadFurnitureTexture(spriteKey).then((texture) => {
      if (sprite && !sprite.destroyed) {
        sprite.texture = texture;
        
        // Apply rotation if needed
        if (item.rotation !== 0) {
          sprite.angle = item.rotation * 45; // Assuming 8-direction rotation
        }
      }
    }).catch((err) => {
      console.warn(`[FurnitureManager] Failed to load texture for ${spriteKey}:`, err);
    });

    // Position in isometric space
    const { x, y } = gridToScreen(item.x, item.y, item.z);
    container.position.set(x, y);
    
    // Z-ordering for proper depth sorting
    container.zIndex = depthSort(item.x, item.y, item.z);

    // Make interactive for selection and dragging
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', (event) => {
      if (event.button === 2) {
        // Right-click → context menu
        this.showContextMenu(item.id, event.globalX, event.globalY);
      } else {
        // Left-click → select
        this.selectFurniture(item.id);
      }
    });

    container.on('rightclick', (event) => {
      event.preventDefault();
      this.showContextMenu(item.id, event.globalX, event.globalY);
    });

    this.world.addChild(container);
    this.items.set(item.id, { item, container });
  }

  /**
   * Remove furniture from the room
   */
  public removeFurniture(itemId: string): void {
    const entry = this.items.get(itemId);
    if (entry) {
      this.world.removeChild(entry.container);
      
      // Track sprite destruction
      if (entry.container.children.length > 0) {
        memoryProfiler.trackSpriteDestroy();
      }
      
      // Return container to pool
      this.containerPool.release(entry.container);
      
      this.items.delete(itemId);
    }
  }

  /**
   * Clear all furniture
   */
  public clear(): void {
    for (const [id] of this.items) {
      this.removeFurniture(id);
    }
  }

  /**
   * Cleanup all furniture and release resources
   */
  public cleanup(): void {
    this.clear();
    this.containerPool.clear();
    this.textureCache.clear();
    memoryProfiler.cleanup();
  }

  /**
   * Enter placement mode - user can preview and place furniture
   */
  public startPlacementMode(itemDefId: string): void {
    if (this.placementMode) {
      this.cancelPlacementMode();
    }

    const previewContainer = new Container();
    const spriteKey = ITEM_SPRITE_MAP[itemDefId] || 'chair';
    
    let sprite: Sprite;
    const texture = AssetLoader.getFurnitureTexture(spriteKey);
    if (texture) {
      sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);
      sprite.alpha = 0.6; // Semi-transparent preview
    } else {
      sprite = this.createPlaceholderSprite(itemDefId);
      sprite.alpha = 0.6;
    }

    previewContainer.addChild(sprite);
    
    // Add grid highlight (shows valid/invalid placement)
    const highlight = this.createGridHighlight(itemDefId, 0);
    previewContainer.addChild(highlight);
    
    this.world.addChild(previewContainer);

    this.placementMode = {
      itemDefId,
      previewContainer,
      rotation: 0,
    };

    console.log(`[FurnitureManager] Placement mode started for ${itemDefId}`);
  }

  /**
   * Update placement preview position (called on mouse move)
   */
  public updatePlacementPreview(screenX: number, screenY: number): void {
    if (!this.placementMode) return;

    const worldX = screenX - this.world.position.x;
    const worldY = screenY - this.world.position.y;
    const { gridX, gridY } = screenToGrid(worldX, worldY);

    // Snap to grid
    const snappedGridX = Math.floor(gridX);
    const snappedGridY = Math.floor(gridY);
    const { x, y } = gridToScreen(snappedGridX, snappedGridY, 0);

    this.placementMode.previewContainer.position.set(x, y);
    this.placementMode.previewContainer.zIndex = depthSort(snappedGridX, snappedGridY, 0);

    // Update highlight color based on collision check
    const isValid = this.checkPlacementValid(snappedGridX, snappedGridY, this.placementMode.rotation);
    const highlight = this.placementMode.previewContainer.children[1] as Graphics;
    this.updateHighlightColor(highlight, isValid);
  }

  /**
   * Confirm placement at current preview position
   */
  public confirmPlacement(): void {
    if (!this.placementMode) return;

    const worldPos = this.placementMode.previewContainer.position;
    const { gridX, gridY } = screenToGrid(worldPos.x, worldPos.y);
    const snappedGridX = Math.floor(gridX);
    const snappedGridY = Math.floor(gridY);

    if (!this.checkPlacementValid(snappedGridX, snappedGridY, this.placementMode.rotation)) {
      this.onPlacementFailed?.('Invalid placement: collision detected');
      return;
    }

    // Send to backend
    if (this.ws) {
      this.ws.send({
        type: 'furniture.place',
        roomId: this.currentRoomId,
        itemDefId: this.placementMode.itemDefId,
        x: snappedGridX,
        y: snappedGridY,
        rotation: this.placementMode.rotation,
      });
    }

    this.onPlacementSuccess?.();
    this.cancelPlacementMode();
  }

  /**
   * Cancel placement mode
   */
  public cancelPlacementMode(): void {
    if (this.placementMode) {
      this.world.removeChild(this.placementMode.previewContainer);
      this.placementMode.previewContainer.destroy({ children: true });
      this.placementMode = null;
    }
  }

  /**
   * Rotate preview furniture (if in placement mode)
   */
  public rotatePlacementPreview(): void {
    if (!this.placementMode) return;
    
    this.placementMode.rotation = (this.placementMode.rotation + 1) % 8;
    const sprite = this.placementMode.previewContainer.children[0] as Sprite;
    sprite.angle = this.placementMode.rotation * 45;

    // Update highlight for new rotation
    const highlight = this.placementMode.previewContainer.children[1] as Graphics;
    this.placementMode.previewContainer.removeChild(highlight);
    highlight.destroy();
    
    const newHighlight = this.createGridHighlight(this.placementMode.itemDefId, this.placementMode.rotation);
    this.placementMode.previewContainer.addChild(newHighlight);
  }

  /**
   * Select furniture for interaction (move/rotate/remove)
   */
  private selectFurniture(itemId: string): void {
    this.selectedItemId = itemId;
    this.onItemSelected?.(itemId);
    
    // Highlight selected item
    this.items.forEach(({ container }, id) => {
      const sprite = container.children[0] as Sprite;
      sprite.tint = id === itemId ? 0xffff00 : 0xffffff; // Yellow tint for selected
    });
  }

  /**
   * Remove selected furniture
   */
  public removeSelectedFurniture(): void {
    if (!this.selectedItemId) return;

    if (this.ws) {
      this.ws.send({
        type: 'furniture.remove',
        roomId: this.currentRoomId,
        itemId: this.selectedItemId,
      });
    }

    this.selectedItemId = null;
  }

  /**
   * Check if placement at position is valid (no collisions)
   */
  private checkPlacementValid(gridX: number, gridY: number, rotation: number): boolean {
    const itemDef = ITEM_DIMENSIONS[this.placementMode?.itemDefId || ''];
    if (!itemDef) return false;

    // Get affected tiles
    const isSwapped = rotation === 4 || rotation === 6;
    const width = isSwapped ? itemDef.depth : itemDef.width;
    const depth = isSwapped ? itemDef.width : itemDef.depth;

    // Check collision with existing furniture
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < depth; dy++) {
        const checkX = gridX + dx;
        const checkY = gridY + dy;

        for (const { item } of this.items.values()) {
          const existingDef = ITEM_DIMENSIONS[item.itemDefId];
          if (!existingDef) continue;

          const existingWidth = item.rotation === 4 || item.rotation === 6 ? existingDef.depth : existingDef.width;
          const existingDepth = item.rotation === 4 || item.rotation === 6 ? existingDef.width : existingDef.depth;

          for (let ex = 0; ex < existingWidth; ex++) {
            for (let ey = 0; ey < existingDepth; ey++) {
              if (item.x + ex === checkX && item.y + ey === checkY) {
                return false; // Collision detected
              }
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Create grid highlight for placement preview
   */
  private createGridHighlight(itemDefId: string, rotation: number): Graphics {
    const itemDef = ITEM_DIMENSIONS[itemDefId] || { width: 1, depth: 1, height: 1 };
    const isSwapped = rotation === 4 || rotation === 6;
    const width = isSwapped ? itemDef.depth : itemDef.width;
    const depth = isSwapped ? itemDef.width : itemDef.depth;

    const g = new Graphics();
    
    // Draw isometric grid cells
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < depth; dy++) {
        const offset = gridToScreen(dx, dy, 0);
        g.poly([
          offset.x, offset.y - TILE_HEIGHT / 2,
          offset.x + TILE_WIDTH / 2, offset.y,
          offset.x, offset.y + TILE_HEIGHT / 2,
          offset.x - TILE_WIDTH / 2, offset.y,
        ]);
      }
    }
    
    g.fill({ color: 0x00ff00, alpha: 0.3 }); // Green by default
    g.stroke({ width: 2, color: 0x00ff00 });

    return g;
  }

  /**
   * Update highlight color based on validity
   */
  private updateHighlightColor(highlight: Graphics, isValid: boolean): void {
    highlight.clear();
    
    const itemDef = ITEM_DIMENSIONS[this.placementMode?.itemDefId || ''] || { width: 1, depth: 1, height: 1 };
    const rotation = this.placementMode?.rotation || 0;
    const isSwapped = rotation === 4 || rotation === 6;
    const width = isSwapped ? itemDef.depth : itemDef.width;
    const depth = isSwapped ? itemDef.width : itemDef.depth;

    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < depth; dy++) {
        const offset = gridToScreen(dx, dy, 0);
        highlight.poly([
          offset.x, offset.y - TILE_HEIGHT / 2,
          offset.x + TILE_WIDTH / 2, offset.y,
          offset.x, offset.y + TILE_HEIGHT / 2,
          offset.x - TILE_WIDTH / 2, offset.y,
        ]);
      }
    }

    const color = isValid ? 0x00ff00 : 0xff0000;
    highlight.fill({ color, alpha: 0.3 });
    highlight.stroke({ width: 2, color });
  }

  /**
   * Create fallback placeholder sprite
   */
  private createPlaceholderSprite(itemDefId: string): Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(0, 0, 32, 32);
    
    const texture = Texture.from(canvas);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    return sprite;
  }

  /**
   * Check if in placement mode
   */
  public isInPlacementMode(): boolean {
    return this.placementMode !== null;
  }

  /**
   * Get all furniture items
   */
  public getAll(): FurnitureItem[] {
    return Array.from(this.items.values()).map(({ item }) => item);
  }

  /**
   * Show context menu for furniture item
   */
  private showContextMenu(itemId: string, screenX: number, screenY: number): void {
    this.selectFurniture(itemId);
    this.onContextMenu?.(itemId, screenX, screenY);
  }

  /**
   * Start dragging a furniture item to reposition it
   */
  public startDragMode(itemId: string): void {
    const entry = this.items.get(itemId);
    if (!entry) return;

    this.dragMode = {
      itemId,
      offsetX: 0,
      offsetY: 0,
    };

    console.log(`[FurnitureManager] Drag mode started for ${itemId}`);
  }

  /**
   * Update drag preview (called on mouse move)
   */
  public updateDragPreview(screenX: number, screenY: number): void {
    if (!this.dragMode) return;

    const entry = this.items.get(this.dragMode.itemId);
    if (!entry) return;

    const worldX = screenX - this.world.position.x;
    const worldY = screenY - this.world.position.y;
    const { gridX, gridY } = screenToGrid(worldX, worldY);

    const snappedGridX = Math.floor(gridX);
    const snappedGridY = Math.floor(gridY);
    const { x, y } = gridToScreen(snappedGridX, snappedGridY, entry.item.z);

    entry.container.position.set(x, y);
    entry.container.alpha = 0.6; // Semi-transparent while dragging
  }

  /**
   * Confirm drag reposition
   */
  public confirmDrag(): void {
    if (!this.dragMode) return;

    const entry = this.items.get(this.dragMode.itemId);
    if (!entry) return;

    const { gridX, gridY } = screenToGrid(entry.container.position.x, entry.container.position.y);
    const snappedGridX = Math.floor(gridX);
    const snappedGridY = Math.floor(gridY);

    // Check collision
    if (!this.checkMoveValid(this.dragMode.itemId, snappedGridX, snappedGridY, entry.item.rotation)) {
      this.cancelDrag();
      this.onPlacementFailed?.('Invalid position: collision detected');
      return;
    }

    // Send move to backend
    if (this.ws) {
      this.ws.send({
        type: 'furniture.move',
        roomId: this.currentRoomId,
        itemId: this.dragMode.itemId,
        x: snappedGridX,
        y: snappedGridY,
      });
    }

    entry.container.alpha = 1.0;
    this.dragMode = null;
  }

  /**
   * Cancel drag and restore original position
   */
  public cancelDrag(): void {
    if (!this.dragMode) return;

    const entry = this.items.get(this.dragMode.itemId);
    if (entry) {
      const { x, y } = gridToScreen(entry.item.x, entry.item.y, entry.item.z);
      entry.container.position.set(x, y);
      entry.container.alpha = 1.0;
    }

    this.dragMode = null;
  }

  /**
   * Rotate selected furniture
   */
  public rotateSelectedFurniture(): void {
    if (!this.selectedItemId) return;

    const entry = this.items.get(this.selectedItemId);
    if (!entry) return;

    const newRotation = (entry.item.rotation + 1) % 8;

    // Check collision with new rotation
    if (!this.checkMoveValid(this.selectedItemId, entry.item.x, entry.item.y, newRotation)) {
      this.onPlacementFailed?.('Cannot rotate: collision detected');
      return;
    }

    if (this.ws) {
      this.ws.send({
        type: 'furniture.rotate',
        roomId: this.currentRoomId,
        itemId: this.selectedItemId,
        rotation: newRotation,
      });
    }
  }

  /**
   * Check if move/rotation is valid (no collisions)
   */
  private checkMoveValid(itemId: string, gridX: number, gridY: number, rotation: number): boolean {
    const entry = this.items.get(itemId);
    if (!entry) return false;

    const itemDef = ITEM_DIMENSIONS[entry.item.itemDefId];
    if (!itemDef) return false;

    const isSwapped = rotation === 4 || rotation === 6;
    const width = isSwapped ? itemDef.depth : itemDef.width;
    const depth = isSwapped ? itemDef.width : itemDef.depth;

    // Check collision with other furniture
    for (const [otherId, { item }] of this.items) {
      if (otherId === itemId) continue; // Skip self

      const otherDef = ITEM_DIMENSIONS[item.itemDefId];
      if (!otherDef) continue;

      const otherWidth = item.rotation === 4 || item.rotation === 6 ? otherDef.depth : otherDef.width;
      const otherDepth = item.rotation === 4 || item.rotation === 6 ? otherDef.width : otherDef.depth;

      for (let dx = 0; dx < width; dx++) {
        for (let dy = 0; dy < depth; dy++) {
          const checkX = gridX + dx;
          const checkY = gridY + dy;

          for (let ox = 0; ox < otherWidth; ox++) {
            for (let oy = 0; oy < otherDepth; oy++) {
              if (item.x + ox === checkX && item.y + oy === checkY) {
                return false; // Collision
              }
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Handle server furniture.moved event
   */
  public onFurnitureMoved(itemId: string, x: number, y: number, z: number): void {
    const entry = this.items.get(itemId);
    if (!entry) return;

    entry.item.x = x;
    entry.item.y = y;
    entry.item.z = z;

    const { x: screenX, y: screenY } = gridToScreen(x, y, z);
    entry.container.position.set(screenX, screenY);
    entry.container.zIndex = depthSort(x, y, z);
  }

  /**
   * Handle server furniture.rotated event
   */
  public onFurnitureRotated(itemId: string, rotation: number): void {
    const entry = this.items.get(itemId);
    if (!entry) return;

    entry.item.rotation = rotation;
    const sprite = entry.container.children[0] as Sprite;
    sprite.angle = rotation * 45;
  }

  /**
   * Check if in drag mode
   */
  public isInDragMode(): boolean {
    return this.dragMode !== null;
  }
}
