/**
 * HeatmapOverlay.ts
 * T-364 — Room Activity Heatmap Overlay (Client)
 *
 * Renders semi-transparent colored diamond tiles over the isometric room grid.
 * Toggle show/hide. Auto-updates every 10 seconds.
 *
 * Depends on PixiJS v8 (Graphics API) and IsoRenderer tile constants.
 */

import { Container, Graphics } from 'pixi.js';
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from '../renderer/IsoRenderer.js';

// Re-export pure helpers so callers can import from one place
export { normalizeIntensity, activityToColor, parseRgba } from './heatmapHelpers.js';
import { activityToColor, parseRgba } from './heatmapHelpers.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeatmapCellData {
  tileX: number;
  tileY: number;
  intensity: number; // 0–1
  color?: string;    // Optional pre-computed rgba; computed from intensity if absent
}

export interface HeatmapOverlayOptions {
  /** Parent container to attach overlay to (typically the world/floor layer) */
  parent: Container;
  /** Update interval in ms (default: 10000) */
  updateIntervalMs?: number;
  /** Callback invoked on each interval tick to fetch fresh heatmap data */
  onUpdate?: () => Promise<HeatmapCellData[]> | HeatmapCellData[];
}

// ─── HeatmapOverlay ───────────────────────────────────────────────────────────

export class HeatmapOverlay {
  private readonly container: Container;
  private visible: boolean = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly updateIntervalMs: number;
  private readonly onUpdate?: HeatmapOverlayOptions['onUpdate'];

  constructor(options: HeatmapOverlayOptions) {
    this.updateIntervalMs = options.updateIntervalMs ?? 10_000;
    this.onUpdate = options.onUpdate;

    this.container = new Container();
    this.container.visible = false;
    this.container.label = 'heatmap-overlay';
    options.parent.addChild(this.container);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Returns whether the overlay is currently visible. */
  get isVisible(): boolean {
    return this.visible;
  }

  /**
   * Show the heatmap overlay and start auto-refresh.
   * Immediately renders if data is provided or onUpdate is set.
   */
  async show(initialData?: HeatmapCellData[]): Promise<void> {
    this.visible = true;
    this.container.visible = true;

    if (initialData) {
      this.render(initialData);
    } else if (this.onUpdate) {
      const data = await this.onUpdate();
      this.render(data);
    }

    this.startAutoUpdate();
  }

  /**
   * Hide the heatmap overlay and stop auto-refresh.
   */
  hide(): void {
    this.visible = false;
    this.container.visible = false;
    this.stopAutoUpdate();
  }

  /**
   * Toggle visibility. Returns the new visibility state.
   */
  async toggle(): Promise<boolean> {
    if (this.visible) {
      this.hide();
    } else {
      await this.show();
    }
    return this.visible;
  }

  /**
   * Manually update the overlay with new cell data.
   */
  update(cells: HeatmapCellData[]): void {
    this.render(cells);
  }

  /**
   * Destroy the overlay and clean up resources.
   */
  destroy(): void {
    this.stopAutoUpdate();
    this.container.destroy({ children: true });
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private render(cells: HeatmapCellData[]): void {
    // Clear previous graphics
    this.container.removeChildren();

    for (const cell of cells) {
      const { tileX, tileY, intensity } = cell;
      const rgba = cell.color ?? activityToColor(intensity);
      const [hexColor, alpha] = parseRgba(rgba);

      const { x, y } = gridToScreen(tileX, tileY);

      const g = new Graphics();

      // Draw isometric diamond matching the tile shape
      g.moveTo(0, -TILE_HEIGHT / 2);
      g.lineTo(TILE_WIDTH / 2, 0);
      g.lineTo(0, TILE_HEIGHT / 2);
      g.lineTo(-TILE_WIDTH / 2, 0);
      g.closePath();
      g.fill({ color: hexColor, alpha });

      g.position.set(x, y);
      g.zIndex = tileX + tileY + 0.001; // just above floor
      this.container.addChild(g);
    }

    this.container.sortableChildren = true;
  }

  private startAutoUpdate(): void {
    this.stopAutoUpdate();
    if (!this.onUpdate) return;

    this.intervalHandle = setInterval(async () => {
      if (!this.visible) return;
      try {
        const data = await this.onUpdate!();
        this.render(data);
      } catch (err) {
        console.warn('[HeatmapOverlay] update failed:', err);
      }
    }, this.updateIntervalMs);
  }

  private stopAutoUpdate(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}
