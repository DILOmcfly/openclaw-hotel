# OpenClaw Hotel — Pixel Art Style Guide

> **Version:** 1.0.0  
> **Created:** 2026-02-16  
> **Style Reference:** Habbo Hotel (near-isometric, strong outlines, flat colors)

---

## 🎨 Master Color Palette

**Philosophy:** Flat colors only. NO gradients. Maximum 3 shades per color family. Strong color separation.

### Skin Tones (6 colors)
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Skin Light | `#FFD9B3` | Base skin tone |
| Skin Medium | `#D4A574` | Darker skin tone |
| Skin Dark | `#8B6F47` | Shadow/outline on skin |
| Skin Highlight | `#FFF4E6` | Brightest highlight |
| Skin Blush | `#FFB4A3` | Cheeks, warmth |
| Skin Outline | `#6B4423` | Skin edges |

### Wood Tones (5 colors)
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Wood Light | `#D4A574` | Light oak, birch |
| Wood Medium | `#8B6F47` | Standard furniture |
| Wood Dark | `#5C4033` | Mahogany, walnut |
| Wood Highlight | `#E6C9A8` | Top surfaces |
| Wood Shadow | `#3D2817` | Under furniture |

### Metal & Industrial (4 colors)
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Metal Base | `#C0C0C0` | Steel, chrome |
| Metal Highlight | `#E8E8E8` | Reflections |
| Metal Shadow | `#808080` | Depth |
| Metal Dark | `#404040` | Edges, screws |

### Fabric & Upholstery (6 colors)
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Fabric Red | `#D32F2F` | Chairs, sofas |
| Fabric Blue | `#1976D2` | Curtains, carpets |
| Fabric Green | `#388E3C` | Accent pieces |
| Fabric Purple | `#7B1FA2` | Luxury items |
| Fabric Beige | `#D7CCC8` | Neutral upholstery |
| Fabric Shadow | `#6D4C41` | Fabric depth |

### Nature & Plants (4 colors)
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Leaf Green | `#4CAF50` | Leaves |
| Plant Dark | `#2E7D32` | Shadows on plants |
| Soil Brown | `#795548` | Pots, dirt |
| Plant Highlight | `#81C784` | Top of leaves |

### UI & System (7 colors)
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Black | `#000000` | Outlines (CRITICAL) |
| White | `#FFFFFF` | Highlights, text |
| Floor Neutral | `#E0E0E0` | Base floor tiles |
| Wall Base | `#BDBDBD` | Standard walls |
| Shadow | `#424242` | Cast shadows |
| Transparent | `#00000000` | Alpha channel |
| UI Accent | `#FF6F00` | Notifications, highlights |

**Total Palette:** 32 colors (optimized for consistency and batch generation)

---

## 📐 Isometric Projection Rules

### Grid System
- **Angle:** Near-isometric (26.565° from horizontal, approximates 1:2 ratio)
- **Base Tile:** 128×64 pixels (diamond shape)
- **Wall Height:** 96 pixels (1.5× tile height)
- **Vertical Rise:** 32 pixels per level

### Projection Formula
```
X_screen = (X_world - Y_world) × 64
Y_screen = (X_world + Y_world) × 32 - Z_world × 32
```

### Visual Reference
```
     Top View              Isometric View
    
    +-------+                  /\
    |       |                 /  \
    | Tile  |         →      /    \
    |       |               /______\
    +-------+              64px  64px
     64×64                  (128×64)
```

### Anchor Points
- **Furniture:** Bottom-center of isometric base
- **Characters:** Feet position (center-bottom)
- **Walls:** Back edge at floor level
- **Floors:** Center of tile

---

## 🎭 Sprite Standards

### Character Agents
| Property | Specification |
|----------|--------------|
| **Base Size** | 32×48 pixels (standing) |
| **Directions** | 4 cardinal (N, E, S, W) + 4 diagonal optional |
| **Walk Cycle** | 4 frames per direction (idle, step1, step2, step3) |
| **Sprite Sheet** | 128×192 pixels (4×4 grid) |
| **File Format** | PNG with transparency |
| **Naming** | `agent-[type]-dir[0-7].png` (0=S, 2=SW, 4=W, 6=NW, etc.) |

### Furniture Objects
| Category | Dimensions | Example |
|----------|-----------|---------|
| **Small** | 32×32 to 64×64 | Chair, lamp, plant |
| **Medium** | 64×64 to 128×96 | Desk, sofa, bed (single) |
| **Large** | 128×128+ | Double bed, bookshelf, wardrobe |
| **Floor Tiles** | 128×64 (fixed) | All floor types |
| **Wall Pieces** | 128×96 (standard wall height) | Wall sections |

### Animation Frame Counts
| Animation Type | Frames | FPS | Total Duration |
|---------------|--------|-----|----------------|
| Idle | 2-4 | 2 | 1-2 seconds |
| Walk | 4 | 8 | 0.5 seconds |
| Sit | 1 (static) | — | — |
| Wave | 3-5 | 6 | ~0.8 seconds |
| Dance | 6-8 | 12 | Looping |

---

## 📂 Naming Convention

### Format
```
[category]-[name]-[variant]-[state].png
```

### Categories
- `furniture` — Chairs, tables, beds, etc.
- `floor` — Tile textures
- `wall` — Wall segments
- `agent` — Character sprites
- `item` — Handheld objects
- `ui` — Interface elements
- `effect` — Visual effects (sparkles, etc.)

### Examples
```
✅ GOOD:
furniture-chair-red.png
furniture-chair-blue.png
floor-carpet-beige-128x64.png
agent-guest-dir0-idle.png
agent-guest-dir2-walk-frame1.png
wall-brick-standard.png

❌ BAD:
Chair1.png (no category, no variant)
red_chair_final_v2.png (inconsistent, version in name)
agent.png (too generic)
```

### Variant Naming
- **Color variants:** `-red`, `-blue`, `-green`
- **Material variants:** `-wood`, `-metal`, `-fabric`
- **Style variants:** `-modern`, `-vintage`, `-luxury`
- **State:** `-idle`, `-walk`, `-sit`

---

## ✅ Quality Checklist

### Visual Requirements
- [ ] **No gradients** — Flat colors only (Habbo rule #1)
- [ ] **Strong black outlines** — 1-2px thick on all objects
- [ ] **Consistent lighting** — Top-left light source (135° angle)
- [ ] **No anti-aliasing** — Crisp pixel edges (except curved surfaces)
- [ ] **Max 3 shades per color** — Light, mid, dark (no more)
- [ ] **Flat shadows** — Darker solid color, not gradient
- [ ] **Readable at 1× zoom** — Details visible at target resolution

### Technical Requirements
- [ ] **PNG format** — With alpha transparency
- [ ] **Clean alpha channel** — No semi-transparent halos
- [ ] **Proper dimensions** — Multiple of 16 for furniture, 128×64 for floors
- [ ] **Optimized file size** — <10KB for small sprites, <50KB for large
- [ ] **Color palette compliance** — Uses only master palette colors
- [ ] **Correct isometric angle** — Matches 26.565° projection
- [ ] **Proper anchor point** — Bottom-center for sorting

### Pre-Export Checks
1. **Zoom to 400%** — Check for stray pixels
2. **Check transparency** — Load on checkerboard background
3. **Test on dark BG** — Ensure no white halos
4. **Verify dimensions** — Correct width×height
5. **Extract palette** — Confirm color count ≤ 12 per sprite

---

## 🛠️ Production Workflow

### Phase 1: Concept
1. Sketch rough idea (paper or digital)
2. Reference Habbo Hotel style examples
3. Choose color variants needed

### Phase 2: Generation
**Option A: AI Generation** (for furniture/props)
```bash
# Using Puter.js
node tools/puter-image-generator/index.mjs \
  --prompt "isometric pixel art [item], Habbo Hotel style, strong black outline, flat colors, no gradient" \
  --model gemini-2.5-flash-image-preview \
  --output assets/generated/[item].png
```

**Option B: Manual Creation** (for characters/unique items)
- Use LibreSprite or Piskel
- Start with base shape, add details last
- Work at 2× or 4× size, downscale with Nearest Neighbor

### Phase 3: Refinement
1. **Open in pixel editor** (LibreSprite)
2. **Fix perspective** — Adjust to match isometric rules
3. **Strengthen outlines** — Add black borders
4. **Reduce palette** — Flatten gradients to 2-3 colors
5. **Clean edges** — Remove stray pixels, fix alpha

### Phase 4: Integration
1. **Rename file** — Follow naming convention
2. **Save to correct folder:**
   - `client/assets/room-sprites/` — Furniture, objects
   - `client/assets/sprites/` — Characters, agents
   - `client/assets/generated/` — AI-generated (pre-cleanup)
3. **Update sprite manifest** (if exists)
4. **Test in-game** — Verify rendering at target resolution

### Phase 5: Batch Processing (if needed)
```bash
# Pack sprites into sprite sheet
npx free-tex-packer \
  --input client/assets/room-sprites \
  --output client/assets/sprite-sheets \
  --name furniture \
  --format json \
  --padding 2 \
  --trim
```

---

## 🚫 Common Mistakes (Anti-Patterns)

### ❌ Gradient Shading
**Problem:** Smooth gradients break pixel art style  
**Fix:** Use flat colors with hard-edged dithering (max 2-3 shades)

### ❌ Wrong Scaling Method
**Problem:** Blurry edges from bilinear interpolation  
**Fix:** ALWAYS use Nearest Neighbor (point sampling) when resizing

### ❌ Inconsistent Angles
**Problem:** Mix of isometric angles looks chaotic  
**Fix:** Use template grid, enforce 26.565° angle for all assets

### ❌ Over-Detailing
**Problem:** 64×64 sprite with 200 colors looks noisy  
**Fix:** Embrace minimalism — suggest detail with key pixels

### ❌ Transparency Issues
**Problem:** White halos around sprites on dark backgrounds  
**Fix:** Clean alpha edges, export PNG with proper transparency

### ❌ Ignoring Sprite Sheet Padding
**Problem:** Texture bleeding when GPU filters sprites  
**Fix:** Use 2px padding/margin in sprite sheet packer

---

## 📊 Quality Metrics

| Metric | Target | Check Method |
|--------|--------|-------------|
| File size | <10KB (small), <50KB (large) | `ls -lh *.png` |
| Color count | ≤12 per sprite | ImageMagick `-unique-colors` |
| Dimensions | Multiple of 16 | `file *.png` |
| Transparency | Clean alpha edges | Zoom 400%, check edges |
| Outline thickness | 1-2px black | Visual inspection |
| Isometric angle | 26.565° ± 1° | Overlay grid template |

---

## 🔗 Reference Assets

### Floor Tiles (Current)
- `floor_carpet.png` — 128×64, beige base
- `floor_stone.png` — 128×64, gray tiles
- `floor_wood.png` — 128×64, brown planks

### Furniture (Current)
- `chair.png` — 42×78, red upholstery
- `desk.png` — 116×122, brown wood
- `bed.png` — 215×190, large furniture

### Agents (Current, SVG format)
- `agent_dir0.svg` — South-facing
- `agent_dir2.svg` — Southwest
- `agent_dir4.svg` — West
- `agent_dir6.svg` — Northwest

---

## 🎯 Next Steps

1. **Extract actual colors** from existing assets → update palette.json
2. **Create template grid** — Isometric base for LibreSprite
3. **Build style test sheet** — Side-by-side good vs bad examples
4. **Automate quality checks** — Script to validate new assets
5. **Create sprite sheet manifest** — JSON metadata for all assets

---

**Last Updated:** 2026-02-16  
**Maintained By:** Aura (Pixel Artist subagent)  
**Questions?** Refer to `/Users/diegomcfly/clawd/brains/PIXEL-ARTIST-BRAIN.md`
