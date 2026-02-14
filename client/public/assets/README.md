# Asset Management

## Asset Structure

All visual assets for OpenClaw Hotel are organized in this directory.

### File Naming Convention

Each sprite type exists in **two versions**:

1. **Base version** (`sprite_name.png`) — Small placeholder (32-64px)
2. **Gemini version** (`sprite_name_gemini.png`) — AI-generated high-quality (1024×1024)

**Example:**
- `char_east.png` — 32×48 placeholder
- `char_east_gemini.png` — 1024×1024 AI render (auto-scaled to 32×48 in-game)

### Asset Types

| Type | Prefix | Dimensions (base) | Dimensions (Gemini) |
|------|--------|-------------------|---------------------|
| **Characters** | `char_` | 32×48 | 1024×1024 → 32×48 |
| **Floors** | `floor_` | 64×32 | 1024×1024 → 64×32 |
| **Walls** | `wall_` | 32×64 | 1024×1024 → 32×64 |
| **Furniture** | `furn_` | 48×64 | 1024×1024 → 48×64 |

### Loading Strategy

`AssetLoader.ts` implements a **fallback system**:

```typescript
1. Try to load {name}_gemini.png
2. If successful → scale down to game size
3. If not found → fallback to {name}.png
4. If not found → create placeholder graphic
```

This ensures:
- **Quality**: Gemini assets are used when available
- **Reliability**: Base versions serve as fallback
- **Graceful degradation**: Missing assets don't break the game

### Spritesheets

Some assets are bundled into spritesheets for efficiency:

- `character_spritesheet.png` — All 4 character directions (north, south, east, west)
- `walls_spritesheet_gemini.png` — All wall pieces

Spritesheet frames are defined in `sprites.json`.

### Legacy Assets

The following directories contain **unused** legacy assets:

- `/client/assets/sprites/*.svg` — Original SVG placeholders (pre-PNG migration)

These are kept for reference but **not loaded** by the game.

---

## Asset Credits

All Gemini-generated assets created using:

**AI Model**: Google Gemini 2.0 Flash Experimental  
**Style**: Isometric pixel art, low-poly 3D render aesthetic  
**Generation Date**: February 2026

---

## Adding New Assets

To add a new sprite:

1. Generate high-quality version with Gemini AI
2. Save as `{type}_{name}_gemini.png` (1024×1024)
3. Create small placeholder `{type}_{name}.png` (appropriate size)
4. Add entry to `sprites.json` if using spritesheet
5. Update `AssetLoader.ts` getter methods if needed

The loader will automatically prefer the `_gemini` version and scale it appropriately.
