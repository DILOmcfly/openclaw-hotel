/**
 * T-342: Keyboard Navigation — Unit Tests
 * Tests for:
 * - PAN_STEP / ZOOM_STEP constants (valid ranges)
 * - Pan logic: arrow keys adjust panX/panY correctly
 * - Zoom logic: +/- clamps to [ZOOM_MIN, ZOOM_MAX]
 * - Reset logic: 0 key returns to (1.0, 0, 0)
 * - Guard: input fields are ignored (no panning while typing)
 * - Room selection: number keys 1-9 pick room by index
 * - Escape: only triggers leaveRoom when inside a room
 *
 * Pure unit tests — mirrors client/js/spectate.js logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Constants (mirror spectate.js) ───────────────────────────────────────────
const PAN_STEP = 40;
const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.0;

// ─── State simulator ──────────────────────────────────────────────────────────
function createState() {
  return {
    panX: 0,
    panY: 0,
    currentZoom: 1.0,
    currentRoomId: null as string | null,
    roomsList: [] as Array<{ id: string; name: string }>,
  };
}

/** Simulates the keydown handler logic */
function simulateKeydown(
  key: string,
  state: ReturnType<typeof createState>,
  target: 'body' | 'input' = 'body',
): { panX: number; panY: number; zoom: number; leaveRoomCalled: boolean; enterRoomCalled: string | null } {
  let leaveRoomCalled = false;
  let enterRoomCalled: string | null = null;

  // Guard: ignore key presses in input/textarea
  if (target === 'input') {
    return { panX: state.panX, panY: state.panY, zoom: state.currentZoom, leaveRoomCalled, enterRoomCalled };
  }

  const hasApp = true; // simulated: app is running
  const hasRoom = state.currentRoomId !== null;

  switch (key) {
    case 'ArrowLeft':
      if (hasApp) state.panX += PAN_STEP;
      break;
    case 'ArrowRight':
      if (hasApp) state.panX -= PAN_STEP;
      break;
    case 'ArrowUp':
      if (hasApp) state.panY += PAN_STEP;
      break;
    case 'ArrowDown':
      if (hasApp) state.panY -= PAN_STEP;
      break;
    case '+':
    case '=':
      if (hasApp) state.currentZoom = Math.min(ZOOM_MAX, state.currentZoom + ZOOM_STEP);
      break;
    case '-':
      if (hasApp) state.currentZoom = Math.max(ZOOM_MIN, state.currentZoom - ZOOM_STEP);
      break;
    case '0':
      if (hasApp) { state.currentZoom = 1.0; state.panX = 0; state.panY = 0; }
      break;
    case 'Escape':
      if (hasRoom) leaveRoomCalled = true;
      break;
    default:
      if (key >= '1' && key <= '9' && !hasRoom) {
        const idx = parseInt(key, 10) - 1;
        if (state.roomsList[idx]) {
          enterRoomCalled = state.roomsList[idx].id;
        }
      }
  }

  return { panX: state.panX, panY: state.panY, zoom: state.currentZoom, leaveRoomCalled, enterRoomCalled };
}

// ─── Constants tests ──────────────────────────────────────────────────────────
describe('Keyboard nav constants', () => {
  it('PAN_STEP is a positive number', () => expect(PAN_STEP).toBeGreaterThan(0));
  it('ZOOM_STEP is between 0 and 1', () => {
    expect(ZOOM_STEP).toBeGreaterThan(0);
    expect(ZOOM_STEP).toBeLessThan(1);
  });
  it('ZOOM_MIN < 1 (allows zoom out)', () => expect(ZOOM_MIN).toBeLessThan(1));
  it('ZOOM_MAX > 1 (allows zoom in)', () => expect(ZOOM_MAX).toBeGreaterThan(1));
  it('ZOOM_MIN > 0 (never negative)', () => expect(ZOOM_MIN).toBeGreaterThan(0));
});

// ─── Pan tests ────────────────────────────────────────────────────────────────
describe('Arrow key panning', () => {
  let state: ReturnType<typeof createState>;
  beforeEach(() => { state = createState(); });

  it('ArrowLeft increases panX by PAN_STEP', () => {
    simulateKeydown('ArrowLeft', state);
    expect(state.panX).toBe(PAN_STEP);
  });

  it('ArrowRight decreases panX by PAN_STEP', () => {
    simulateKeydown('ArrowRight', state);
    expect(state.panX).toBe(-PAN_STEP);
  });

  it('ArrowUp increases panY by PAN_STEP', () => {
    simulateKeydown('ArrowUp', state);
    expect(state.panY).toBe(PAN_STEP);
  });

  it('ArrowDown decreases panY by PAN_STEP', () => {
    simulateKeydown('ArrowDown', state);
    expect(state.panY).toBe(-PAN_STEP);
  });

  it('multiple presses accumulate', () => {
    simulateKeydown('ArrowLeft', state);
    simulateKeydown('ArrowLeft', state);
    expect(state.panX).toBe(PAN_STEP * 2);
  });

  it('left then right cancels out', () => {
    simulateKeydown('ArrowLeft', state);
    simulateKeydown('ArrowRight', state);
    expect(state.panX).toBe(0);
  });
});

// ─── Zoom tests ───────────────────────────────────────────────────────────────
describe('Zoom keys', () => {
  let state: ReturnType<typeof createState>;
  beforeEach(() => { state = createState(); });

  it('+ key increases zoom by ZOOM_STEP', () => {
    simulateKeydown('+', state);
    expect(state.currentZoom).toBeCloseTo(1.0 + ZOOM_STEP, 5);
  });

  it('= key (alias) also increases zoom', () => {
    simulateKeydown('=', state);
    expect(state.currentZoom).toBeCloseTo(1.0 + ZOOM_STEP, 5);
  });

  it('- key decreases zoom by ZOOM_STEP', () => {
    simulateKeydown('-', state);
    expect(state.currentZoom).toBeCloseTo(1.0 - ZOOM_STEP, 5);
  });

  it('zoom is capped at ZOOM_MAX', () => {
    for (let i = 0; i < 50; i++) simulateKeydown('+', state);
    expect(state.currentZoom).toBeLessThanOrEqual(ZOOM_MAX);
    expect(state.currentZoom).toBe(ZOOM_MAX);
  });

  it('zoom is capped at ZOOM_MIN', () => {
    for (let i = 0; i < 50; i++) simulateKeydown('-', state);
    expect(state.currentZoom).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(state.currentZoom).toBe(ZOOM_MIN);
  });
});

// ─── Reset tests ──────────────────────────────────────────────────────────────
describe('0 key reset', () => {
  let state: ReturnType<typeof createState>;
  beforeEach(() => { state = createState(); state.panX = 200; state.panY = -150; state.currentZoom = 2.5; });

  it('resets panX to 0', () => { simulateKeydown('0', state); expect(state.panX).toBe(0); });
  it('resets panY to 0', () => { simulateKeydown('0', state); expect(state.panY).toBe(0); });
  it('resets zoom to 1.0', () => { simulateKeydown('0', state); expect(state.currentZoom).toBe(1.0); });
});

// ─── Input guard tests ────────────────────────────────────────────────────────
describe('Input field guard', () => {
  it('does not pan when target is input', () => {
    const state = createState();
    simulateKeydown('ArrowLeft', state, 'input');
    expect(state.panX).toBe(0); // unchanged
  });

  it('does not zoom when target is input', () => {
    const state = createState();
    simulateKeydown('+', state, 'input');
    expect(state.currentZoom).toBe(1.0); // unchanged
  });
});

// ─── Escape key tests ─────────────────────────────────────────────────────────
describe('Escape key', () => {
  it('calls leaveRoom when inside a room', () => {
    const state = createState();
    state.currentRoomId = 'room-1';
    const result = simulateKeydown('Escape', state);
    expect(result.leaveRoomCalled).toBe(true);
  });

  it('does NOT call leaveRoom when not in a room', () => {
    const state = createState();
    state.currentRoomId = null;
    const result = simulateKeydown('Escape', state);
    expect(result.leaveRoomCalled).toBe(false);
  });
});

// ─── Room selection (1-9 keys) ────────────────────────────────────────────────
describe('Number keys for room selection', () => {
  it('1 key enters first room', () => {
    const state = createState();
    state.roomsList = [{ id: 'r1', name: 'Lobby' }, { id: 'r2', name: 'Garden' }];
    const result = simulateKeydown('1', state);
    expect(result.enterRoomCalled).toBe('r1');
  });

  it('2 key enters second room', () => {
    const state = createState();
    state.roomsList = [{ id: 'r1', name: 'Lobby' }, { id: 'r2', name: 'Garden' }];
    const result = simulateKeydown('2', state);
    expect(result.enterRoomCalled).toBe('r2');
  });

  it('key index out of bounds → no action', () => {
    const state = createState();
    state.roomsList = [{ id: 'r1', name: 'Lobby' }];
    const result = simulateKeydown('5', state);
    expect(result.enterRoomCalled).toBeNull();
  });

  it('does NOT enter room if already in a room', () => {
    const state = createState();
    state.currentRoomId = 'room-x';
    state.roomsList = [{ id: 'r1', name: 'Lobby' }];
    const result = simulateKeydown('1', state);
    expect(result.enterRoomCalled).toBeNull(); // guard: only when not in room
  });

  it('non-numeric keys do nothing for room selection', () => {
    const state = createState();
    state.roomsList = [{ id: 'r1', name: 'Lobby' }];
    const result = simulateKeydown('a', state);
    expect(result.enterRoomCalled).toBeNull();
  });
});
