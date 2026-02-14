import { gridToScreen } from './IsoRenderer.js';

interface Bubble {
  agentId: string;
  element: HTMLDivElement;
  expiresAt: number;
  gridX: number;
  gridY: number;
  /** For paginated bubbles: remaining chunks to show */
  pendingChunks?: string[];
  /** Timer id for pagination */
  pageTimer?: ReturnType<typeof setTimeout>;
}

/** Max chars per bubble page */
const CHUNK_SIZE = 100;
/** How long each page stays visible (ms) */
const PAGE_DURATION = 3000;
/** Duration for short messages (ms) */
const SHORT_DURATION = 4000;
/** Max bubble width in px */
const MAX_WIDTH = 220;

export class BubbleSystem {
  private bubbles: Bubble[] = [];
  private worldEl: HTMLElement;
  private offsetX: number;
  private offsetY: number;

  constructor(_worldContainer: unknown, offsetX: number, offsetY: number) {
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

    // Split long messages into chunks at word boundaries
    const chunks = this.splitIntoChunks(content, CHUNK_SIZE);
    const firstChunk = chunks.shift()!;
    const remaining = chunks;

    const bubble = this.createBubbleElement(agentId, firstChunk, gridX, gridY, remaining.length > 0);

    const entry: Bubble = {
      agentId,
      element: bubble,
      expiresAt: 0, // managed by pagination or timeout
      gridX,
      gridY,
      pendingChunks: remaining,
    };

    this.worldEl.appendChild(bubble);
    this.bubbles.push(entry);

    if (remaining.length > 0) {
      // Paginated: show each chunk for PAGE_DURATION
      this.scheduleNextPage(entry);
    } else {
      // Short message: simple timeout
      entry.expiresAt = Date.now() + SHORT_DURATION;
    }
  }

  update(): void {
    const now = Date.now();
    const expired = this.bubbles.filter((b) => b.expiresAt > 0 && b.expiresAt <= now);
    for (const b of expired) {
      this.fadeOut(b);
    }
    this.bubbles = this.bubbles.filter((b) => !(b.expiresAt > 0 && b.expiresAt <= now));
  }

  private scheduleNextPage(entry: Bubble): void {
    entry.pageTimer = setTimeout(() => {
      if (!entry.pendingChunks || entry.pendingChunks.length === 0) {
        // Last page shown — set expiry
        entry.expiresAt = Date.now() + PAGE_DURATION;
        return;
      }
      const nextChunk = entry.pendingChunks.shift()!;
      const hasMore = entry.pendingChunks.length > 0;
      this.updateBubbleContent(entry.element, entry.agentId, nextChunk, hasMore);
      this.scheduleNextPage(entry);
    }, PAGE_DURATION);
  }

  private updateBubbleContent(el: HTMLDivElement, agentId: string, text: string, hasMore: boolean): void {
    // Clear existing content but keep tail elements (last 2 children)
    const tail = el.querySelector('.bubble-tail');
    const tailInner = el.querySelector('.bubble-tail-inner');

    // Remove all children
    while (el.firstChild) el.removeChild(el.firstChild);

    // Re-add content
    const nameSpan = document.createElement('span');
    nameSpan.style.color = '#7E57C2';
    nameSpan.textContent = agentId.slice(0, 10) + ': ';
    el.appendChild(nameSpan);
    el.appendChild(document.createTextNode(text + (hasMore ? ' ▸' : '')));

    // Re-add tail
    if (tail) el.appendChild(tail);
    if (tailInner) el.appendChild(tailInner);

    // Fade-in animation
    el.style.animation = 'none';
    void el.offsetHeight; // reflow
    el.style.animation = 'bubbleIn 0.15s ease-out';
  }

  private createBubbleElement(agentId: string, text: string, gridX: number, gridY: number, hasMore: boolean): HTMLDivElement {
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
      white-space: normal;
      word-wrap: break-word;
      max-width: ${MAX_WIDTH}px;
      box-shadow: 2px 2px 0px rgba(0,0,0,0.2);
      animation: bubbleIn 0.2s ease-out;
      transition: opacity 0.3s ease-out;
    `;

    const nameSpan = document.createElement('span');
    nameSpan.style.color = '#7E57C2';
    nameSpan.textContent = agentId.slice(0, 10) + ': ';
    el.appendChild(nameSpan);
    el.appendChild(document.createTextNode(text + (hasMore ? ' ▸' : '')));

    // Tail
    const tail = document.createElement('div');
    tail.className = 'bubble-tail';
    tail.style.cssText = `
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid #000;
    `;
    el.appendChild(tail);
    const tailInner = document.createElement('div');
    tailInner.className = 'bubble-tail-inner';
    tailInner.style.cssText = `
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid #fff;
    `;
    el.appendChild(tailInner);

    return el;
  }

  private splitIntoChunks(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      // Find last space within maxLen
      let splitAt = remaining.lastIndexOf(' ', maxLen);
      if (splitAt <= 0) splitAt = maxLen; // no space found, hard cut
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    return chunks;
  }

  private fadeOut(bubble: Bubble): void {
    bubble.element.style.opacity = '0';
    setTimeout(() => bubble.element.remove(), 300);
  }

  private removeBubble(agentId: string): void {
    const idx = this.bubbles.findIndex((b) => b.agentId === agentId);
    if (idx >= 0) {
      const b = this.bubbles[idx];
      if (b.pageTimer) clearTimeout(b.pageTimer);
      b.element.remove();
      this.bubbles.splice(idx, 1);
    }
  }
}
