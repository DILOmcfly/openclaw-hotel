# OpenClaw Hotel Pixel Art Assets

This directory contains isometric pixel art assets for the OpenClaw Hotel client.

## Assets Generated

### Floor Tiles (64x32 isometric diamond)
- `floor_plain.png` - Plain floor tile
- `floor_carpet.png` - Carpeted floor tile with pattern
- `floor_checker.png` - Checkerboard floor tile

### Wall Tiles (64x64 isometric)
- `wall_left.png` - Left wall face
- `wall_right.png` - Right wall face
- `wall_corner.png` - Corner wall piece (both faces visible)

### Character Sprites (32x48 isometric)
Individual frames:
- `char_north.png` - Character facing north
- `char_south.png` - Character facing south
- `char_east.png` - Character facing east
- `char_west.png` - Character facing west

Combined spritesheet:
- `character_spritesheet.png` - 128x48 spritesheet with all 4 directions (horizontal layout)

### Furniture (various sizes)
- `furn_chair.png` - Isometric chair (32x40)
- `furn_table.png` - Isometric table (32x40)
- `furn_lamp.png` - Isometric lamp with glow (24x48)

### Sprite Atlas
- `sprites.json` - Pixi.js-compatible sprite atlas with frame coordinates and metadata

## Usage

Assets are loaded via `AssetLoader.ts` in the client source. The loader:
1. Fetches `sprites.json` for frame data
2. Loads individual PNG files
3. Creates sub-textures for spritesheet frames
4. Provides helper methods for accessing textures by type

Example:
```typescript
import { AssetLoader } from './AssetLoader.js';

// Load assets (call once at app startup)
await AssetLoader.load();

// Get textures
const floorTexture = AssetLoader.getFloorTexture('plain');
const charTexture = AssetLoader.getCharacterTexture(2); // 0=N, 1=E, 2=S, 3=W
const furnitureTexture = AssetLoader.getFurnitureTexture('chair');
```

## Generation

Assets are generated programmatically using:
- `scripts/generate-pixel-art.mjs` - Main asset generator
- `scripts/create-spritesheet.mjs` - Character spritesheet combiner
- `scripts/canvas-polyfill.mjs` - Pure JS PNG encoder (no native deps)

To regenerate:
```bash
node scripts/generate-pixel-art.mjs
node scripts/create-spritesheet.mjs
```

## Style Guide

- **Palette**: Habbo-inspired but original colors
- **Format**: PNG with transparency
- **Style**: Pixel art, 16-32px base scaled to isometric dimensions
- **Consistency**: All sprites use black (#000000) outlines for clarity
