# Isometric Pixel Art Design Rules — Habbo Hotel Style

## Core Rules (from research)

### 1. The 2:1 Pixel Rule
- Isometric pixel art uses ~26.565° angle (NOT 30°)
- Lines go 2 pixels horizontal for every 1 pixel vertical
- This avoids jaggy lines that 30° would create

### 2. Tile Dimensions
- Standard sizes: 32x16, 64x32, 128x64
- All follow the 2:1 ratio
- Our tiles: 64x32 (good balance of detail vs pixel-art feel)

### 3. Wall Rules
- Walls are FLAT planes at isometric angles
- Back wall follows the RIGHT isometric edge (2:1 going up-right)
- Left wall follows the LEFT isometric edge (2:1 going up-left)  
- Walls have: baseboard (dark strip at bottom), main color, crown molding (lighter strip at top)
- Wall height: typically 2-3 tiles high
- Windows/decorations are drawn IN the wall plane (same perspective!)

### 4. Window Perspective (CRITICAL)
- Windows on back wall: parallelogram shape following 2:1 right slope
- Windows on left wall: parallelogram shape following 2:1 left slope
- NEVER draw rectangular windows — they must follow the wall angle
- Window cross bars also follow the wall plane

### 5. Furniture Placement Rules
- Furniture sits ON tiles, aligned to the isometric grid
- Against walls: furniture touching/near walls (sofas, shelves, TV)
- Center: tables, rugs, open space
- Furniture follows ROOM LOGIC:
  - Living area: sofa facing TV, coffee table between
  - Kitchen area: fridge + counter + table grouped
  - Work area: desk + chair together
  - Bedroom area: bed + nightstand + lamp
- NO random placement! Think: "where would a person put this?"

### 6. Furniture Sprite Rules
- All furniture drawn from same isometric angle
- Bold black outlines (1px)
- Flat colors with minimal shading (1-2 shadow tones)
- Items must look like they BELONG on the tile they're placed on
- Scale: furniture should feel proportional to the tile (a chair ≈ 1 tile, a sofa ≈ 2 tiles, a bed ≈ 2x3 tiles)

### 7. Color Palette
- Limited, warm palette
- Floor: wood browns, carpet reds
- Walls: cream, beige, light brown, or themed colors
- Furniture: mix of colors but harmonious
- Strong black outlines separate everything

### 8. Depth/Layering
- Render back-to-front (painter's algorithm)
- Items further from camera drawn first
- Sort by (x + y) for depth ordering
- Walls drawn BEFORE floor (they're behind)
- Floor drawn BEFORE furniture/agents

### 9. Room Design Principles (from Habbo community)
- Rooms have ZONES: social area, entertainment area, work area, etc.
- Walls are not bare — pictures, shelves, windows break monotony
- Corners are filled — plants, lamps, small tables
- Rugs define areas within a room
- Lighting: lamps create warm spots (not coded, but implied by placement)
- Entry: door is usually on one edge, with space around it

### 10. What Makes a Room Look GOOD vs BAD
**BAD:**
- Furniture scattered randomly
- Empty walls
- No logical zones
- Flat identical coloring everywhere
- Windows not in perspective
- Sprites that don't match the isometric angle

**GOOD:**
- Clear zones (living, dining, work)
- Furniture arranged as humans would (sofa facing TV, chairs around table)
- Wall decorations breaking up blank space
- Corner details (plants, lamps)
- Consistent color harmony
- Correct isometric perspective on ALL elements
