import { describe, expect, it } from 'vitest';
import { checkCollision, getAffectedTiles, getStackHeight } from '../services/furniture.js';

describe('furniture service helpers', () => {
  it('getAffectedTiles for 1x1 item at (3,3) rotation 0', () => {
    expect(getAffectedTiles('chair_wood', 3, 3, 0)).toEqual([{ x: 3, y: 3 }]);
  });

  it('getAffectedTiles for 2x1 item at (0,0) rotation 0', () => {
    expect(getAffectedTiles('sofa_2seat', 0, 0, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it('getAffectedTiles for 2x1 item at (0,0) rotation 4 swaps dimensions', () => {
    expect(getAffectedTiles('sofa_2seat', 0, 0, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('checkCollision returns false when no overlap', () => {
    const affectedTiles = [{ x: 5, y: 5 }];
    const existingItems = [{ x: 0, y: 0, z: 0, itemDefId: 'chair_wood', rotation: 0 }];

    expect(checkCollision(affectedTiles, existingItems)).toBe(false);
  });

  it('checkCollision returns true when overlap with non-walkable', () => {
    const affectedTiles = [{ x: 0, y: 0 }];
    const existingItems = [{ x: 0, y: 0, z: 0, itemDefId: 'chair_wood', rotation: 0 }];

    expect(checkCollision(affectedTiles, existingItems)).toBe(true);
  });

  it('checkCollision returns false when overlap with walkable', () => {
    const affectedTiles = [{ x: 0, y: 0 }];
    const existingItems = [{ x: 0, y: 0, z: 0, itemDefId: 'rug_small', rotation: 0 }];

    expect(checkCollision(affectedTiles, existingItems)).toBe(false);
  });

  it('getStackHeight returns 0 for empty position', () => {
    expect(getStackHeight(2, 2, [])).toBe(0);
  });

  it('getStackHeight returns correct height with stacked items', () => {
    const existingItems = [
      { x: 1, y: 1, z: 0, itemDefId: 'rug_small', rotation: 0 },
      { x: 1, y: 1, z: 0.01, itemDefId: 'chair_wood', rotation: 0 },
      { x: 1, y: 1, z: 1.01, itemDefId: 'plant_pot', rotation: 0 },
    ];

    expect(getStackHeight(1, 1, existingItems)).toBeCloseTo(1.51);
  });
});
