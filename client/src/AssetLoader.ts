/**
 * Asset loader for pixel art PNG sprites
 */

import { Assets, Texture, Spritesheet } from 'pixi.js';

export interface SpriteAtlas {
  textures: Record<string, Texture>;
  loaded: boolean;
}

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
          // Load individual PNG files
          const path = `/assets/${frameName}`;
          texturePromises.push(
            Assets.load(path).then((texture) => {
              this.atlas.textures[frameName] = texture;
            }).catch(err => {
              console.warn(`Failed to load ${path}:`, err);
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
   * Get furniture texture
   */
  getFurnitureTexture(type: string): Texture | undefined {
    return this.atlas.textures[`furn_${type}.png`];
  }
}

export const AssetLoader = new AssetLoaderClass();
