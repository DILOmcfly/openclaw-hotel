import { Texture, BaseTexture } from 'pixi.js';
import { SPRITES } from '../sprites.js';

/**
 * SpriteLoader — Converts base64 sprites to Pixi Textures
 */
export class SpriteLoader {
  private textures: Map<string, Texture> = new Map();

  /**
   * Load all sprites from sprites.ts
   */
  async loadSprites(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [key, base64Data] of Object.entries(SPRITES)) {
      if (base64Data.startsWith('data:image/')) {
        // Base64 encoded PNG
        promises.push(this.loadBase64Sprite(key, base64Data));
      } else {
        // External URL (e.g., /assets/...)
        promises.push(this.loadExternalSprite(key, base64Data));
      }
    }

    await Promise.all(promises);
    console.log(`[SpriteLoader] Loaded ${this.textures.size} sprites`);
  }

  /**
   * Load base64 encoded sprite
   */
  private loadBase64Sprite(key: string, base64Data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const baseTexture = BaseTexture.from(img);
          const texture = new Texture(baseTexture);
          this.textures.set(key, texture);
          resolve();
        } catch (error) {
          console.error(`[SpriteLoader] Failed to create texture for ${key}:`, error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error(`[SpriteLoader] Failed to load image for ${key}:`, error);
        reject(error);
      };

      img.src = base64Data;
    });
  }

  /**
   * Load external sprite (URL)
   */
  private async loadExternalSprite(key: string, url: string): Promise<void> {
    try {
      const texture = await Texture.fromURL(url);
      this.textures.set(key, texture);
    } catch (error) {
      console.error(`[SpriteLoader] Failed to load sprite ${key} from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get texture by key
   */
  getTexture(key: string): Texture | null {
    return this.textures.get(key) || null;
  }

  /**
   * Check if sprite exists
   */
  hasSprite(key: string): boolean {
    return this.textures.has(key);
  }

  /**
   * Get all loaded sprites
   */
  getAllSprites(): Map<string, Texture> {
    return new Map(this.textures);
  }
}
