# OpenClaw Hotel — Procedural Pixel Art Sprites

## Overview
This directory contains a Node.js script that generates pixel art game assets using the `canvas` npm package. All sprites are generated procedurally with crisp pixel art (no anti-aliasing) in isometric perspective, inspired by Habbo Hotel's visual style.

## Generated Sprites

### Floor Tiles (64x32 isometric diamonds)
- `floor_wood.png` — Warm brown wooden planks with grain details
- `floor_stone.png` — Grey stone tiles with tiled pattern
- `floor_carpet.png` — Dark red carpet with subtle texture
- `floor_grass.png` — Green grass with random blade details

### Wall Segments (32x64)
- `wall_default.png` — Beige/cream wall with vertical texture and baseboard
- `wall_brick.png` — Red brick wall with mortar pattern

### Agent Sprites (32x48 front-facing)
- `agent_default.png` — Simple humanoid character with OpenClaw accent color
- `agent_blue.png` — Blue variant
- `agent_red.png` — Red variant
- `agent_green.png` — Green variant

All agents feature:
- Habbo-style blocky pixel art design
- Head with hair and facial features
- Body with clothing
- Shadow beneath feet

### Furniture (various sizes)
- `chair.png` (24x32) — Simple wooden chair with isometric perspective
- `table.png` (48x32) — Wooden table with four legs
- `plant.png` (24x40) — Potted plant with multiple leaves
- `computer.png` (32x40) — Desktop computer with monitor displaying OpenClaw green

## Color Palette
All sprites use a consistent, exact color palette:

```javascript
Wood: #8B6914, #A0792C, #6B4F12
Stone: #808080, #A0A0A0, #606060
Carpet: #8B1A1A, #A02020, #6B1010
Grass: #2E8B57, #3CB371, #1E6B37
Walls: #D2B48C, #C4A882, #E0C8A0
Brick: #B22222, #8B1A1A, #CD5C5C
Skin: #FFD4B2, #FFBD94
Clothes (Blue): #4169E1, #1E3A8A
Clothes (Red): #DC2626, #991B1B
Clothes (Green): #16A34A, #0D6B2C
Accent (OpenClaw): #00D4AA
```

## Usage

### Generate Sprites
```bash
npm install canvas  # If not already installed
node tools/generate-sprites.mjs
```

All sprites are saved to `client/assets/sprites/` as PNG files with transparency.

### Integration
The `client/spectate.html` file has been updated to load sprites from `/assets/sprites/` directory. The sprite loader will gracefully handle missing sprites by logging warnings.

## Technical Details

- **Rendering Engine**: Node.js Canvas (cairo-based)
- **Anti-aliasing**: Disabled (`ctx.imageSmoothingEnabled = false`)
- **Perspective**: Isometric (2:1 ratio for floor tiles)
- **Format**: PNG with alpha channel
- **File Sizes**: Optimized for pixel art (typically < 1 KB per sprite)

## Requirements
- Node.js v14+ 
- `canvas` npm package (automatically handles native dependencies)

## Script Architecture

The generator is organized into sections:
1. **Helpers**: Isometric diamond drawing, pattern generation
2. **Floor Tiles**: Each tile type has its own generator function
3. **Walls**: Procedural brick patterns and gradients
4. **Agents**: Parameterized character generation with color variants
5. **Furniture**: Individual generators for each furniture piece
6. **Main Generator**: Orchestrates all sprite generation

Each sprite is generated fresh on every run, ensuring consistency and reproducibility.

## Git Commit
```
feat: procedural pixel art sprites for all game assets
```

14 sprites generated successfully, all validated as proper PNG files.
