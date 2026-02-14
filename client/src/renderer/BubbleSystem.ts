import { gridToScreen } from './IsoRenderer.js';

interface Bubble {
  agentId: string;
  element: HTMLDivElement;
  expiresAt: number;
  gridX: number;
  gridY: number;
}

const BUBBLE_DURATION = 5000;

export class BubbleSystem {
  private bubbles: Bubble[] = [];
  private worldEl: HTMLElement;
  private offsetX: number;
  private offsetY: number;

  constructor(_worldContainer: unknown, offsetX: number, offsetY: number) {
    // Create an overlay div for HTML-based speech bubbles
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.worldEl = document.createElement('div');
    this.worldEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50';
    document.body.appendChild(this.worldEl);
  }

  updateOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  show(agentId: string, content: string, gridX: number, gridY: number): void {
    this.removeBubble(agentId);

    const { x, y } = gridToScreen(gridX, gridY, 0);
    const screenX = x + this.offsetX;
    const screenY = y + this.offsetY - 60;

    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute;
      left: ${screenX}px;
      top: ${screenY}px;
      transform: translateX(-50%);
      background: #fff;
      color: #000;
      border: 2px solid #000;
      border-radius: 12px;
      padding: 6px 14px;
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      font-weight: bold;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 2px 2px 0px rgba(0,0,0,0.2);
      animation: bubbleIn 0.2s ease-out;
    `;

    // Add agent name prefix
    const nameSpan = document.createElement('span');
    nameSpan.style.color = '#7E57C2';
    nameSpan.textContent = agentId.slice(0, 10) + ': ';
    el.appendChild(nameSpan);
    el.appendChild(document.createTextNode(content));

    // Tail (CSS triangle)
    const tail = document.createElement('div');
    tail.style.cssText = `
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid #000;
    `;
    el.appendChild(tail);
    const tailInner = document.createElement('div');
    tailInner.style.cssText = `
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid #fff;
    `;
    el.appendChild(tailInner);

    this.worldEl.appendChild(el);
    this.bubbles.push({
      agentId,
      element: el,
      expiresAt: Date.now() + BUBBLE_DURATION,
      gridX,
      gridY,
    });
  }

  update(): void {
    const now = Date.now();
    const expired = this.bubbles.filter((b) => b.expiresAt <= now);
    for (const b of expired) {
      b.element.remove();
    }
    this.bubbles = this.bubbles.filter((b) => b.expiresAt > now);
  }

  private removeBubble(agentId: string): void {
    const idx = this.bubbles.findIndex((b) => b.agentId === agentId);
    if (idx >= 0) {
      this.bubbles[idx].element.remove();
      this.bubbles.splice(idx, 1);
    }
  }
}
