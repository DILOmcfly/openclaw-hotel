/**
 * Asset loader for pixel art PNG sprites
 * Loads real pixel art from sprites.ts (base64 data URIs) with fallback to /assets/ files
 */

import { Assets, Texture, Spritesheet, RenderTexture, Sprite } from 'pixi.js';
import { SPRITES, TILE_SPRITES, WALL_SPRITES, AGENT_SPRITES, FURNITURE_SPRITES } from './sprites.js';

export interface SpriteAtlas {
  textures: Record<string, Texture>;
  loaded: boolean;
}

// Target dimensions for scaled sprites (in pixels)
const SCALED_DIMENSIONS = {
  character: { width: 32, height: 48 },
  floor: { width: 64, height: 32 },
  furniture: { width: 48, height: 64 },
  wall: { width: 32, height: 64 },
};

class AssetLoaderClass {
  private atlas: SpriteAtlas = { textures: {}, loaded: false };
  private loading: Promise<void> | null = null;

  /**
   * Load all PNG assets and sprite atlas with progress callback
   */
  async load(onProgress?: (percent: number) => void): Promise<SpriteAtlas> {
    if (this.loading) {
      await this.loading;
      return this.atlas;
    }

    if (this.atlas.loaded) {
      return this.atlas;
    }

    this.loading = this._loadAssets(onProgress);
    await this.loading;
    return this.atlas;
  }

  /**
   * Pre-load textures from sprites.ts base64 data URIs
   * This gives us real pixel art assets without needing file fetches
   */
  private async _preloadFromSprites(): Promise<number> {
    let loaded = 0;
    const spriteEntries = Object.entries(SPRITES);
    
    for (const [name, dataUri] of spriteEntries) {
      try {
        // Map sprite names to the texture keys AssetLoader expects
        const textureKey = this._mapSpriteNameToKey(name);
        if (textureKey && !this.atlas.textures[textureKey]) {
          const texture = await Assets.load(dataUri);
          if (texture) {
            this.atlas.textures[textureKey] = texture;
            loaded++;
          }
        }
      } catch (err) {
        console.warn(`[AssetLoader] Failed to load sprite ${name} from data URI:`, err);
      }
    }
    
    console.log(`✓ Pre-loaded ${loaded} textures from sprites.ts`);
    return loaded;
  }

  /**
   * Map sprite names from sprites.ts to AssetLoader texture keys
   */
  private _mapSpriteNameToKey(spriteName: string): string | null {
    // Floor tiles map to the 3 floor types the renderer expects
    const floorMap: Record<string, string> = {
      'floor_stone': 'floor_plain.png',
      'floor_wood': 'floor_checker.png',
      'floor_carpet': 'floor_carpet.png',
    };
    
    // Wall tiles
    const wallMap: Record<string, string> = {
      'wall_stone': 'wall_left.png',
      'wall_brick': 'wall_right.png', 
      'wall_wood': 'wall_corner.png',
      'wall_metal': 'wall_left.png',
    };
    
    // Agent sprites: agent_dir0 -> char_north.png, etc.
    const agentMap: Record<string, string> = {
      'agent_dir0': 'char_north.png',
      'agent_dir2': 'char_south.png',
      'agent_dir4': 'char_west.png',
      'agent_dir6': 'char_east.png',
    };
    
    // Furniture: furn_chair -> furn_chair_basic.png, etc.
    const furnMap: Record<string, string> = {
      'furn_chair': 'furn_chair_basic.png',
      'furn_table': 'furn_table_round.png',
      'furn_lamp': 'furn_lamp_floor.png',
      'furn_sofa': 'furn_sofa_2seat.png',
      'furn_plant': 'furn_plant_small.png',
      'furn_bookshelf': 'furn_bookshelf_tall.png',
      'furn_computer': 'furn_computer_desk.png',
      'furn_bed': 'furn_bed_single.png',
      'furn_fridge': 'furn_fridge_mini.png',
      'furn_tv': 'furn_tv_flatscreen.png',
    };
    
    if (floorMap[spriteName]) return floorMap[spriteName];
    if (wallMap[spriteName]) return wallMap[spriteName];
    if (agentMap[spriteName]) return agentMap[spriteName];
    if (furnMap[spriteName]) return furnMap[spriteName];
    
    // Direct mapping: try spriteName.png
    return `${spriteName}.png`;
  }

  private async _loadAssets(onProgress?: (percent: number) => void): Promise<void> {
    try {
      onProgress?.(5); // Initial progress
      
      // STEP 1: Pre-load real pixel art from sprites.ts data URIs
      const preloaded = await this._preloadFromSprites();
      onProgress?.(8);
      console.log(`[AssetLoader] Pre-loaded ${preloaded} real pixel art textures from sprites.ts`);
      
      // Load sprite atlas JSON
      const atlasData = await fetch('/assets/sprites.json').then(r => r.json());
      onProgress?.(10); // Atlas loaded
      
      // Load individual textures
      const texturePromises: Promise<void>[] = [];
      const frameEntries = Object.entries(atlasData.frames);
      const totalFrames = frameEntries.length;
      let loadedFrames = 0;
      
      for (const [frameName, frameData] of frameEntries) {
        // Skip if already pre-loaded from sprites.ts
        if (this.atlas.textures[frameName]) {
          loadedFrames++;
          const percent = 10 + Math.floor((loadedFrames / totalFrames) * 85);
          onProgress?.(percent);
          continue;
        }
        
        const fileName = frameName.replace('char_spritesheet_', '');
        
        // For spritesheet frames, we need to load the base spritesheet
        if (frameName.startsWith('char_spritesheet_')) {
          if (!this.atlas.textures['character_spritesheet.png']) {
            texturePromises.push(
              Assets.load('/assets/character_spritesheet.png').then((texture) => {
                this.atlas.textures['character_spritesheet.png'] = texture;
                
                // Create sub-textures for each frame
                const frame = (frameData as any).frame;
                const subTexture = new Texture({
                  source: texture.source,
                  frame: { x: frame.x, y: frame.y, width: frame.w, height: frame.h }
                });
                this.atlas.textures[frameName] = subTexture;
                
                // Update progress
                loadedFrames++;
                const percent = 10 + Math.floor((loadedFrames / totalFrames) * 85);
                onProgress?.(percent);
              })
            );
          }
        } else {
          // Load individual PNG files (prefer _gemini version if available)
          const basePath = frameName.replace('.png', '');
          const geminiPath = `/assets/${basePath}_gemini.png`;
          const fallbackPath = `/assets/${frameName}`;
          
          texturePromises.push(
            // Try gemini version first
            Assets.load(geminiPath)
              .then((texture) => {
                // Scale down large gemini images
                const scaled = this.scaleTexture(texture, frameName);
                this.atlas.textures[frameName] = scaled;
                
                // Update progress
                loadedFrames++;
                const percent = 10 + Math.floor((loadedFrames / totalFrames) * 85);
                onProgress?.(percent);
              })
              .catch(() => {
                // Fallback to original small sprite
                return Assets.load(fallbackPath).then((texture) => {
                  this.atlas.textures[frameName] = texture;
                  
                  // Update progress
                  loadedFrames++;
                  const percent = 10 + Math.floor((loadedFrames / totalFrames) * 85);
                  onProgress?.(percent);
                });
              })
              .catch(err => {
                console.warn(`Failed to load ${frameName}:`, err);
                loadedFrames++;
                const percent = 10 + Math.floor((loadedFrames / totalFrames) * 85);
                onProgress?.(percent);
              })
          );
        }
      }
      
      await Promise.all(texturePromises);
      onProgress?.(95);
      this.atlas.loaded = true;
      onProgress?.(100);
      console.log(`✓ Loaded ${Object.keys(this.atlas.textures).length} textures`);
    } catch (error) {
      console.error('Failed to load assets:', error);
      throw error;
    }
  }

  /**
   * Scale large gemini textures to appropriate game size using canvas
   */
  private scaleTexture(texture: Texture, frameName: string): Texture {
    // Determine target dimensions based on sprite type
    let targetWidth = 64;
    let targetHeight = 64;

    if (frameName.startsWith('char_')) {
      targetWidth = SCALED_DIMENSIONS.character.width;
      targetHeight = SCALED_DIMENSIONS.character.height;
    } else if (frameName.startsWith('floor_')) {
      targetWidth = SCALED_DIMENSIONS.floor.width;
      targetHeight = SCALED_DIMENSIONS.floor.height;
    } else if (frameName.startsWith('furn_')) {
      targetWidth = SCALED_DIMENSIONS.furniture.width;
      targetHeight = SCALED_DIMENSIONS.furniture.height;
    } else if (frameName.startsWith('wall_')) {
      targetWidth = SCALED_DIMENSIONS.wall.width;
      targetHeight = SCALED_DIMENSIONS.wall.height;
    }

    // If texture is already small enough, return as-is
    if (texture.width <= targetWidth * 2 && texture.height <= targetHeight * 2) {
      return texture;
    }

    // Calculate scale to fit target dimensions
    const scaleX = targetWidth / texture.width;
    const scaleY = targetHeight / texture.height;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = Math.floor(texture.width * scale);
    const scaledHeight = Math.floor(texture.height * scale);

    // Create canvas and scale down
    const canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn(`[AssetLoader] Failed to create canvas context for ${frameName}`);
      return texture;
    }

    // Use nearest-neighbor scaling for pixel art
    ctx.imageSmoothingEnabled = false;

    // Extract image from texture source
    const source = texture.source;
    const img = source.resource as HTMLImageElement | HTMLCanvasElement;
    
    if (img) {
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
    } else {
      console.warn(`[AssetLoader] No image resource for ${frameName}`);
      return texture;
    }

    // Create new texture from canvas
    return Texture.from(canvas);
  }

  /**
   * Get a texture by name
   */
  getTexture(name: string): Texture | undefined {
    return this.atlas.textures[name];
  }

  /**
   * Get character texture for direction (0=N, 1=E, 2=S, 3=W)
   */
  getCharacterTexture(direction: number): Texture | undefined {
    const dirNames = ['north', 'east', 'south', 'west'];
    const dirName = dirNames[direction % 4];
    
    // Try spritesheet first
    let textureName = `char_spritesheet_${dirName}`;
    let texture = this.atlas.textures[textureName];
    
    // Fallback to individual files
    if (!texture) {
      textureName = `char_${dirName}.png`;
      texture = this.atlas.textures[textureName];
    }
    
    return texture;
  }

  /**
   * Get floor tile texture
   */
  getFloorTexture(type: 'plain' | 'carpet' | 'checker'): Texture | undefined {
    return this.atlas.textures[`floor_${type}.png`];
  }

  /**
   * Get wall texture
   */
  getWallTexture(side: 'left' | 'right' | 'corner'): Texture | undefined {
    return this.atlas.textures[`wall_${side}.png`];
  }

  /**
   * Get furniture texture (with placeholder fallback for missing items)
   */
  getFurnitureTexture(type: string): Texture | undefined {
    const textureName = `furn_${type}.png`;
    let texture = this.atlas.textures[textureName];
    
    // If texture doesn't exist, create colored placeholder
    if (!texture) {
      texture = this.createPlaceholderTexture(type);
      this.atlas.textures[textureName] = texture; // Cache it
    }
    
    return texture;
  }

  /**
   * Create colored placeholder for missing furniture sprites
   */
  private createPlaceholderTexture(type: string): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = SCALED_DIMENSIONS.furniture.width;
    canvas.height = SCALED_DIMENSIONS.furniture.height;
    const ctx = canvas.getContext('2d')!;

    // Color mapping for different furniture types
    const colorMap: Record<string, string> = {
      plant: '#4CAF50',      // Green
      sofa: '#8D6E63',       // Brown
      desk: '#607D8B',       // Blue-gray
    };

    const color = colorMap[type] || '#9E9E9E'; // Default gray

    // Draw simple rectangle placeholder
    ctx.fillStyle = color;
    ctx.fillRect(8, 16, 32, 40);
    
    // Add border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 16, 32, 40);

    // Add simple icon/letter
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type.charAt(0).toUpperCase(), 24, 36);

    return Texture.from(canvas);
  }
}

export const AssetLoader = new AssetLoaderClass();
