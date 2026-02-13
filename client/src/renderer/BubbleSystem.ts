import { Container, Graphics } from 'pixi.js';
import { gridToScreen } from './IsoRenderer.js';

interface Bubble {
  agentId: string;
  container: Container;
  expiresAt: number;
}

const BUBBLE_DURATION = 4000; // ms

export class BubbleSystem {
  private bubbles: Bubble[] = [];
  private world: Container;

  constructor(world: Container) {
    this.world = world;
  }

  show(agentId: string, _content: string, gridX: number, gridY: number): void {
    // Remove existing bubble for this agent
    this.removeBubble(agentId);

    const container = new Container();
    const { x, y } = gridToScreen(gridX, gridY, 0);

    // Bubble background
    const bg = new Graphics();
    bg.roundRect(-50, -40, 100, 24, 6);
    bg.fill(0xffffff);
    bg.stroke({ width: 1, color: 0x000000 });
    // Tail
    bg.poly([-4, -16, 4, -16, 0, -10]);
    bg.fill(0xffffff);
    container.addChild(bg);

    // Note: Pixi.js Text requires the full library — for CDN we keep it simple
    // In production, add Text rendering here

    container.position.set(x, y - 48);
    container.zIndex = 9999;
    this.world.addChild(container);

    this.bubbles.push({
      agentId,
      container,
      expiresAt: Date.now() + BUBBLE_DURATION,
    });
  }

  update(): void {
    const now = Date.now();
    const expired = this.bubbles.filter((b) => b.expiresAt <= now);
    for (const b of expired) {
      this.world.removeChild(b.container);
    }
    this.bubbles = this.bubbles.filter((b) => b.expiresAt > now);
  }

  private removeBubble(agentId: string): void {
    const idx = this.bubbles.findIndex((b) => b.agentId === agentId);
    if (idx >= 0) {
      this.world.removeChild(this.bubbles[idx].container);
      this.bubbles.splice(idx, 1);
    }
  }
}
