/**
 * Simple memory profiler to detect leaks in sprites and event listeners
 * Tracks created vs destroyed resources and warns on potential leaks
 */

export interface ResourceStats {
  created: number;
  destroyed: number;
  current: number;
}

export class MemoryProfiler {
  private sprites: ResourceStats = { created: 0, destroyed: 0, current: 0 };
  private containers: ResourceStats = { created: 0, destroyed: 0, current: 0 };
  private listeners: Map<string, number> = new Map();
  private enabled: boolean = true;

  /**
   * Track sprite creation
   */
  public trackSpriteCreate(): void {
    if (!this.enabled) return;
    this.sprites.created++;
    this.sprites.current++;
  }

  /**
   * Track sprite destruction
   */
  public trackSpriteDestroy(): void {
    if (!this.enabled) return;
    this.sprites.destroyed++;
    this.sprites.current = Math.max(0, this.sprites.current - 1);
  }

  /**
   * Track container creation
   */
  public trackContainerCreate(): void {
    if (!this.enabled) return;
    this.containers.created++;
    this.containers.current++;
  }

  /**
   * Track container destruction
   */
  public trackContainerDestroy(): void {
    if (!this.enabled) return;
    this.containers.destroyed++;
    this.containers.current = Math.max(0, this.containers.current - 1);
  }

  /**
   * Track event listener addition
   */
  public trackListenerAdd(eventName: string): void {
    if (!this.enabled) return;
    const count = this.listeners.get(eventName) ?? 0;
    this.listeners.set(eventName, count + 1);
  }

  /**
   * Track event listener removal
   */
  public trackListenerRemove(eventName: string): void {
    if (!this.enabled) return;
    const count = this.listeners.get(eventName) ?? 0;
    this.listeners.set(eventName, Math.max(0, count - 1));
  }

  /**
   * Get current memory stats
   */
  public getStats() {
    return {
      sprites: { ...this.sprites },
      containers: { ...this.containers },
      listeners: Object.fromEntries(this.listeners),
      totalCurrent: this.sprites.current + this.containers.current,
    };
  }

  /**
   * Check for potential leaks and log warnings
   * Call this periodically (e.g., every 30 seconds)
   */
  public checkLeaks(): void {
    if (!this.enabled) return;

    const stats = this.getStats();
    const leakThreshold = 100; // Warn if current count exceeds threshold

    // Check sprite leaks
    if (stats.sprites.current > leakThreshold) {
      console.warn(
        `[MemoryProfiler] Potential sprite leak detected: ${stats.sprites.current} sprites active ` +
        `(created: ${stats.sprites.created}, destroyed: ${stats.sprites.destroyed})`
      );
    }

    // Check container leaks
    if (stats.containers.current > leakThreshold) {
      console.warn(
        `[MemoryProfiler] Potential container leak detected: ${stats.containers.current} containers active ` +
        `(created: ${stats.containers.created}, destroyed: ${stats.containers.destroyed})`
      );
    }

    // Check event listener leaks
    for (const [eventName, count] of this.listeners.entries()) {
      if (count > leakThreshold / 2) {
        console.warn(
          `[MemoryProfiler] Potential event listener leak detected: ${count} listeners for "${eventName}"`
        );
      }
    }
  }

  /**
   * Log current stats to console
   */
  public logStats(): void {
    if (!this.enabled) return;
    console.log('[MemoryProfiler] Current stats:', this.getStats());
  }

  /**
   * Reset all counters
   */
  public reset(): void {
    this.sprites = { created: 0, destroyed: 0, current: 0 };
    this.containers = { created: 0, destroyed: 0, current: 0 };
    this.listeners.clear();
  }

  /**
   * Cleanup resources for room exit
   * Warns if resources haven't been properly cleaned up
   */
  public cleanup(): void {
    const stats = this.getStats();
    
    if (stats.sprites.current > 0) {
      console.warn(
        `[MemoryProfiler] Cleanup called with ${stats.sprites.current} sprites still active. ` +
        `Potential memory leak!`
      );
    }

    if (stats.containers.current > 0) {
      console.warn(
        `[MemoryProfiler] Cleanup called with ${stats.containers.current} containers still active. ` +
        `Potential memory leak!`
      );
    }

    const totalListeners = Array.from(this.listeners.values()).reduce((sum, count) => sum + count, 0);
    if (totalListeners > 0) {
      console.warn(
        `[MemoryProfiler] Cleanup called with ${totalListeners} event listeners still active. ` +
        `Potential memory leak!`
      );
    }

    this.reset();
  }

  /**
   * Enable/disable profiling
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Global singleton instance
export const memoryProfiler = new MemoryProfiler();
