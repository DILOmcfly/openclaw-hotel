/**
 * BadgeSystem.ts
 * HTML overlay renderer for agent achievement badges in room view.
 * Displays up to 3 badge icons next to agent names with hover tooltips.
 * Updates in real-time when agents earn new achievements via WebSocket.
 */

import { gridToScreen } from './IsoRenderer.js';

export interface BadgeData {
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: string;
}

interface AgentBadgeEntry {
  agentId: string;
  badges: BadgeData[];
  element: HTMLDivElement;
  gridX: number;
  gridY: number;
}

/** Maximum badges displayed per agent */
const MAX_VISIBLE_BADGES = 3;
/** Pixels above agent sprite to render badge row */
const BADGE_Y_OFFSET = 72;
/** Badge icon size in px */
const BADGE_SIZE = 16;
/** Tooltip delay in ms */
const TOOLTIP_DELAY = 200;

export class BadgeSystem {
  private agents: Map<string, AgentBadgeEntry> = new Map();
  private overlay: HTMLElement;
  private worldOffsetX: number;
  private worldOffsetY: number;
  /** Active tooltip element */
  private tooltip: HTMLDivElement;
  /** Tooltip hide timer */
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tooltip show timer */
  private tooltipShowTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(worldOffsetX: number, worldOffsetY: number) {
    this.worldOffsetX = worldOffsetX;
    this.worldOffsetY = worldOffsetY;

    // Create overlay container (above PixiJS canvas, pointer events enabled for tooltips)
    this.overlay = document.createElement('div');
    this.overlay.id = 'badge-overlay';
    this.overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:55;overflow:hidden;';
    document.body.appendChild(this.overlay);

    // Create shared tooltip element
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = `
      position: fixed;
      background: rgba(0,0,0,0.85);
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
      z-index: 200;
      max-width: 200px;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      line-height: 1.4;
    `;
    document.body.appendChild(this.tooltip);
  }

  /**
   * Update the world camera offset (call when camera pans/zooms)
   */
  updateOffset(x: number, y: number): void {
    this.worldOffsetX = x;
    this.worldOffsetY = y;
  }

  /**
   * Set badges for an agent. Creates or updates the badge row element.
   * @param agentId — Agent identifier
   * @param badges — Array of earned achievements (all; we take most recent 3)
   * @param gridX — Agent's current grid X
   * @param gridY — Agent's current grid Y
   */
  setAgentBadges(agentId: string, badges: BadgeData[], gridX: number, gridY: number): void {
    const existing = this.agents.get(agentId);

    if (existing) {
      existing.badges = badges;
      existing.gridX = gridX;
      existing.gridY = gridY;
      this.updateBadgeElement(existing);
      this.positionElement(existing.element, gridX, gridY);
    } else {
      const element = this.createBadgeElement(agentId, badges);
      this.positionElement(element, gridX, gridY);
      this.overlay.appendChild(element);

      const entry: AgentBadgeEntry = { agentId, badges, element, gridX, gridY };
      this.agents.set(agentId, entry);
    }
  }

  /**
   * Add a single new badge to an agent (real-time from WS event).
   */
  addBadge(agentId: string, badge: BadgeData): void {
    const entry = this.agents.get(agentId);
    if (!entry) {
      // Agent not currently visible — nothing to do
      return;
    }

    // Prepend (most recent first), avoid duplicates
    const alreadyHas = entry.badges.some((b) => b.achievementId === badge.achievementId);
    if (!alreadyHas) {
      entry.badges.unshift(badge);
    }

    this.updateBadgeElement(entry);
    // Brief flash animation
    this.flashNewBadge(entry.element);
  }

  /**
   * Update an agent's grid position (call when agent moves).
   */
  updatePosition(agentId: string, gridX: number, gridY: number): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;
    entry.gridX = gridX;
    entry.gridY = gridY;
    this.positionElement(entry.element, gridX, gridY);
  }

  /**
   * Remove an agent's badge display (call when agent leaves room).
   */
  removeAgent(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;
    entry.element.remove();
    this.agents.delete(agentId);
  }

  /**
   * Refresh all badge positions (call from animation loop when camera moves).
   */
  updateAllPositions(): void {
    for (const entry of this.agents.values()) {
      this.positionElement(entry.element, entry.gridX, entry.gridY);
    }
  }

  /**
   * Remove all agents (call on room exit / cleanup).
   */
  clear(): void {
    for (const entry of this.agents.values()) {
      entry.element.remove();
    }
    this.agents.clear();
    this.hideTooltip();
  }

  /**
   * Destroy the system and remove DOM elements.
   */
  destroy(): void {
    this.clear();
    this.overlay.remove();
    this.tooltip.remove();
    if (this.tooltipTimer) clearTimeout(this.tooltipTimer);
    if (this.tooltipShowTimer) clearTimeout(this.tooltipShowTimer);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private createBadgeElement(agentId: string, badges: BadgeData[]): HTMLDivElement {
    const row = document.createElement('div');
    row.dataset.agentId = agentId;
    row.style.cssText = `
      position: absolute;
      display: flex;
      gap: 2px;
      align-items: center;
      transform: translateX(-50%);
      pointer-events: auto;
    `;
    this.renderBadgeIcons(row, badges);
    return row;
  }

  private updateBadgeElement(entry: AgentBadgeEntry): void {
    // Clear current icons
    while (entry.element.firstChild) {
      entry.element.removeChild(entry.element.firstChild);
    }
    this.renderBadgeIcons(entry.element, entry.badges);
  }

  private renderBadgeIcons(container: HTMLDivElement, badges: BadgeData[]): void {
    // Take up to MAX_VISIBLE_BADGES most recent badges
    const visible = badges.slice(0, MAX_VISIBLE_BADGES);

    if (visible.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';

    for (const badge of visible) {
      const iconEl = document.createElement('span');
      iconEl.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: ${BADGE_SIZE}px;
        height: ${BADGE_SIZE}px;
        background: rgba(0,0,0,0.6);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 4px;
        font-size: 11px;
        cursor: help;
        transition: transform 0.15s ease;
        user-select: none;
      `;
      // XSS-safe: use textContent for icon (emoji)
      iconEl.textContent = badge.icon;

      // Tooltip on hover
      iconEl.addEventListener('mouseenter', (e: MouseEvent) => {
        this.scheduleTooltip(badge, e.clientX, e.clientY);
        iconEl.style.transform = 'scale(1.3)';
      });
      iconEl.addEventListener('mousemove', (e: MouseEvent) => {
        this.moveTooltip(e.clientX, e.clientY);
      });
      iconEl.addEventListener('mouseleave', () => {
        this.scheduleHideTooltip();
        iconEl.style.transform = 'scale(1)';
      });

      container.appendChild(iconEl);
    }

    // If agent has more badges than visible, show "+N" indicator
    const extraCount = badges.length - MAX_VISIBLE_BADGES;
    if (extraCount > 0) {
      const moreEl = document.createElement('span');
      moreEl.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: ${BADGE_SIZE}px;
        height: ${BADGE_SIZE}px;
        background: rgba(255,255,255,0.15);
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 4px;
        font-size: 9px;
        font-family: monospace;
        color: #fff;
        cursor: help;
      `;
      moreEl.textContent = `+${extraCount}`;
      moreEl.title = `${extraCount} more achievement${extraCount > 1 ? 's' : ''}`;
      container.appendChild(moreEl);
    }
  }

  private positionElement(el: HTMLDivElement, gridX: number, gridY: number): void {
    const { x, y } = gridToScreen(gridX, gridY);
    const screenX = x + this.worldOffsetX;
    const screenY = y + this.worldOffsetY - BADGE_Y_OFFSET;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
  }

  /** Flash animation when a new badge is received */
  private flashNewBadge(el: HTMLDivElement): void {
    el.style.transition = 'none';
    el.style.filter = 'brightness(2)';
    requestAnimationFrame(() => {
      el.style.transition = 'filter 0.6s ease-out';
      el.style.filter = 'brightness(1)';
    });
  }

  // ─── Tooltip management ───────────────────────────────────────────────────

  private scheduleTooltip(badge: BadgeData, clientX: number, clientY: number): void {
    if (this.tooltipShowTimer) clearTimeout(this.tooltipShowTimer);
    this.tooltipShowTimer = setTimeout(() => {
      this.showTooltip(badge, clientX, clientY);
    }, TOOLTIP_DELAY);
  }

  private showTooltip(badge: BadgeData, clientX: number, clientY: number): void {
    // Build content safely
    const nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'font-weight:bold;color:#ffd700;margin-bottom:2px;';
    nameDiv.textContent = `${badge.icon} ${badge.name}`;

    const descDiv = document.createElement('div');
    descDiv.style.cssText = 'color:#ccc;font-size:11px;';
    descDiv.textContent = badge.description;

    // Clear and repopulate
    while (this.tooltip.firstChild) this.tooltip.removeChild(this.tooltip.firstChild);
    this.tooltip.appendChild(nameDiv);
    this.tooltip.appendChild(descDiv);

    this.tooltip.style.display = 'block';
    this.moveTooltip(clientX, clientY);
  }

  private moveTooltip(clientX: number, clientY: number): void {
    const w = this.tooltip.offsetWidth || 160;
    const h = this.tooltip.offsetHeight || 50;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = clientX + 12;
    let top = clientY - h / 2;

    // Keep within viewport
    if (left + w > vw - 8) left = clientX - w - 12;
    if (top < 8) top = 8;
    if (top + h > vh - 8) top = vh - h - 8;

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  private scheduleHideTooltip(): void {
    if (this.tooltipShowTimer) {
      clearTimeout(this.tooltipShowTimer);
      this.tooltipShowTimer = null;
    }
    this.tooltipTimer = setTimeout(() => this.hideTooltip(), 150);
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }

  // ─── Public getters (for testing) ─────────────────────────────────────────

  getAgentBadges(agentId: string): BadgeData[] {
    return this.agents.get(agentId)?.badges ?? [];
  }

  getAgentCount(): number {
    return this.agents.size;
  }

  isVisible(agentId: string): boolean {
    const entry = this.agents.get(agentId);
    return entry ? entry.element.style.display !== 'none' : false;
  }
}
