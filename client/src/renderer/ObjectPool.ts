/**
 * Generic object pool for reducing garbage collection pressure
 * Reuses objects instead of creating/destroying them repeatedly
 */

export type Factory<T> = () => T;
export type Resetter<T> = (obj: T) => void;
export type Destroyer<T> = (obj: T) => void;

export interface PoolConfig<T> {
  factory: Factory<T>;
  reset?: Resetter<T>;
  destroy?: Destroyer<T>;
  maxSize?: number;
  preAllocate?: number;
}

export class ObjectPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: Factory<T>;
  private reset?: Resetter<T>;
  private destroy?: Destroyer<T>;
  private maxSize: number;

  constructor(config: PoolConfig<T>) {
    this.factory = config.factory;
    this.reset = config.reset;
    this.destroy = config.destroy;
    this.maxSize = config.maxSize ?? 100;

    // Pre-allocate objects if specified
    const preAllocate = config.preAllocate ?? 0;
    for (let i = 0; i < preAllocate; i++) {
      this.available.push(this.factory());
    }
  }

  /**
   * Acquire an object from the pool
   * Creates a new one if pool is empty
   */
  public acquire(): T {
    let obj: T;

    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Release an object back to the pool
   * Calls reset function if provided
   */
  public release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('[ObjectPool] Attempted to release object not in use');
      return;
    }

    this.inUse.delete(obj);

    // Reset object state
    if (this.reset) {
      this.reset(obj);
    }

    // Add back to pool if not at max size
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    } else {
      // Destroy excess objects
      if (this.destroy) {
        this.destroy(obj);
      }
    }
  }

  /**
   * Release all objects currently in use
   * Useful for cleanup when leaving a scene/room
   */
  public releaseAll(): void {
    const objectsInUse = Array.from(this.inUse);
    for (const obj of objectsInUse) {
      this.release(obj);
    }
  }

  /**
   * Clear the entire pool and destroy all objects
   */
  public clear(): void {
    // Release all in-use objects first
    this.releaseAll();

    // Destroy available objects
    if (this.destroy) {
      for (const obj of this.available) {
        this.destroy(obj);
      }
    }

    this.available = [];
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize,
    };
  }
}
