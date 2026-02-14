import { Container, Graphics, Sprite } from 'pixi.js';
import { gridToScreen, depthSort } from './IsoRenderer.js';
import { AssetLoader } from '../AssetLoader.js';

export interface AgentState {
  agentId: string;
  x: number;
  y: number;
  color: number;
  name?: string;
  direction?: number; // 0=N, 1=E, 2=S, 3=W
}

interface AnimationState {
  isMoving: boolean;
  idleTime: number;
  walkFrame: number;
  lastX: number;
  lastY: number;
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

  constructor(world: Container) {
    this.world = world;
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

    // Detect if agent is moving
    const isMoving = state.x !== animation.lastX || state.y !== animation.lastY;
    animation.isMoving = isMoving;

    if (isMoving) {
      // Walking animation: cycle frames
      animation.walkFrame = (animation.walkFrame + deltaMs / 150) % 2;
      animation.idleTime = 0;
      animation.lastX = state.x;
      animation.lastY = state.y;

      // If sprite exists, apply subtle bounce
      if (sprite) {
        const bounce = Math.sin(this.animationTime / 100) * 1.5;
        sprite.position.y = bounce;
      }
    } else {
      // Idle animation: gentle bob up and down
      animation.idleTime += deltaMs;
      
      if (sprite) {
        const bobAmplitude = 2; // pixels
        const bobSpeed = 0.002; // radians per ms
        const bob = Math.sin(animation.idleTime * bobSpeed) * bobAmplitude;
        sprite.position.y = bob;
      }
    }
  }

  addOrUpdate(state: AgentState): void {
    let entry = this.agents.get(state.agentId);

    if (!entry) {
      const container = new Container();
      
      // Try to use character sprite
      const direction = state.direction ?? 2; // Default to south
      const texture = AssetLoader.getCharacterTexture(direction);
      
      const animation: AnimationState = {
        isMoving: false,
        idleTime: 0,
        walkFrame: 0,
        lastX: state.x,
        lastY: state.y,
      };

      if (texture) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1); // Anchor at bottom center
        sprite.tint = state.color;
        container.addChild(sprite);
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
      this.agents.delete(agentId);
    }
  }

  getAll(): AgentState[] {
    return Array.from(this.agents.values()).map((e) => e.state);
  }
}
