/**
 * Asset loader for pixel art PNG sprites
 */

import { Assets, Texture, Spritesheet, RenderTexture, Sprite } from 'pixi.js';

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
   * Load all PNG assets and sprite atlas
   */
  async load(): Promise<SpriteAtlas> {
    if (this.loading) {
      await this.loading;
      return this.atlas;
    }

    if (this.atlas.loaded) {
      return this.atlas;
    }

    this.loading = this._loadAssets();
    await this.loading;
    return this.atlas;
  }

  private async _loadAssets(): Promise<void> {
    try {
      // Load sprite atlas JSON
      const atlasData = await fetch('/assets/sprites.json').then(r => r.json());
      
      // Load individual textures
      const texturePromises: Promise<void>[] = [];
      
      for (const [frameName, frameData] of Object.entries(atlasData.frames)) {
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
              })
              .catch(() => {
                // Fallback to original small sprite
                return Assets.load(fallbackPath).then((texture) => {
                  this.atlas.textures[frameName] = texture;
                });
              })
              .catch(err => {
                console.warn(`Failed to load ${frameName}:`, err);
              })
          );
        }
      }
      
      await Promise.all(texturePromises);
      this.atlas.loaded = true;
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
