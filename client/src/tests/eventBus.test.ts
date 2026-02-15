import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, Events } from '../utils/EventBus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should subscribe and emit events', () => {
    const handler = vi.fn();
    bus.on('test.event', handler);
    bus.emit('test.event', 'hello', 42);
    
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('hello', 42);
  });

  it('should support multiple listeners for the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.on('test.event', handler1);
    bus.on('test.event', handler2);
    bus.on('test.event', handler3);

    bus.emit('test.event', 'data');

    expect(handler1).toHaveBeenCalledWith('data');
    expect(handler2).toHaveBeenCalledWith('data');
    expect(handler3).toHaveBeenCalledWith('data');
  });

  it('should unsubscribe listeners with off()', () => {
    const handler = vi.fn();
    bus.on('test.event', handler);
    bus.off('test.event', handler);
    bus.emit('test.event');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle once() correctly - call only once then auto-unsubscribe', () => {
    const handler = vi.fn();
    bus.once('test.event', handler);

    bus.emit('test.event', 1);
    bus.emit('test.event', 2);
    bus.emit('test.event', 3);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('should pass multiple arguments to handlers', () => {
    const handler = vi.fn();
    bus.on('test.event', handler);
    bus.emit('test.event', 'arg1', 'arg2', 'arg3', { key: 'value' });

    expect(handler).toHaveBeenCalledWith('arg1', 'arg2', 'arg3', { key: 'value' });
  });

  it('should not trigger handlers for different events (no cross-talk)', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('event.a', handler1);
    bus.on('event.b', handler2);

    bus.emit('event.a', 'dataA');

    expect(handler1).toHaveBeenCalledWith('dataA');
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should remove all listeners for a specific event with removeAll(event)', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on('test.event', handler1);
    bus.on('test.event', handler2);
    bus.removeAll('test.event');
    bus.emit('test.event');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should remove all listeners for all events with removeAll()', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.on('event.a', handler1);
    bus.on('event.b', handler2);
    bus.on('event.c', handler3);

    bus.removeAll();

    bus.emit('event.a');
    bus.emit('event.b');
    bus.emit('event.c');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
    expect(handler3).not.toHaveBeenCalled();
  });

  it('should handle emitting events with no listeners gracefully', () => {
    expect(() => {
      bus.emit('nonexistent.event', 'data');
    }).not.toThrow();
  });

  it('should catch and log errors in event handlers without breaking other handlers', () => {
    const errorHandler = vi.fn(() => {
      throw new Error('Handler error');
    });
    const normalHandler = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    bus.on('test.event', errorHandler);
    bus.on('test.event', normalHandler);

    bus.emit('test.event', 'data');

    expect(errorHandler).toHaveBeenCalled();
    expect(normalHandler).toHaveBeenCalledWith('data');
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should allow same handler to be added multiple times (idempotent)', () => {
    const handler = vi.fn();
    
    bus.on('test.event', handler);
    bus.on('test.event', handler); // Should not add duplicate

    bus.emit('test.event');

    // Set behavior means no duplicates
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support event constants from Events object', () => {
    const handler = vi.fn();
    bus.on(Events.INVENTORY_UPDATE, handler);
    bus.emit(Events.INVENTORY_UPDATE, { items: [] });

    expect(handler).toHaveBeenCalledWith({ items: [] });
  });

  it('should clean up empty event sets after off()', () => {
    const handler = vi.fn();
    bus.on('test.event', handler);
    bus.off('test.event', handler);

    // Internal check: listeners map should not have the event key anymore
    expect((bus as any).listeners.has('test.event')).toBe(false);
  });

  it('should handle rapid successive emissions correctly', () => {
    const handler = vi.fn();
    bus.on('test.event', handler);

    for (let i = 0; i < 100; i++) {
      bus.emit('test.event', i);
    }

    expect(handler).toHaveBeenCalledTimes(100);
  });
});
