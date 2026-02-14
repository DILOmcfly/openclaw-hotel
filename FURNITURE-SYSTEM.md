# Furniture System Documentation

## Overview
The OpenClaw Hotel Furniture System allows players to place, move, and interact with furniture items in rooms. This document describes the client-side implementation completed in T-043.

## Architecture

### Core Components

#### 1. FurnitureManager (`client/src/renderer/FurnitureManager.ts`)
Main controller for furniture rendering and interaction.

**Features:**
- ✅ Sprite-based rendering with isometric positioning
- ✅ WebSocket synchronization (furniture.placed, furniture.removed events)
- ✅ Z-ordering for correct depth sorting
- ✅ Placement mode with preview
- ✅ Collision detection (client-side validation)
- ✅ Interactive selection (click to select)
- ✅ Rotation support (8 directions)

**API:**
```typescript
const furnitureManager = new FurnitureManager(worldContainer);

// Connect to WebSocket for real-time updates
furnitureManager.connectWS(wsClient, roomId);

// Start placement mode
furnitureManager.startPlacementMode('chair_wood');

// Update preview position (on mousemove)
furnitureManager.updatePlacementPreview(screenX, screenY);

// Confirm placement (on click)
furnitureManager.confirmPlacement();

// Cancel placement (on ESC or right-click)
furnitureManager.cancelPlacementMode();

// Rotate preview (on 'r' key)
furnitureManager.rotatePlacementPreview();

// Remove selected furniture (on Delete key)
furnitureManager.removeSelectedFurniture();
```

**Events:**
```typescript
furnitureManager.onPlacementSuccess = () => { /* ... */ };
furnitureManager.onPlacementFailed = (reason: string) => { /* ... */ };
furnitureManager.onItemSelected = (itemId: string) => { /* ... */ };
```

#### 2. UIManager Extensions (`client/src/ui/UIManager.ts`)
Enhanced inventory panel with catalog integration.

**New Features:**
- ✅ Tabbed interface (Owned / Catalog)
- ✅ Category filtering (All, Seating, Tables, Decoration, Storage)
- ✅ Drag-to-place support
- ✅ Item count display
- ✅ Purchase system (UI only, backend integration pending)

**API:**
```typescript
const ui = new UIManager();

// Load owned furniture
ui.loadInventory([
  { itemDefId: 'chair_wood', name: 'Wooden Chair', count: 3 },
  { itemDefId: 'table_round', name: 'Round Table', count: 1 }
]);

// Load catalog
ui.loadCatalog([
  { itemDefId: 'chair_wood', name: 'Wooden Chair', category: 'seating', price: 50 },
  { itemDefId: 'table_round', name: 'Round Table', category: 'tables', price: 100 }
]);
```

**Callbacks:**
```typescript
ui.onPlaceFurniture = (itemDefId: string) => { /* ... */ };
ui.onBuyFurniture = (itemDefId: string) => { /* ... */ };
ui.onFurnitureDragStart = (itemDefId: string) => { /* ... */ };
```

## User Interactions

### Placement Flow
1. User opens inventory (📦 button in HUD)
2. User selects furniture item from "Owned" tab
3. User clicks "Place Selected" OR drags item
4. **Placement Mode activates:**
   - Semi-transparent preview follows cursor
   - Green highlight = valid position
   - Red highlight = collision detected
5. User positions furniture on grid
6. User presses **R** to rotate (optional)
7. User **clicks** to confirm placement
8. Furniture appears in room for all players

### Keyboard Shortcuts
- **ESC** - Cancel placement mode
- **R** - Rotate furniture preview (in placement mode)
- **Delete** / **Backspace** - Remove selected furniture
- **Right-click** - Cancel placement mode

### Mouse Interactions
- **Click furniture** - Select for interaction
- **Click empty tile** - Move avatar (when not in placement mode)
- **Click during placement** - Confirm placement
- **Drag from inventory** - Start placement mode

## Backend Integration

### WebSocket Events

**Client → Server:**
```typescript
// Place furniture
{
  type: 'furniture.place',
  roomId: string,
  itemDefId: string,  // e.g., 'chair_wood'
  x: number,
  y: number,
  rotation: number    // 0-7 (45° increments)
}

// Remove furniture
{
  type: 'furniture.remove',
  roomId: string,
  itemId: string      // UUID of placed item
}
```

**Server → Client:**
```typescript
// Furniture placed
{
  type: 'furniture.placed',
  roomId: string,
  item: {
    id: string,           // UUID
    itemDefId: string,    // 'chair_wood'
    x: number,
    y: number,
    z: number,            // Auto-calculated by backend
    rotation: number,
    placedBy: string,     // Agent ID
    createdAt: string     // ISO timestamp
  }
}

// Furniture removed
{
  type: 'furniture.removed',
  roomId: string,
  itemId: string
}
```

## Furniture Catalog

### Current Items
| Item ID | Name | Category | Sprite | Status |
|---------|------|----------|--------|--------|
| `chair_wood` | Wooden Chair | seating | ✅ furn_chair.png | Working |
| `table_round` | Round Table | tables | ✅ furn_table.png | Working |
| `lamp_floor` | Floor Lamp | decoration | ✅ furn_lamp.png | Working |
| `bookshelf` | Bookshelf | storage | ✅ furn_bookshelf.png | Working |
| `bed_single` | Single Bed | seating | ✅ furn_bed.png | Working |
| `plant_pot` | Potted Plant | decoration | ⚠️ placeholder | Needs sprite |
| `sofa_2seat` | 2-Seat Sofa | seating | ⚠️ placeholder | Needs sprite |
| `desk_office` | Office Desk | tables | ⚠️ placeholder | Needs sprite |

### Adding New Furniture

1. **Create sprite** (32x48px or similar, PNG with transparency)
2. **Add to `/client/public/assets/`** as `furn_<name>.png`
3. **Update sprites.json:**
   ```json
   "furn_<name>.png": {
     "frame": { "x": 0, "y": 0, "w": 32, "h": 48 },
     "sourceSize": { "w": 32, "h": 48 }
   }
   ```
4. **Add to backend catalog** (`src/data/furniture-catalog.ts`):
   ```typescript
   <itemId>: { width: 1, depth: 1, height: 1.0, canSit: false, walkable: false }
   ```
5. **Map sprite in FurnitureManager:**
   ```typescript
   const ITEM_SPRITE_MAP: Record<string, string> = {
     <itemId>: '<name>'  // without furn_ prefix and .png
   };
   ```

## Styling

All furniture UI is styled with the Habbo-inspired pixel art aesthetic defined in `/client/src/ui/styles.css`.

**Key CSS classes:**
- `.inventory-panel` - Main inventory container
- `.panel-tabs` - Owned / Catalog tabs
- `.furniture-grid` - Grid layout for furniture items
- `.furniture-item` - Individual furniture card
- `.furniture-item.selected` - Selected state (yellow highlight)
- `.catalog-item` - Catalog-specific styling
- `.category-btn` - Category filter buttons

## Known Limitations & Future Work

### Missing Features (documented for T-045+)
- ⚠️ Context menu for placed furniture (move/rotate/pick up)
- ⚠️ Drag-and-drop repositioning (currently only placement)
- ⚠️ Purchase API integration (UI exists, backend pending)
- ⚠️ User inventory sync from backend (currently demo data)
- ⚠️ Stacking validation visualization
- ⚠️ Multi-tile furniture visual bounds

### Known Issues
- Missing sprites for: plant_pot, sofa_2seat, desk_office (using placeholders)
- No undo/redo for furniture placement
- No furniture preview in catalog (just icons)

## Testing

Run tests:
```bash
cd /Users/diegomcfly/clawd/projects/openclaw-hotel
npx vitest run
```

All backend furniture service tests pass (8/8) ✅

## Performance

- Z-ordering uses `depthSort(x, y, z)` for efficient sorting
- Sprites loaded once via `AssetLoader` (cached)
- WebSocket events use JSON (lightweight)
- Collision detection runs client-side (instant feedback)
- Backend validates all placements (prevents cheating)

## Accessibility

- Keyboard shortcuts for all major actions
- Visual feedback for valid/invalid placement
- Color-coded highlights (green = OK, red = blocked)
- Fallback to colored boxes if sprites fail to load

---

**Implementation Status:** ✅ Core Complete (T-043)  
**Next Tasks:** T-045 — Advanced Furniture Interactions (context menu, drag-move)
