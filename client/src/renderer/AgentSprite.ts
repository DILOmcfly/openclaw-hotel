import { Container, Graphics, Sprite } from 'pixi.js';
import { gridToScreen, depthSort } from './IsoRenderer.js';
import { AssetLoader } from '../AssetLoader.js';
import { ObjectPool } from './ObjectPool.js';
import { memoryProfiler } from './MemoryProfiler.js';
import { ViewportCulling } from './ViewportCulling.js';

export interface AgentState {
  agentId: string;
  x: number;
  y: number;
  color: number;
  name?: string;
  direction?: number; // 0=N, 1=E, 2=S, 3=W
  isSitting?: boolean;
  furnitureId?: string;
}

interface AnimationState {
  isMoving: boolean;
  idleTime: number;
  walkFrame: number;
  lastX: number;
  lastY: number;
  // Smooth movement (lerp)
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  moveProgress: number;
  moveDuration: number; // ms per tile
  // Idle variations
  nextIdleVariation: number;
  idleVariationType: 'none' | 'flip' | 'stretch';
}

export class AgentRenderer {
  private agents: Map<string, { 
    state: AgentState; 
    container: Container; 
    sprite?: Sprite;
    animation: AnimationState;
  }> = new Map();
  private world: Container;
  private animationTime: number = 0;
  private containerPool: ObjectPool<Container>;
  private viewportCulling: ViewportCulling;

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
      },
      destroy: (container) => {
        container.destroy({ children: true });
        memoryProfiler.trackContainerDestroy();
      },
      maxSize: 50,
      preAllocate: 10,
    });

    // Initialize viewport culling
    this.viewportCulling = new ViewportCulling(world);
  }

  /**
   * Update animations for all agents (call from game loop)
   */
  public updateAnimations(deltaMs: number): void {
    this.animationTime += deltaMs;

    for (const entry of this.agents.values()) {
      this.updateAgentAnimation(entry, deltaMs);
    }
  }

  private updateAgentAnimation(
    entry: { state: AgentState; container: Container; sprite?: Sprite; animation: AnimationState },
    deltaMs: number
  ): void {
    const { state, container, sprite, animation } = entry;

    // Detect if target position changed
    const targetChanged = state.x !== animation.targetX || state.y !== animation.targetY;
    
    if (targetChanged) {
      // Start new smooth movement
      animation.targetX = state.x;
      animation.targetY = state.y;
      animation.moveProgress = 0;
      animation.isMoving = true;
    }

    // Smooth movement (lerp between tiles)
    if (animation.isMoving && animation.moveProgress < 1) {
      animation.moveProgress = Math.min(1, animation.moveProgress + deltaMs / animation.moveDuration);
      
      // Easing function (ease-out cubic)
      const t = animation.moveProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      
      animation.currentX = animation.lastX + (animation.targetX - animation.lastX) * eased;
      animation.currentY = animation.lastY + (animation.targetY - animation.lastY) * eased;

      // Update container position
      const { x, y } = gridToScreen(animation.currentX, animation.currentY, 0);
      container.position.set(x, y);
      container.zIndex = depthSort(Math.floor(animation.currentX), Math.floor(animation.currentY), 0);

      // Walking bounce
      if (sprite && !state.isSitting) {
        const bounce = Math.sin(this.animationTime / 100) * 1.5;
        sprite.position.y = bounce;
      }

      // Movement complete
      if (animation.moveProgress >= 1) {
        animation.isMoving = false;
        animation.lastX = animation.targetX;
        animation.lastY = animation.targetY;
        animation.currentX = animation.targetX;
        animation.currentY = animation.targetY;
        animation.idleTime = 0;
      }
    } else if (!animation.isMoving) {
      // Idle state
      animation.idleTime += deltaMs;

      if (sprite) {
        // Sitting pose
        if (state.isSitting) {
          // Lower sprite and apply sitting offset
          sprite.position.y = 8; // Lowered position
          sprite.scale.y = 0.85; // Slightly compressed
        } else {
          // Idle bob
          const bobAmplitude = 2; // pixels
          const bobSpeed = 0.002; // radians per ms
          const bob = Math.sin(animation.idleTime * bobSpeed) * bobAmplitude;
          sprite.position.y = bob;
          sprite.scale.y = 1.0;

          // Idle variations
          if (animation.idleTime >= animation.nextIdleVariation) {
            this.triggerIdleVariation(animation, sprite);
            // Schedule next variation (8-12 seconds)
            animation.nextIdleVariation = animation.idleTime + 8000 + Math.random() * 4000;
          }

          // Apply active idle variation
          this.applyIdleVariation(animation, sprite, animation.idleTime);
        }
      }
    }
  }

  /**
   * Trigger a random idle variation
   */
  private triggerIdleVariation(animation: AnimationState, sprite: Sprite): void {
    const variations: Array<'flip' | 'stretch'> = ['flip', 'stretch'];
    animation.idleVariationType = variations[Math.floor(Math.random() * variations.length)];
    animation.idleTime = 0; // Reset for variation timing
  }

  /**
   * Apply current idle variation effect
   */
  private applyIdleVariation(animation: AnimationState, sprite: Sprite, elapsed: number): void {
    if (animation.idleVariationType === 'none') return;

    if (animation.idleVariationType === 'flip') {
      // Quick head turn (sprite flip)
      if (elapsed < 150) {
        sprite.scale.x = -Math.abs(sprite.scale.x);
      } else if (elapsed < 300) {
        sprite.scale.x = Math.abs(sprite.scale.x);
      } else {
        animation.idleVariationType = 'none';
      }
    } else if (animation.idleVariationType === 'stretch') {
      // Subtle stretch (scale Y 1.0 → 1.05 → 1.0)
      const duration = 600;
      if (elapsed < duration) {
        const t = elapsed / duration;
        const scale = 1.0 + Math.sin(t * Math.PI) * 0.05;
        sprite.scale.y = scale;
      } else {
        sprite.scale.y = 1.0;
        animation.idleVariationType = 'none';
      }
    }
  }

  /**
   * Update viewport for culling (call on window resize or camera move)
   */
  public updateViewport(screenWidth: number, screenHeight: number, scale: number = 1): void {
    this.viewportCulling.updateViewport(screenWidth, screenHeight, scale);
  }

  /**
   * Perform viewport culling on all agents
   */
  public cullAgents(): number {
    const cullableObjects = Array.from(this.agents.values()).map(entry => ({
      gridX: entry.state.x,
      gridY: entry.state.y,
      container: entry.container,
    }));
    
    return this.viewportCulling.cullObjects(cullableObjects);
  }

  addOrUpdate(state: AgentState): void {
    let entry = this.agents.get(state.agentId);

    if (!entry) {
      const container = this.containerPool.acquire();
      
      // Try to use character sprite
      const direction = state.direction ?? 2; // Default to south
      const texture = AssetLoader.getCharacterTexture(direction);
      
      const animation: AnimationState = {
        isMoving: false,
        idleTime: 0,
        walkFrame: 0,
        lastX: state.x,
        lastY: state.y,
        currentX: state.x,
        currentY: state.y,
        targetX: state.x,
        targetY: state.y,
        moveProgress: 1,
        moveDuration: 300, // 300ms per tile
        nextIdleVariation: 8000 + Math.random() * 4000, // 8-12 seconds
        idleVariationType: 'none',
      };

      if (texture) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1); // Anchor at bottom center
        sprite.tint = state.color;
        container.addChild(sprite);
        memoryProfiler.trackSpriteCreate();
        entry = { state, container, sprite, animation };
      } else {
        // Fallback to graphics
        const body = new Graphics();
        body.circle(0, -12, 8);
        body.fill(state.color);
        body.stroke({ width: 1, color: 0x000000 });
        // Torso
        body.roundRect(-6, -4, 12, 16, 3);
        body.fill(state.color);
        body.stroke({ width: 1, color: 0x000000 });
        container.addChild(body);
        entry = { state, container, animation };
      }

      this.world.addChild(container);
      this.agents.set(state.agentId, entry);
    } else {
      // Update sprite direction if changed
      if (entry.sprite && state.direction !== undefined && state.direction !== entry.state.direction) {
        const texture = AssetLoader.getCharacterTexture(state.direction);
        if (texture) {
          entry.sprite.texture = texture;
        }
      }
      
      // Update color/tint
      if (entry.sprite && state.color !== entry.state.color) {
        entry.sprite.tint = state.color;
      }
    }

    entry.state = state;
    const { x, y } = gridToScreen(state.x, state.y, 0);
    entry.container.position.set(x, y); // Sprite anchored at bottom, no offset needed
    entry.container.zIndex = depthSort(state.x, state.y, 0);
  }

  remove(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      this.world.removeChild(entry.container);
      
      // Track sprite destruction
      if (entry.sprite) {
        memoryProfiler.trackSpriteDestroy();
      }
      
      // Return container to pool
      this.containerPool.release(entry.container);
      
      this.agents.delete(agentId);
    }
  }

  /**
   * Cleanup all agents and release resources
   */
  public cleanup(): void {
    const agentIds = Array.from(this.agents.keys());
    for (const agentId of agentIds) {
      this.remove(agentId);
    }
    
    memoryProfiler.cleanup();
  }

  getAll(): AgentState[] {
    return Array.from(this.agents.values()).map((e) => e.state);
  }

  /**
   * Update agent sitting state
   */
  setSitting(agentId: string, isSitting: boolean, furnitureId?: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    entry.state.isSitting = isSitting;
    entry.state.furnitureId = furnitureId;
  }

  /**
   * Get agent container for emote rendering
   */
  getContainer(agentId: string): Container | undefined {
    return this.agents.get(agentId)?.container;
  }

  /**
   * Get agent sprite for emote rendering
   */
  getSprite(agentId: string): Sprite | undefined {
    return this.agents.get(agentId)?.sprite;
  }
}
