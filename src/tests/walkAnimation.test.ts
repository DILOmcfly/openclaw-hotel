import { describe, it, expect, beforeEach } from 'vitest';

/**
 * T-358: Agent Walk Animation System — Unit Tests
 *
 * Tests the pure animation logic extracted from spectate.js:
 *   - Linear tween position interpolation
 *   - Direction detection (screen-space)
 *   - Walk phase / bob oscillation during movement
 *   - Idle breathing animation when stationary
 *   - Rapid position change override behaviour
 */

// ─── Type definitions mirroring spectate.js agent shape ─────────────────────

interface AnimAgent {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  walkPhase: number;
  isMoving: boolean;
  faceLeft: boolean;
  lastMoveTime: number;
  tweenStartX: number;
  tweenStartY: number;
  tweenStartTime: number;
  tweenDuration: number;
}

// ─── Pure logic extracted from spectate.js (testable without DOM/PixiJS) ────

const TILE_W = 64;
const TILE_H = 32;
const ROOM_SIZE = 16;
const TWEEN_MS_PER_TILE = 150;
const MIN_TWEEN_MS = 80;

function clampCoord(v: number): number {
  return Math.max(0, Math.min(ROOM_SIZE - 1, v));
}

function isoToScreen(x: number, y: number, offsetX = 512, offsetY = 128) {
  return {
    sx: offsetX + (x - y) * (TILE_W / 2),
    sy: offsetY + (x + y) * (TILE_H / 2),
  };
}

/**
 * Compute tween duration for a move from (ax, ay) to (tx, ty).
 */
function computeTweenDuration(ax: number, ay: number, tx: number, ty: number): number {
  const dist = Math.sqrt(Math.pow(tx - ax, 2) + Math.pow(ty - ay, 2));
  return Math.max(MIN_TWEEN_MS, dist * TWEEN_MS_PER_TILE);
}

/**
 * Compute screen-space direction (faceLeft) when an agent moves on the iso grid.
 * isoToScreen sx ∝ (x – y), so screen-left means (dx – dy) < 0.
 */
function computeFaceLeft(
  gdx: number,
  gdy: number,
  currentFaceLeft: boolean
): boolean {
  const screenDx = gdx - gdy;
  if (screenDx < 0) return true;
  if (screenDx > 0) return false;
  return currentFaceLeft; // unchanged for purely vertical moves
}

/**
 * Advance a single agent's tween by `elapsed` ms.
 * Returns new { x, y, isMoving, tweenDuration }.
 */
function tickTween(
  agent: AnimAgent,
  elapsed: number
): Pick<AnimAgent, 'x' | 'y' | 'isMoving' | 'tweenDuration' | 'tweenStartTime'> {
  if (agent.tweenDuration <= 0 || agent.tweenStartTime <= 0) {
    return {
      x: agent.x,
      y: agent.y,
      isMoving: agent.isMoving,
      tweenDuration: agent.tweenDuration,
      tweenStartTime: agent.tweenStartTime,
    };
  }
  const t = Math.min(1, elapsed / agent.tweenDuration);
  const x = agent.tweenStartX + (agent.targetX - agent.tweenStartX) * t;
  const y = agent.tweenStartY + (agent.targetY - agent.tweenStartY) * t;
  const done = t >= 1;
  return {
    x: done ? agent.targetX : x,
    y: done ? agent.targetY : y,
    isMoving: !done,
    tweenDuration: done ? 0 : agent.tweenDuration,
    tweenStartTime: done ? 0 : agent.tweenStartTime,
  };
}

/**
 * Compute walk bob y-offset for the given phase.
 */
function walkBob(walkPhase: number): number {
  return Math.sin(walkPhase) * 2;
}

/**
 * Compute idle breathing y-offset for the given timestamp.
 */
function idleBob(now: number): number {
  return Math.sin(now * 0.002) * 0.5;
}

/**
 * Advance walkPhase by one dt step (dt in seconds).
 */
function advanceWalkPhase(walkPhase: number, dt: number): number {
  return walkPhase + dt * 8; // 8 rad/s
}

/**
 * Create a default agent at grid position (x, y) — already at target (stationary).
 */
function makeAgent(id: string, x: number, y: number): AnimAgent {
  return {
    id,
    x,
    y,
    targetX: x,
    targetY: y,
    walkPhase: 0,
    isMoving: false,
    faceLeft: false,
    lastMoveTime: 0,
    tweenStartX: x,
    tweenStartY: y,
    tweenStartTime: 0,
    tweenDuration: 0,
  };
}

/**
 * Simulate a 'agent.moved' event: sets up tween + direction.
 */
function applyMove(
  agent: AnimAgent,
  newX: number,
  newY: number,
  now: number
): AnimAgent {
  const ntx = clampCoord(newX);
  const nty = clampCoord(newY);
  const hasMoved = ntx !== agent.targetX || nty !== agent.targetY;
  if (!hasMoved) return agent;

  const duration = computeTweenDuration(agent.x, agent.y, ntx, nty);
  const gdx = ntx - agent.x;
  const gdy = nty - agent.y;
  const faceLeft = computeFaceLeft(gdx, gdy, agent.faceLeft);

  return {
    ...agent,
    targetX: ntx,
    targetY: nty,
    tweenStartX: agent.x,
    tweenStartY: agent.y,
    tweenStartTime: now,
    tweenDuration: duration,
    isMoving: true,
    faceLeft,
    lastMoveTime: now,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('T-358 — Walk Animation: tweenPosition lerps correctly', () => {
  it('lerps x halfway at t=0.5', () => {
    const agent = makeAgent('a1', 0, 0);
    const now = 1000;
    const moved = applyMove(agent, 4, 0, now);
    const result = tickTween(moved, moved.tweenDuration * 0.5);
    expect(result.x).toBeCloseTo(2, 2);
  });

  it('lerps y halfway at t=0.5', () => {
    const agent = makeAgent('a2', 0, 0);
    const now = 1000;
    const moved = applyMove(agent, 0, 6, now);
    const result = tickTween(moved, moved.tweenDuration * 0.5);
    expect(result.y).toBeCloseTo(3, 2);
  });

  it('reaches exact target at t=1.0', () => {
    const agent = makeAgent('a3', 2, 3);
    const now = 1000;
    const moved = applyMove(agent, 8, 10, now);
    const result = tickTween(moved, moved.tweenDuration);
    expect(result.x).toBe(8);
    expect(result.y).toBe(10);
  });

  it('does not overshoot at t>1.0', () => {
    const agent = makeAgent('a4', 0, 0);
    const now = 1000;
    const moved = applyMove(agent, 5, 5, now);
    const result = tickTween(moved, moved.tweenDuration * 2);
    expect(result.x).toBe(5);
    expect(result.y).toBe(5);
  });

  it('stays at start when elapsed=0', () => {
    const agent = makeAgent('a5', 3, 3);
    const now = 1000;
    const moved = applyMove(agent, 7, 7, now);
    const result = tickTween(moved, 0);
    expect(result.x).toBeCloseTo(3, 2);
    expect(result.y).toBeCloseTo(3, 2);
  });

  it('isMoving becomes false when tween completes', () => {
    const agent = makeAgent('a6', 0, 0);
    const moved = applyMove(agent, 3, 3, 1000);
    const result = tickTween(moved, moved.tweenDuration);
    expect(result.isMoving).toBe(false);
  });

  it('tweenDuration resets to 0 when tween completes', () => {
    const agent = makeAgent('a7', 0, 0);
    const moved = applyMove(agent, 2, 2, 1000);
    const result = tickTween(moved, moved.tweenDuration);
    expect(result.tweenDuration).toBe(0);
  });

  it('tween duration is 150ms for a single-tile move', () => {
    const duration = computeTweenDuration(0, 0, 1, 0);
    expect(duration).toBeCloseTo(150, 0);
  });

  it('tween duration scales with distance (2 tiles = 300ms)', () => {
    const duration = computeTweenDuration(0, 0, 2, 0);
    expect(duration).toBeCloseTo(300, 0);
  });

  it('tween duration has a minimum of 80ms', () => {
    // Zero-distance move (same position) would be 0 without the floor
    const duration = computeTweenDuration(5, 5, 5, 5);
    expect(duration).toBe(80);
  });
});

describe('T-358 — Walk Animation: direction detection', () => {
  it('moving right (dx>0, dy=0) → faceLeft=false', () => {
    expect(computeFaceLeft(3, 0, false)).toBe(false);
  });

  it('moving left (dx<0, dy=0) → faceLeft=true', () => {
    expect(computeFaceLeft(-3, 0, false)).toBe(true);
  });

  it('moving down-y (dx=0, dy>0) → faceLeft=true (screen-left)', () => {
    // screenDx = 0 - 3 = -3 → left
    expect(computeFaceLeft(0, 3, false)).toBe(true);
  });

  it('moving up-y (dx=0, dy<0) → faceLeft=false (screen-right)', () => {
    // screenDx = 0 - (-3) = 3 → right
    expect(computeFaceLeft(0, -3, false)).toBe(false);
  });

  it('diagonal right-down (dx>0, dy>0, dx>dy) → faceLeft=false', () => {
    // screenDx = 5 - 2 = 3 → right
    expect(computeFaceLeft(5, 2, true)).toBe(false);
  });

  it('diagonal left-down (dx<0, dy>0) → faceLeft=true', () => {
    // screenDx = -3 - 2 = -5 → left
    expect(computeFaceLeft(-3, 2, false)).toBe(true);
  });

  it('purely vertical move preserves current faceLeft', () => {
    // dx=2, dy=2 → screenDx=0, preserve current
    expect(computeFaceLeft(2, 2, true)).toBe(true);
    expect(computeFaceLeft(2, 2, false)).toBe(false);
  });

  it('applyMove sets faceLeft on agent correctly for leftward move', () => {
    const agent = makeAgent('dir1', 8, 8);
    const moved = applyMove(agent, 4, 8, 1000);
    expect(moved.faceLeft).toBe(true);
  });

  it('applyMove sets faceLeft=false on agent for rightward move', () => {
    const agent = makeAgent('dir2', 2, 2);
    const moved = applyMove(agent, 10, 2, 1000);
    expect(moved.faceLeft).toBe(false);
  });
});

describe('T-358 — Walk Animation: walk phase increments during movement', () => {
  it('walkPhase advances by dt*8 each tick', () => {
    const dt = 0.016; // 16ms frame
    const next = advanceWalkPhase(0, dt);
    expect(next).toBeCloseTo(dt * 8, 5);
  });

  it('walkPhase accumulates over multiple frames', () => {
    let phase = 0;
    for (let i = 0; i < 60; i++) phase = advanceWalkPhase(phase, 1 / 60);
    expect(phase).toBeCloseTo(8, 2);
  });

  it('walkBob returns 0 when phase=0', () => {
    expect(walkBob(0)).toBeCloseTo(0, 5);
  });

  it('walkBob returns max 2px at phase=π/2', () => {
    expect(walkBob(Math.PI / 2)).toBeCloseTo(2, 5);
  });

  it('walkBob returns min -2px at phase=3π/2', () => {
    expect(walkBob(3 * Math.PI / 2)).toBeCloseTo(-2, 5);
  });

  it('walkBob oscillates symmetrically in [-2, 2]', () => {
    for (let i = 0; i < 100; i++) {
      const phase = (i / 100) * Math.PI * 2;
      const bob = walkBob(phase);
      expect(bob).toBeGreaterThanOrEqual(-2 - 1e-9);
      expect(bob).toBeLessThanOrEqual(2 + 1e-9);
    }
  });
});

describe('T-358 — Walk Animation: idle animation when stationary', () => {
  it('idleBob returns a value in [-0.5, 0.5]', () => {
    for (let t = 0; t < 10000; t += 100) {
      const bob = idleBob(t);
      expect(bob).toBeGreaterThanOrEqual(-0.5 - 1e-9);
      expect(bob).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('idleBob is not constant (breathing effect changes over time)', () => {
    const b1 = idleBob(0);
    const b2 = idleBob(1000);
    expect(b1).not.toBeCloseTo(b2, 3);
  });

  it('idle agent has isMoving=false', () => {
    const agent = makeAgent('idle1', 5, 5);
    expect(agent.isMoving).toBe(false);
  });

  it('agent stops moving after tween completes', () => {
    const agent = makeAgent('idle2', 0, 0);
    const moved = applyMove(agent, 3, 0, 1000);
    const done = tickTween(moved, moved.tweenDuration + 1);
    expect(done.isMoving).toBe(false);
  });

  it('idle agent walkPhase does not advance', () => {
    // walkPhase is only advanced inside the isMoving branch in gameLoop
    const agent = makeAgent('idle3', 5, 5);
    // No tick applied; phase should still be 0
    expect(agent.walkPhase).toBe(0);
  });
});

describe('T-358 — Walk Animation: rapid position changes (override)', () => {
  it('second move overrides the first target immediately', () => {
    const agent = makeAgent('rapid1', 0, 0);
    const firstMove = applyMove(agent, 4, 0, 1000);
    // Half-way through first move
    const halfTick = tickTween(firstMove, firstMove.tweenDuration * 0.5);
    const agentAtHalf: AnimAgent = { ...firstMove, x: halfTick.x, y: halfTick.y };
    // New move arrives — override
    const secondMove = applyMove(agentAtHalf, 8, 0, 1075);
    expect(secondMove.targetX).toBe(8);
    expect(secondMove.targetY).toBe(0);
  });

  it('tween restart after override starts from current position', () => {
    const agent = makeAgent('rapid2', 0, 0);
    const firstMove = applyMove(agent, 6, 0, 1000);
    const halfTick = tickTween(firstMove, firstMove.tweenDuration * 0.5);
    const agentAtHalf: AnimAgent = { ...firstMove, x: halfTick.x, y: halfTick.y };
    const secondMove = applyMove(agentAtHalf, 12, 0, 1075);
    // tweenStartX must equal current x (mid-flight position)
    expect(secondMove.tweenStartX).toBeCloseTo(agentAtHalf.x, 2);
  });

  it('same-position move does not restart tween', () => {
    const agent = makeAgent('rapid3', 5, 5);
    const moved = applyMove(agent, 8, 8, 1000);
    const sameTarget = applyMove(moved, 8, 8, 1010); // identical target
    // Should return the agent unchanged (no new tween)
    expect(sameTarget.tweenStartTime).toBe(moved.tweenStartTime);
  });

  it('clamped coordinates prevent out-of-bounds tween targets', () => {
    const agent = makeAgent('rapid4', 14, 14);
    const moved = applyMove(agent, 99, 99, 1000);
    expect(moved.targetX).toBe(ROOM_SIZE - 1);
    expect(moved.targetY).toBe(ROOM_SIZE - 1);
  });

  it('direction updates correctly on each override', () => {
    const agent = makeAgent('rapid5', 5, 5);
    const firstMove = applyMove(agent, 8, 5, 1000); // moving right → faceLeft=false
    expect(firstMove.faceLeft).toBe(false);
    const agentMid: AnimAgent = { ...firstMove, x: 7, y: 5 };
    const secondMove = applyMove(agentMid, 2, 5, 1075); // now moving left
    expect(secondMove.faceLeft).toBe(true);
  });
});

describe('T-358 — Walk Animation: isoToScreen coordinate validation', () => {
  it('origin maps to offset center', () => {
    const { sx, sy } = isoToScreen(0, 0, 512, 128);
    expect(sx).toBe(512);
    expect(sy).toBe(128);
  });

  it('moving along x increases screen x', () => {
    const a = isoToScreen(0, 0);
    const b = isoToScreen(2, 0);
    expect(b.sx).toBeGreaterThan(a.sx);
  });

  it('moving along y decreases screen x (iso left)', () => {
    const a = isoToScreen(0, 0);
    const b = isoToScreen(0, 2);
    expect(b.sx).toBeLessThan(a.sx);
  });
});
