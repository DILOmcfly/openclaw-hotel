type EventHandler = (...args: any[]) => void;

/**
 * Simple reactive event bus for cross-component communication
 * Enables automatic UI updates without manual refresh calls
 */
export class EventBus {
  private listeners: Map<string, Set<EventHandler>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event with optional arguments
   */
  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[EventBus] Error in handler for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Subscribe to an event, but automatically unsubscribe after first trigger
   */
  once(event: string, handler: EventHandler): void {
    const onceWrapper = (...args: any[]) => {
      handler(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  /**
   * Remove all listeners for a specific event, or all events if no event specified
   */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Event type constants
export const Events = {
  INVENTORY_UPDATE: 'inventory.update',
  FRIENDS_UPDATE: 'friends.update',
  BALANCE_UPDATE: 'balance.update',
  NOTIFICATIONS_NEW: 'notifications.new',
  ROOM_JOINED: 'room.joined',
  ROOM_LEFT: 'room.left',
  AVATAR_UPDATE: 'avatar.update',
  TRADE_COMPLETE: 'trade.complete',
} as const;

// Singleton instance
export const eventBus = new EventBus();
