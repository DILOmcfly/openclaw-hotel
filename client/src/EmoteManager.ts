/**
 * EmoteManager - Handles emote animations and broadcasting
 * Supports chat commands like /wave, /dance, /sit, /laugh
 */

import { Container, Text, Graphics, Sprite } from 'pixi.js';

export type EmoteName = 'wave' | 'dance' | 'laugh' | 'sit' | 'stand';

export interface EmoteDefinition {
  name: EmoteName;
  duration: number; // milliseconds
  animation: (container: Container, sprite: Sprite | undefined, elapsed: number) => void;
  cleanup?: (container: Container, sprite: Sprite | undefined) => void;
}

export interface ActiveEmote {
  agentId: string;
  emoteName: EmoteName;
  startTime: number;
  duration: number;
  container: Container;
  sprite?: Sprite;
  bubble?: Container;
}

export class EmoteManager {
  private emotes: Map<EmoteName, EmoteDefinition> = new Map();
  private activeEmotes: Map<string, ActiveEmote> = new Map();

  constructor() {
    this.registerDefaultEmotes();
  }

  /**
   * Register default emote animations
   */
  private registerDefaultEmotes(): void {
    // Wave - Hand wave with emoji
    this.register({
      name: 'wave',
      duration: 2500,
      animation: (container, sprite, elapsed) => {
        // Find or create bubble
        let bubble = container.children.find(c => c.name === 'emote-bubble') as Container;
        if (!bubble) {
          bubble = this.createEmoteBubble('👋');
          bubble.name = 'emote-bubble';
          container.addChild(bubble);
        }

        // Gentle wave motion
        const phase = (elapsed / 300) * Math.PI * 2;
        bubble.position.y = -50 + Math.sin(phase) * 3;
        bubble.alpha = Math.max(0, 1 - elapsed / 2500);
      },
      cleanup: (container) => {
        const bubble = container.children.find(c => c.name === 'emote-bubble');
        if (bubble) container.removeChild(bubble);
      },
    });

    // Dance - Rotation + bounce
    this.register({
      name: 'dance',
      duration: 3000,
      animation: (container, sprite, elapsed) => {
        if (!sprite) return;

        // Fast bounce
        const bouncePhase = (elapsed / 150) * Math.PI * 2;
        sprite.position.y = Math.sin(bouncePhase) * 4;

        // Slight rotation wiggle
        const rotationPhase = (elapsed / 200) * Math.PI * 2;
        sprite.angle = Math.sin(rotationPhase) * 8;

        // Music note bubble
        let bubble = container.children.find(c => c.name === 'emote-bubble') as Container;
        if (!bubble) {
          bubble = this.createEmoteBubble('🎵');
          bubble.name = 'emote-bubble';
          container.addChild(bubble);
        }

        bubble.position.y = -45;
        bubble.alpha = Math.max(0, 1 - elapsed / 3000);
      },
      cleanup: (container, sprite) => {
        if (sprite) {
          sprite.angle = 0;
          sprite.position.y = 0;
        }
        const bubble = container.children.find(c => c.name === 'emote-bubble');
        if (bubble) container.removeChild(bubble);
      },
    });

    // Laugh - Horizontal shake + emoji
    this.register({
      name: 'laugh',
      duration: 2000,
      animation: (container, sprite, elapsed) => {
        if (!sprite) return;

        // Shake horizontally
        const shakePhase = (elapsed / 50) * Math.PI * 2;
        sprite.position.x = Math.sin(shakePhase * 4) * 2;

        // Slight vertical bounce
        const bouncePhase = (elapsed / 100) * Math.PI * 2;
        sprite.position.y = Math.abs(Math.sin(bouncePhase)) * 2;

        // Laughing emoji
        let bubble = container.children.find(c => c.name === 'emote-bubble') as Container;
        if (!bubble) {
          bubble = this.createEmoteBubble('😂');
          bubble.name = 'emote-bubble';
          container.addChild(bubble);
        }

        bubble.position.y = -50;
        bubble.alpha = Math.max(0, 1 - elapsed / 2000);
      },
      cleanup: (container, sprite) => {
        if (sprite) {
          sprite.position.x = 0;
          sprite.position.y = 0;
        }
        const bubble = container.children.find(c => c.name === 'emote-bubble');
        if (bubble) container.removeChild(bubble);
      },
    });

    // Sit - Lower sprite position (handled separately by AgentSprite state)
    this.register({
      name: 'sit',
      duration: 0, // Persistent until 'stand' is triggered
      animation: () => {
        // State-based, handled by AgentSprite
      },
    });

    // Stand - Return from sitting
    this.register({
      name: 'stand',
      duration: 0,
      animation: () => {
        // State-based, handled by AgentSprite
      },
    });
  }

  /**
   * Register a custom emote
   */
  public register(emote: EmoteDefinition): void {
    this.emotes.set(emote.name, emote);
  }

  /**
   * Play an emote for a specific agent
   */
  public play(agentId: string, emoteName: EmoteName, container: Container, sprite?: Sprite): void {
    const emote = this.emotes.get(emoteName);
    if (!emote) {
      console.warn(`[EmoteManager] Emote not found: ${emoteName}`);
      return;
    }

    // Cancel existing emote for this agent
    this.cancel(agentId);

    // Create active emote
    const activeEmote: ActiveEmote = {
      agentId,
      emoteName,
      startTime: Date.now(),
      duration: emote.duration,
      container,
      sprite,
    };

    this.activeEmotes.set(agentId, activeEmote);
  }

  /**
   * Update all active emotes (call from game loop)
   */
  public update(deltaMs: number): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [agentId, activeEmote] of this.activeEmotes) {
      const elapsed = now - activeEmote.startTime;

      // Check if emote has finished
      if (activeEmote.duration > 0 && elapsed >= activeEmote.duration) {
        toRemove.push(agentId);
        continue;
      }

      // Run animation
      const emote = this.emotes.get(activeEmote.emoteName);
      if (emote) {
        emote.animation(activeEmote.container, activeEmote.sprite, elapsed);
      }
    }

    // Remove finished emotes
    for (const agentId of toRemove) {
      this.cancel(agentId);
    }
  }

  /**
   * Cancel active emote for agent
   */
  public cancel(agentId: string): void {
    const activeEmote = this.activeEmotes.get(agentId);
    if (!activeEmote) return;

    // Run cleanup
    const emote = this.emotes.get(activeEmote.emoteName);
    if (emote?.cleanup) {
      emote.cleanup(activeEmote.container, activeEmote.sprite);
    }

    this.activeEmotes.delete(agentId);
  }

  /**
   * Check if agent has active emote
   */
  public hasActiveEmote(agentId: string): boolean {
    return this.activeEmotes.has(agentId);
  }

  /**
   * Get active emote name for agent
   */
  public getActiveEmote(agentId: string): EmoteName | null {
    return this.activeEmotes.get(agentId)?.emoteName ?? null;
  }

  /**
   * Create an emote bubble with emoji
   */
  private createEmoteBubble(emoji: string): Container {
    const bubble = new Container();

    // Background circle
    const bg = new Graphics();
    bg.circle(0, 0, 16);
    bg.fill({ color: 0xffffff, alpha: 0.9 });
    bg.stroke({ width: 2, color: 0x000000 });
    bubble.addChild(bg);

    // Emoji text
    const text = new Text({
      text: emoji,
      style: {
        fontSize: 20,
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    text.position.set(0, 0);
    bubble.addChild(text);

    bubble.position.set(0, -50); // Above agent

    return bubble;
  }

  /**
   * Parse emote command from chat message
   * Returns emote name if valid command, null otherwise
   */
  public static parseEmoteCommand(message: string): EmoteName | null {
    const match = message.trim().match(/^\/(\w+)$/);
    if (!match) return null;

    const command = match[1].toLowerCase();
    const validEmotes: EmoteName[] = ['wave', 'dance', 'laugh', 'sit', 'stand'];

    return validEmotes.includes(command as EmoteName) ? (command as EmoteName) : null;
  }
}
