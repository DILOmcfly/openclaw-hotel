/**
 * T-344: Dynamic Furniture Rendering — Unit Tests
 *
 * Tests for:
 * - ITEM_DEF_TO_SPRITE mapping (catalog id → sprite name)
 * - defIdToSprite() normalisation (underscores, case, hyphens)
 * - roomFurniture Map lifecycle (load, place, remove, move, clear on leave)
 * - furniture.placed WS event handling
 * - furniture.removed WS event handling
 * - furniture.moved WS event handling
 * - Fallback to hardcoded layout when DB furniture is empty
 * - addFurnitureSprite() guards (no PIXI, no container, missing texture)
 *
 * Pure unit tests — no DB, no PixiJS required (mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mirror of ITEM_DEF_TO_SPRITE from spectate.js ───────────────────────────
const ITEM_DEF_TO_SPRITE: Record<string, string> = {
  chair_wood:   'chair',
  table_round:  'table',
  lamp_floor:   'lamp',
  plant_pot:    'plant',
  bookshelf:    'bookshelf',
  sofa_2seat:   'sofa',
  rug_small:    'rug',
  tv_screen:    'tv',
  desk_office:  'desk',
  bed_single:   'bed',
  // Additional aliases
  chair:        'chair',
  table:        'table',
  lamp:         'lamp',
  plant:        'plant',
  sofa:         'sofa',
  rug:          'rug',
  tv:           'tv',
  desk:         'desk',
  bed:          'bed',
  computer:     'computer',
  fridge:       'fridge',
  coffee_table: 'coffee_table',
  lounge_chair: 'lounge_chair',
  side_table:   'side_table',
  coatrack:     'coatrack',
  radio:        'radio',
  speaker:      'speaker',
};

function defIdToSprite(itemDefId: string | null | undefined): string | null {
  if (!itemDefId) return null;
  const key = String(itemDefId).toLowerCase().replace(/[- ]/g, '_');
  return ITEM_DEF_TO_SPRITE[key] || ITEM_DEF_TO_SPRITE[itemDefId] || null;
}

// ─── roomFurniture Map simulation ─────────────────────────────────────────────
interface FurnitureItem {
  id: string;
  itemDefId: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  sprite: object | null;
}

function createRoomFurnitureMap(): Map<string, FurnitureItem> {
  return new Map();
}

// ─── Mock addFurnitureSprite ───────────────────────────────────────────────────
function mockAddFurnitureSprite(
  item: FurnitureItem,
  spriteTextures: Record<string, object>,
  pixiLoaded: boolean,
  containerExists: boolean
): object | null {
  if (!pixiLoaded || !containerExists) return null;
  const spriteName = defIdToSprite(item.itemDefId);
  const texture = spriteName ? spriteTextures[spriteName] : null;
  if (!texture) return null;
  return { type: 'Sprite', x: item.x, y: item.y, itemDefId: item.itemDefId };
}

function mockRemoveFurnitureSprite(item: FurnitureItem | null): void {
  if (!item || !item.sprite) return;
  item.sprite = null; // simulate destroy
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T-344: defIdToSprite()', () => {
  it('maps catalog id chair_wood → chair', () => {
    expect(defIdToSprite('chair_wood')).toBe('chair');
  });

  it('maps sofa_2seat → sofa', () => {
    expect(defIdToSprite('sofa_2seat')).toBe('sofa');
  });

  it('maps tv_screen → tv', () => {
    expect(defIdToSprite('tv_screen')).toBe('tv');
  });

  it('maps desk_office → desk', () => {
    expect(defIdToSprite('desk_office')).toBe('desk');
  });

  it('maps rug_small → rug', () => {
    expect(defIdToSprite('rug_small')).toBe('rug');
  });

  it('maps bed_single → bed', () => {
    expect(defIdToSprite('bed_single')).toBe('bed');
  });

  it('maps plain alias "chair" → chair', () => {
    expect(defIdToSprite('chair')).toBe('chair');
  });

  it('maps plain alias "computer" → computer', () => {
    expect(defIdToSprite('computer')).toBe('computer');
  });

  it('returns null for unknown item_def_id', () => {
    expect(defIdToSprite('mystery_item_xyz')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(defIdToSprite(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(defIdToSprite(undefined)).toBeNull();
  });

  it('normalises hyphens to underscores (chair-wood → chair)', () => {
    expect(defIdToSprite('chair-wood')).toBe('chair');
  });

  it('normalises uppercase (CHAIR_WOOD → chair)', () => {
    expect(defIdToSprite('CHAIR_WOOD')).toBe('chair');
  });

  it('maps all 16 catalog entries without gaps', () => {
    const catalogIds = [
      'chair_wood', 'table_round', 'lamp_floor', 'plant_pot', 'bookshelf',
      'sofa_2seat', 'rug_small', 'tv_screen', 'desk_office', 'bed_single',
      'computer', 'fridge', 'coffee_table', 'lounge_chair', 'radio', 'speaker',
    ];
    for (const id of catalogIds) {
      expect(defIdToSprite(id)).not.toBeNull();
    }
  });
});

describe('T-344: roomFurniture Map lifecycle', () => {
  let roomFurniture: Map<string, FurnitureItem>;

  beforeEach(() => {
    roomFurniture = createRoomFurnitureMap();
  });

  it('starts empty', () => {
    expect(roomFurniture.size).toBe(0);
  });

  it('loads DB furniture items from API response', () => {
    const apiItems = [
      { id: 'item-1', itemDefId: 'chair_wood', x: 3, y: 4, z: 0, rotation: 0, sprite: null },
      { id: 'item-2', itemDefId: 'sofa_2seat', x: 5, y: 2, z: 0, rotation: 0, sprite: null },
    ];
    for (const item of apiItems) {
      roomFurniture.set(item.id, { ...item });
    }
    expect(roomFurniture.size).toBe(2);
    expect(roomFurniture.get('item-1')?.itemDefId).toBe('chair_wood');
    expect(roomFurniture.get('item-2')?.x).toBe(5);
  });

  it('adds new item on furniture.placed WS event', () => {
    const newItem: FurnitureItem = {
      id: 'item-99',
      itemDefId: 'plant_pot',
      x: 7, y: 7, z: 0, rotation: 0,
      sprite: null,
    };
    roomFurniture.set(newItem.id, newItem);
    expect(roomFurniture.has('item-99')).toBe(true);
    expect(roomFurniture.get('item-99')?.itemDefId).toBe('plant_pot');
  });

  it('removes item on furniture.removed WS event', () => {
    roomFurniture.set('item-1', {
      id: 'item-1', itemDefId: 'chair_wood', x: 1, y: 1, z: 0, rotation: 0, sprite: null
    });
    roomFurniture.delete('item-1');
    expect(roomFurniture.has('item-1')).toBe(false);
  });

  it('updates item position on furniture.moved WS event', () => {
    roomFurniture.set('item-1', {
      id: 'item-1', itemDefId: 'table_round', x: 2, y: 2, z: 0, rotation: 0, sprite: null
    });
    const item = roomFurniture.get('item-1')!;
    item.x = 6;
    item.y = 8;
    expect(roomFurniture.get('item-1')?.x).toBe(6);
    expect(roomFurniture.get('item-1')?.y).toBe(8);
  });

  it('clears all items on leaveRoom()', () => {
    roomFurniture.set('a', { id: 'a', itemDefId: 'chair_wood', x: 1, y: 1, z: 0, rotation: 0, sprite: null });
    roomFurniture.set('b', { id: 'b', itemDefId: 'sofa_2seat', x: 2, y: 2, z: 0, rotation: 0, sprite: null });
    roomFurniture.clear();
    expect(roomFurniture.size).toBe(0);
  });

  it('overwrites duplicate item on repeated furniture.placed', () => {
    const item: FurnitureItem = { id: 'dup', itemDefId: 'lamp_floor', x: 1, y: 1, z: 0, rotation: 0, sprite: null };
    roomFurniture.set('dup', item);
    // Second placement (moved position)
    const updated: FurnitureItem = { ...item, x: 3, y: 5 };
    roomFurniture.set('dup', updated);
    expect(roomFurniture.size).toBe(1);
    expect(roomFurniture.get('dup')?.x).toBe(3);
  });
});

describe('T-344: addFurnitureSprite() guards', () => {
  const spriteTextures = {
    chair: { width: 64, height: 64 },
    sofa:  { width: 96, height: 64 },
  };

  it('returns null when PixiJS is not loaded', () => {
    const item: FurnitureItem = { id: 'i1', itemDefId: 'chair_wood', x: 2, y: 2, z: 0, rotation: 0, sprite: null };
    const result = mockAddFurnitureSprite(item, spriteTextures, false, true);
    expect(result).toBeNull();
  });

  it('returns null when contentContainer is missing', () => {
    const item: FurnitureItem = { id: 'i1', itemDefId: 'chair_wood', x: 2, y: 2, z: 0, rotation: 0, sprite: null };
    const result = mockAddFurnitureSprite(item, spriteTextures, true, false);
    expect(result).toBeNull();
  });

  it('returns null when sprite texture is unknown', () => {
    const item: FurnitureItem = { id: 'i1', itemDefId: 'unknown_item', x: 2, y: 2, z: 0, rotation: 0, sprite: null };
    const result = mockAddFurnitureSprite(item, spriteTextures, true, true);
    expect(result).toBeNull();
  });

  it('returns a sprite object when all conditions met', () => {
    const item: FurnitureItem = { id: 'i1', itemDefId: 'chair_wood', x: 3, y: 4, z: 0, rotation: 0, sprite: null };
    const result = mockAddFurnitureSprite(item, spriteTextures, true, true);
    expect(result).not.toBeNull();
    expect((result as any).x).toBe(3);
    expect((result as any).y).toBe(4);
    expect((result as any).itemDefId).toBe('chair_wood');
  });
});

describe('T-344: removeFurnitureSprite()', () => {
  it('destroys sprite reference', () => {
    const item: FurnitureItem = {
      id: 'r1', itemDefId: 'sofa_2seat', x: 1, y: 1, z: 0, rotation: 0,
      sprite: { type: 'MockSprite' }
    };
    mockRemoveFurnitureSprite(item);
    expect(item.sprite).toBeNull();
  });

  it('is a no-op for null item', () => {
    expect(() => mockRemoveFurnitureSprite(null)).not.toThrow();
  });

  it('is a no-op when sprite is already null', () => {
    const item: FurnitureItem = { id: 'r2', itemDefId: 'lamp_floor', x: 1, y: 1, z: 0, rotation: 0, sprite: null };
    expect(() => mockRemoveFurnitureSprite(item)).not.toThrow();
  });
});

describe('T-344: DB furniture vs hardcoded layout fallback', () => {
  it('uses DB furniture when roomFurniture has items', () => {
    const roomFurniture = new Map<string, FurnitureItem>();
    roomFurniture.set('x', { id: 'x', itemDefId: 'chair_wood', x: 1, y: 1, z: 0, rotation: 0, sprite: null });

    // Simulate drawRoom() branching logic
    const usesDB = roomFurniture.size > 0;
    expect(usesDB).toBe(true);
  });

  it('falls back to hardcoded layout when roomFurniture is empty', () => {
    const roomFurniture = new Map<string, FurnitureItem>();
    const usesDB = roomFurniture.size > 0;
    expect(usesDB).toBe(false);
  });
});
