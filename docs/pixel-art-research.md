# Professional Isometric Pixel Art Research
## Research Date: 2026-02-14

---

## 1. ISOMETRIC PIXEL ART FUNDAMENTALS

### 1.1 The 2:1 Rule (Foundation of Iso Pixel Art)
- **True isometric**: 30° angles (mathematically accurate)
- **Pixel art isometric**: 2:1 pixel ratio (~26.5°) - creates smoother lines without jaggies
- **All ground-plane parallel lines** follow this 2x horizontal, 1y vertical pattern
- This is the CORE principle - everything builds from 2:1 lines

### 1.2 Construction Methodology
1. **Start with boxes**: Contain organic forms in isometric boxes to ensure consistency
2. **Use construction lines**: Measure carefully, count pixels precisely
3. **Don't trust your eyes**: Use rulers and grids - verify everything aligns to 2:1
4. **Even dimensions preferred**: Makes tiling and alignment easier

### 1.3 Common Tile Sizes
- 32×16 (small, less detail)
- 36×18 (medium)
- 48×24 (medium-high)
- 64×32 (high detail - RECOMMENDED for quality)
- 128×64 (very high detail, less "pixel art" feel)

**Recommendation**: Use 64×32 for floor tiles, allows rich textures while maintaining pixel art aesthetic

---

## 2. HABBO HOTEL STYLE ANALYSIS

### 2.1 Core Characteristics
Based on Reddit community analysis and visual study:

**Defining Features:**
- **Near-isometric projection** (follows 2:1 rule closely)
- **STRONG BLACK OUTLINES** (signature element - 1-2px thick)
- **Flat color zones** with selective shading
- **Simple shadows** (usually 2-3 tones max)
- **NO gradients** - discrete color steps only
- **High level of detail** in small sprites
- **Cute, squat proportions** for characters

### 2.2 Character Specs (Habbo Avatar)
- Approximate size: 32×48 to 40×56 pixels
- 4 directional sprites needed (NE, SE, SW, NW diagonals)
- Large head-to-body ratio (cute proportions)
- Simple facial features (eyes, sometimes nose)
- Hair as distinct color blocks
- Clothing with minimal folds
- **Shadow blob** underneath character (flat oval, semi-transparent)

### 2.3 Furniture Style
- Clear silhouettes with black outlines
- 2-3 shades per color family
- Textural details via pixel patterns, NOT dithering
- Cast shadows: simple, directional
- Reflective surfaces: single highlight color

### 2.4 Color Palette Strategy
- **Curated palettes** (not full RGB)
- Typically 3-5 shades per hue:
  - Deep shadow
  - Shadow
  - Base color
  - Highlight
  - (Optional) Specular highlight
- High saturation for appeal
- Warm palette bias (inviting feel)

---

## 3. ADVANCED TECHNIQUES

### 3.1 Dithering (Use Sparingly!)
**What it is**: Checkerboard patterns of two colors to create perceived intermediate color

**Common patterns** (from least to most "mixed"):
```
50% checker:  A B    25% A:     A . .    75% A:    A B A
              B A               . . .              A A A
                                . . B              A A B

Diagonal:     A . .    Noise:    A . B
              . B .              . A .
              . . B              B . A
```

**When to use**:
- Fill dithering: Creating extra colors in 1-bit or very limited palettes
- Transitional dithering: Smooth gradients in high-res painterly work
- Texture: Dirt, grime, fabric grain (sparingly!)

**When NOT to use** (Habbo style):
- General shading (use solid color zones instead)
- Character sprites (creates visual noise)
- Small objects (loses form definition)

**Habbo approach**: Minimal to zero dithering. They prefer clean color blocks with sharp transitions.

### 3.2 Anti-Aliasing (Manual)
**Purpose**: Smooth diagonal/curved edges without blur

**Technique**:
- Place intermediate color pixels at "stair-step" transitions
- Usually 1 pixel wide
- Color should be between foreground and background
- Don't overdo it - can make art look blurry

**Habbo style**: Uses AA very selectively, often prefers crisp black outlines over AA

### 3.3 Selective Outlining (Sel-Out)
**Instead of pure black outlines**, color them based on:
- The fill color they border (slightly darker/desaturated version)
- The lighting (outlines on light side → lighter, shadow side → darker)

**Habbo mostly uses black** but occasionally darkens to dark brown/navy

### 3.4 Shading Philosophy
**Form shading** (shows 3D shape):
- Identify light source (typically top-left or top-right in iso)
- Top face = lightest (receives most light)
- Left/right faces = base and shadow tones
- Edge highlights on top edges
- Contact shadows where objects meet surfaces

**Multi-tone approach** (CRITICAL for quality):
```
Minimum 3 tones:      Better 4 tones:        Professional 5+ tones:
- Highlight           - Specular highlight   - Specular
- Base                - Highlight            - Bright highlight  
- Shadow              - Base                 - Highlight
                      - Shadow               - Base
                                             - Shadow
                                             - Deep shadow/outline
```

### 3.5 Texture Techniques (Non-Dither)
**Wood grain**:
- Base color
- Lighter streak lines (2-3 pixels wide, organic curves)
- Darker knots/grain (1-2 pixels, scattered)
- Follow isometric angle

**Carpet pattern**:
- Repeating geometric motifs (diamonds, dots, stripes)
- 2-3 colors max
- Aligned to isometric grid

**Marble**:
- Base color
- Lighter veins (irregular, branching lines)
- Slight color variation zones
- Subtle specular highlights

**Metal/reflective**:
- High contrast between highlight and base
- Sharp, small highlight areas
- Potentially colored reflection tints

---

## 4. CASTING SHADOWS IN ISO

### 4.1 Shadow Geometry
**No vanishing point** = shadows are easier than perspective!

**Method**:
1. Choose light angle (typically 45° horizontal = aligns to iso grid nicely)
2. Choose light height (affects shadow length)
3. Project lines from bottom edges of object at consistent angle
4. Connect endpoints to form shadow shape

**Habbo approach**:
- Mostly horizontal shadows (light from above-right or above-left)
- Short shadows (high light angle)
- Simple shapes (approximate with bounding box)
- Semi-transparent dark gray or dark blue
- Often a soft edge (1px lighter border)

### 4.2 Ambient Occlusion (Contact Shadows)
- Darkest pixels right where object touches surface
- 1-2 pixel width
- Makes objects "sit" properly on ground

---

## 5. DRAWING COMPLEX SHAPES IN ISO

### 5.1 Circles/Ellipses
- **Contain in isometric square grid**
- Vertices (ends of major axis) contain most shape info - get these right!
- Check negative space symmetry
- For small circles: approximate, test visually

### 5.2 Rotated Objects (Not Aligned to Grid)
- Draw flat/front view first
- Use construction grid to map points
- Skew to isometric angle
- Clean up pixel-by-pixel

### 5.3 Organic Forms (Characters, Plants)
- Start with basic geometric primitives (cylinders, spheres as iso boxes)
- Sketch freely first (don't stress perfection)
- Refine with construction lines to ensure iso consistency
- Characters can break iso rules slightly for appeal (e.g., front-facing eyes)

---

## 6. EDGE DEFINITION & CUBE RENDERING STYLES

### 6.1 Iso Cube Variations
Many valid ways to render an iso cube:

**Style A** (Sharp corners):
```
  /\
 /  \
/____\
\    /
 \  /
  \/
```
- 2px corners top/bottom
- Clean, geometric
- Tiles perfectly with slight tangents

**Style B** (Wide corners - Habbo-like):
```
  __
 /  \
/    \
\    /
 \__/
```
- 4px flat edges top/bottom
- Softer, more approachable
- Requires careful overlap for tiling

**Outline decisions**:
- Black outlines: Bold, clear, cartoonish
- No outlines: Clean tiling, can look flat
- Sel-out: Sophisticated, softer

**Habbo uses Style B with black outlines**

### 6.2 Inner Lines
- **Avoid visible inner lines** - they break 3D illusion
- Exception: intentional panel lines, planks, etc. (part of design)

### 6.3 Ground Connection
- Lightening/removing outline where object meets ground = appears flush
- Keeping dark outline = appears raised/separate/interactable

---

## 7. PROGRAMMATIC GENERATION WITH PYTHON/PILLOW

### 7.1 Pillow Capabilities
**Installed version**: 12.1.0 ✓

**Core functions for pixel art**:
```python
from PIL import Image, ImageDraw

# Create image
img = Image.new('RGBA', (width, height), (0, 0, 0, 0))

# Pixel-perfect drawing
draw = ImageDraw.Draw(img)
draw.point((x, y), fill=(r, g, b, a))  # Single pixel
draw.line([(x1,y1), (x2,y2)], fill=color, width=1)
draw.polygon([points], fill=color, outline=outline_color)

# Direct pixel access (FAST)
pixels = img.load()
pixels[x, y] = (r, g, b, a)

# Save
img.save('output.png', 'PNG')
```

**Anti-aliasing**: NEVER use Pillow's built-in AA for pixel art (creates blur)
- Use `width=1` for lines
- Manual AA via intermediate color pixels

### 7.2 Generation Strategy
**NOT**: Draw with high-level shapes and scale down
**YES**: Pixel-by-pixel control with helper functions

**Helper functions needed**:
```python
def iso_line_2_1(start_x, start_y, length, direction):
    """Draw 2:1 isometric line (right/left)"""
    
def iso_box(top_left, width, depth, height, colors):
    """Draw isometric box with 3 faces"""
    
def fill_with_pattern(polygon, pattern_func):
    """Fill area with texture pattern"""
    
def add_shading(face_pixels, light_dir, tone_map):
    """Apply multi-tone shading to face"""
```

### 7.3 Texture Generation Patterns
**Wood grain**:
```python
def wood_texture(width, height, base_color, grain_colors):
    # Perlin-like noise (simple grid + randomness)
    # Stretch horizontally for grain
    # Add knots (small dark clusters)
    # Follow 2:1 angle for iso faces
```

**Carpet pattern**:
```python
def carpet_pattern(width, height, colors, motif='diamond'):
    # Repeating geometric tiles
    # Aligned to isometric grid
    # 2-3 color palette
```

### 7.4 Color Palette Generation
```python
def generate_tone_ramp(base_color, num_tones=4):
    """Create highlight → base → shadow ramp"""
    h, s, v = rgb_to_hsv(base_color)
    tones = []
    for i in range(num_tones):
        factor = 0.5 + (i / (num_tones - 1)) * 0.8  # 0.5 to 1.3
        new_v = min(255, int(v * factor))
        # Slightly desaturate shadows
        new_s = s if factor > 1 else int(s * (0.7 + factor * 0.3))
        tones.append(hsv_to_rgb(h, new_s, new_v))
    return tones
```

---

## 8. VALIDATION CRITERIA

### 8.1 File Size Check
- **Target**: 1-2 KB minimum per sprite (indicates real detail)
- Current placeholders: 150-370 bytes ❌
- Proper sprites with textures/shading: 1-3 KB ✓

### 8.2 Visual Tests
1. **1x scale**: Should be crisp, readable, appealing
2. **2x scale**: Texture patterns should be visible but not noisy
3. **4x scale**: Individual pixel art choices should look intentional
4. **Tiling test** (for floors/walls): No jarring seams
5. **Consistency**: All sprites should feel part of same "world"

### 8.3 Technical Tests
- No anti-aliased blurs
- No gradients (discrete color steps only)
- Isometric alignment (2:1 rule followed)
- Proper transparency (no white halos)
- Power-of-2 friendly dimensions (for GPU optimization)

---

## 9. ASSET SPECIFICATIONS FOR OPENCLAW HOTEL

### 9.1 Floor Tiles (64×32)
**Plain wood**:
- Base: Warm brown (#8B6F47)
- Grain: Lighter streaks + darker knots
- Planks: Subtle horizontal divisions
- 4-tone palette minimum

**Carpet**:
- Base: Rich red or blue
- Pattern: Geometric (Persian-style or simple diamonds)
- 3-tone palette
- Subtle pile texture (non-dithered)

**Marble**:
- Base: White or cream
- Veins: Gray organic branches
- Slight color variation zones
- High specular highlights
- 4-tone palette

**Grass**:
- Base: Mid green
- Texture: Small irregular patches of lighter/darker green
- Tiny "blade" details
- 4-tone palette

### 9.2 Wall Tiles (64×96+)
**Left wall**:
- Vertical orientation
- Moldure/baseboard at bottom
- Subtle texture (painted plaster or wallpaper pattern)
- 3-4 tones

**Right wall**:
- Mirror of left
- Consistent lighting

**Corner**:
- Intersection of left/right
- 3-face visibility
- Shadow in inside corner

### 9.3 Character (32×48 minimum, could go 40×56 for more detail)
**Features**:
- Large head (1/3 to 1/2 of height)
- Simple facial features (dot eyes, maybe nose)
- Distinct hairstyle (color block)
- Torso with clothing
- Legs (slightly bent for cuteness)
- **4 directions**: NE, SE, SW, NW
- Drop shadow: Oval blob underneath, 50% opacity

**Color zones**:
- Skin: 3 tones
- Hair: 2-3 tones
- Clothing: 3-4 tones each item
- Outline: Black (1px)

### 9.4 Furniture
**Chair**:
- Seat: Cushioned (3 tones - shows roundness)
- Legs: Simple, 2 tones
- Back: Vertical slats or solid
- Cast shadow on ground

**Table**:
- Top surface: Flat, with specular highlight (shows material)
- Legs: 4 visible, consistent perspective
- 3-4 tones
- Possible reflection underneath if shiny

**Lamp**:
- Base: Solid, 2-3 tones
- Shade: Semi-transparent look (lighter tones)
- Bulb/light source: Bright yellow/white pixel(s)
- **Glow effect**: Lighter pixels radiating outward (2-3 pixel radius)

**Bed**:
- Mattress: Soft shading, 4 tones
- Pillow: Distinct shape, lighter tones
- Frame: Wood or metal, 3 tones
- Blanket texture: Subtle folds

**Bookshelf**:
- Shelves: Horizontal divisions
- Books: Colorful spines (varied heights, colors)
- Frame: Wood, 3 tones
- Depth: Shadow in back

### 9.5 Spritesheet Atlas (JSON for Pixi.js)
Format:
```json
{
  "frames": {
    "floor_wood.png": {
      "frame": {"x": 0, "y": 0, "w": 64, "h": 32},
      "sourceSize": {"w": 64, "h": 32},
      "spriteSourceSize": {"x": 0, "y": 0, "w": 64, "h": 32}
    },
    "char_north.png": {
      "frame": {"x": 64, "y": 0, "w": 32, "h": 48},
      "sourceSize": {"w": 32, "h": 48},
      "spriteSourceSize": {"x": 0, "y": 0, "w": 32, "h": 48}
    }
    // ... etc
  },
  "meta": {
    "image": "spritesheet.png",
    "format": "RGBA8888",
    "size": {"w": 512, "h": 512},
    "scale": "1"
  }
}
```

---

## 10. RECOMMENDED WORKFLOW

### Phase 1: Setup
1. Define color palettes (per material/element)
2. Create helper functions (iso lines, boxes, shading)
3. Test with simple cube

### Phase 2: Floors (Easiest)
1. Wood (teaches grain textures)
2. Carpet (teaches patterns)
3. Marble (teaches veins)
4. Grass (teaches organic randomness)

### Phase 3: Walls (Medium)
1. Basic wall faces
2. Add molding/detail
3. Corner pieces
4. Test tiling

### Phase 4: Furniture (Medium-Hard)
1. Chair (good learning piece - all elements present)
2. Table (teaches reflections)
3. Lamp (teaches glow)
4. Bed (teaches soft goods)
5. Bookshelf (teaches repetition with variation)

### Phase 5: Character (Hardest)
1. Front view sketch
2. Convert to isometric
3. 4 directions
4. Shadow blob
5. Test walking animation (optional but cool)

### Phase 6: Atlas
1. Arrange all sprites in power-of-2 texture (512×512 or 1024×1024)
2. Generate JSON coordinates
3. Validate with Pixi.js loader

---

## 11. INSPIRATION & REFERENCES

### Key Artists/Games
- **Habbo Hotel** (2000) - The gold standard for cute isometric social spaces
- **eBoy** - Intricate isometric pixel cities
- **Fool/Foolstown** - Beautiful detailed iso environments
- **Stardew Valley** - Mix of iso and top-down (for furniture ideas)

### Modern Pixel Artists Using Iso
- @pixelhenk (Henk Nieborg) - Veteran, incredible detail
- @slynyrd (Raymond Schlitter) - Excellent tutorials
- @pixelparmesan - Deep technical knowledge
- @curemoto_dot, @konaki_579 (Japanese dotpict scene) - Creative dithering use

### Tools Habbo Developers Used (Historic)
- Adobe Photoshop (primary)
- Custom sprite pipeline
- Manual pixel-by-pixel work (no AI, no fancy filters)
- Strong art direction (style guide enforcement)

---

## 12. QUALITY BENCHMARKS

### Current State
- ❌ 150-370 byte PNGs
- ❌ Flat color rectangles
- ❌ No textures
- ❌ No shading
- ❌ No outlines
- ❌ Minimal detail

### Target State (SUPERIOR to Habbo)
- ✅ 1-3 KB PNGs (rich detail)
- ✅ Multi-tone shading (4+ tones per element)
- ✅ Texture patterns (wood grain, carpet motifs, marble veins)
- ✅ Strong black outlines (Habbo signature)
- ✅ Proper isometric construction (2:1 rule)
- ✅ Cast shadows and AO
- ✅ Specular highlights
- ✅ Glow effects (lamp)
- ✅ Character personality (hair, clothing, pose)

### Why We Can Do Better Than 2000 Habbo
1. **More pixels available**: Modern displays support higher res sprites
2. **Better tools**: Pillow + Python = precise programmatic control
3. **More color depth**: Not limited to 256-color palettes
4. **Pixel-perfect rendering**: Modern engines (Pixi.js) respect exact pixels
5. **26 years of pixel art evolution**: Techniques refined, best practices known
6. **No technical limitations**: RAM, storage, bandwidth = non-issues

**Our advantage**: Combine Habbo's iconic style with modern quality standards.

---

## CONCLUSION

Professional isometric pixel art is:
- **Precise**: Every pixel counted, 2:1 rule followed
- **Structured**: Construction lines, boxes, grids
- **Textured**: Patterns, grain, veins - not flat colors
- **Shaded**: Multi-tone (4+ tones), form-defining
- **Outlined**: Strong, consistent (black for Habbo style)
- **Detailed**: Small touches that surprise (reflections, glows, shadows)

**Habbo Hotel's genius**: Cute, approachable style + incredible detail in tiny sprites + strong consistent art direction = timeless appeal.

**Our mission**: Take that formula, apply 26 years of pixel art advancement, generate programmatically with Pillow for perfect consistency, and create assets that make players go "wow, this is even better than I remembered Habbo being!"

---

**Next Steps**: Generate assets using this research. Quality over speed. Every pixel matters.
