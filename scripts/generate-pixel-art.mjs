/**
 * T-041: Generate pixel art PNG assets for OpenClaw Hotel
 * Pure JavaScript approach — no native dependencies
 * Creates isometric pixel art tiles, walls, characters, and furniture
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from './canvas-polyfill.mjs';

const ASSETS_DIR = join(import.meta.dirname, '..', 'client', 'public', 'assets');
mkdirSync(ASSETS_DIR, { recursive: true });

// Habbo-inspired color palette
const PALETTE = {
  // Floors
  tile_plain: '#E0E0E0',
  tile_carpet: '#9C27B0',
  tile_checker_a: '#BDBDBD',
  tile_checker_b: '#757575',
  
  // Walls
  wall_left: '#8D6E63',
  wall_right: '#6D4C41',
  wall_dark: '#5D4037',
  
  // Character
  char_body: '#42A5F5',
  char_skin: '#FFCCBC',
  char_hair: '#795548',
  char_shadow: 'rgba(0,0,0,0.3)',
  
  // Furniture
  wood: '#8D6E63',
  wood_dark: '#5D4037',
  metal: '#78909C',
  fabric: '#1565C0',
  lamp_shade: '#FFD54F',
  lamp_light: '#FFF9C4',
  plant_pot: '#795548',
  plant_leaf: '#4CAF50',
  
  // Outlines
  outline: '#000000'
};

/**
 * Create an isometric floor tile (64x32 diamond)
 */
function createFloorTile(type) {
  const canvas = createCanvas(64, 32);
  const ctx = canvas.getContext('2d');
  
  // Draw diamond shape
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(64, 16);
  ctx.lineTo(32, 32);
  ctx.lineTo(0, 16);
  ctx.closePath();
  
  // Fill based on type
  switch (type) {
    case 'plain':
      ctx.fillStyle = PALETTE.tile_plain;
      ctx.fill();
      break;
      
    case 'carpet':
      ctx.fillStyle = PALETTE.tile_carpet;
      ctx.fill();
      // Add pattern
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(16 + i * 8, 12, 4, 8);
      }
      break;
      
    case 'checker':
      // Checkerboard pattern
      ctx.fillStyle = PALETTE.tile_checker_a;
      ctx.fill();
      ctx.save();
      ctx.clip();
      
      ctx.fillStyle = PALETTE.tile_checker_b;
      const size = 8;
      for (let y = 0; y < 32; y += size) {
        for (let x = 0; x < 64; x += size) {
          if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
            ctx.fillRect(x, y, size, size);
          }
        }
      }
      ctx.restore();
      break;
  }
  
  // Outline
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  return canvas;
}

/**
 * Create an isometric wall tile (64x64)
 */
function createWallTile(side) {
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext('2d');
  
  if (side === 'left') {
    // Left wall face
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(0, 48);
    ctx.lineTo(32, 64);
    ctx.lineTo(32, 32);
    ctx.closePath();
    ctx.fillStyle = PALETTE.wall_left;
    ctx.fill();
    
    // Brick texture
    ctx.strokeStyle = PALETTE.wall_dark;
    ctx.lineWidth = 1;
    for (let y = 20; y < 60; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(32 * (64 - y) / 48, y + (64 - y) / 3);
      ctx.stroke();
    }
    
  } else if (side === 'right') {
    // Right wall face
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(32, 64);
    ctx.lineTo(64, 48);
    ctx.lineTo(64, 16);
    ctx.closePath();
    ctx.fillStyle = PALETTE.wall_right;
    ctx.fill();
    
    // Brick texture
    ctx.strokeStyle = PALETTE.wall_dark;
    ctx.lineWidth = 1;
    for (let y = 20; y < 60; y += 8) {
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.lineTo(32 + (64 - y) / 3, y + (64 - y) / 3);
      ctx.stroke();
    }
    
  } else if (side === 'corner') {
    // Corner piece (both faces)
    // Left face
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(0, 48);
    ctx.lineTo(32, 64);
    ctx.lineTo(32, 32);
    ctx.closePath();
    ctx.fillStyle = PALETTE.wall_left;
    ctx.fill();
    
    // Right face
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(32, 64);
    ctx.lineTo(64, 48);
    ctx.lineTo(64, 16);
    ctx.closePath();
    ctx.fillStyle = PALETTE.wall_right;
    ctx.fill();
    
    // Top face
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(64, 16);
    ctx.lineTo(32, 32);
    ctx.lineTo(0, 16);
    ctx.closePath();
    ctx.fillStyle = PALETTE.wall_left;
    ctx.fill();
  }
  
  // Outline
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  return canvas;
}

/**
 * Create a character sprite frame (32x48)
 */
function createCharacterFrame(direction) {
  const canvas = createCanvas(32, 48);
  const ctx = canvas.getContext('2d');
  
  // Shadow
  ctx.fillStyle = PALETTE.char_shadow;
  ctx.beginPath();
  ctx.ellipse(16, 44, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body (isometric view)
  ctx.fillStyle = PALETTE.char_body;
  ctx.fillRect(10, 20, 12, 18);
  
  // Head
  ctx.fillStyle = PALETTE.char_skin;
  ctx.beginPath();
  ctx.arc(16, 14, 7, 0, Math.PI * 2);
  ctx.fill();
  
  // Hair
  ctx.fillStyle = PALETTE.char_hair;
  ctx.beginPath();
  ctx.arc(16, 10, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  
  // Eyes based on direction
  ctx.fillStyle = '#000';
  const eyeOffsets = {
    north: [{ x: 13, y: 14 }, { x: 19, y: 14 }],
    south: [{ x: 13, y: 16 }, { x: 19, y: 16 }],
    east: [{ x: 18, y: 14 }, { x: 20, y: 14 }],
    west: [{ x: 12, y: 14 }, { x: 14, y: 14 }]
  };
  
  const eyes = eyeOffsets[direction] || eyeOffsets.south;
  eyes.forEach(eye => {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Outline
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 20, 12, 18);
  ctx.beginPath();
  ctx.arc(16, 14, 7, 0, Math.PI * 2);
  ctx.stroke();
  
  return canvas;
}

/**
 * Create furniture sprite
 */
function createFurniture(type) {
  let canvas, ctx;
  
  switch (type) {
    case 'chair':
      canvas = createCanvas(32, 40);
      ctx = canvas.getContext('2d');
      
      // Seat
      ctx.fillStyle = PALETTE.wood;
      ctx.fillRect(8, 20, 16, 4);
      
      // Legs
      ctx.fillRect(8, 24, 3, 12);
      ctx.fillRect(21, 24, 3, 12);
      
      // Back
      ctx.fillRect(8, 8, 4, 16);
      
      // Outlines
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 20, 16, 4);
      ctx.strokeRect(8, 24, 3, 12);
      ctx.strokeRect(21, 24, 3, 12);
      ctx.strokeRect(8, 8, 4, 16);
      break;
      
    case 'table':
      canvas = createCanvas(32, 40);
      ctx = canvas.getContext('2d');
      
      // Tabletop
      ctx.fillStyle = PALETTE.wood_dark;
      ctx.fillRect(4, 16, 24, 4);
      
      // Legs
      ctx.fillRect(6, 20, 3, 16);
      ctx.fillRect(23, 20, 3, 16);
      
      // Outlines
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 16, 24, 4);
      ctx.strokeRect(6, 20, 3, 16);
      ctx.strokeRect(23, 20, 3, 16);
      break;
      
    case 'lamp':
      canvas = createCanvas(24, 48);
      ctx = canvas.getContext('2d');
      
      // Base
      ctx.fillStyle = PALETTE.metal;
      ctx.fillRect(10, 40, 4, 6);
      
      // Pole
      ctx.fillRect(11, 16, 2, 24);
      
      // Shade
      ctx.fillStyle = PALETTE.lamp_shade;
      ctx.beginPath();
      ctx.moveTo(6, 16);
      ctx.lineTo(18, 16);
      ctx.lineTo(14, 6);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();
      
      // Light glow
      ctx.fillStyle = PALETTE.lamp_light;
      ctx.beginPath();
      ctx.arc(12, 10, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Outlines
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 40, 4, 6);
      ctx.strokeRect(11, 16, 2, 24);
      ctx.beginPath();
      ctx.moveTo(6, 16);
      ctx.lineTo(18, 16);
      ctx.lineTo(14, 6);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.stroke();
      break;
      
    default:
      canvas = createCanvas(32, 32);
      ctx = canvas.getContext('2d');
      ctx.fillStyle = '#CCC';
      ctx.fillRect(0, 0, 32, 32);
  }
  
  return canvas;
}

/**
 * Generate all assets
 */
function generateAssets() {
  console.log('Generating pixel art assets...\n');
  
  // Floor tiles
  console.log('Floor tiles:');
  ['plain', 'carpet', 'checker'].forEach(type => {
    const canvas = createFloorTile(type);
    const path = join(ASSETS_DIR, `floor_${type}.png`);
    writeFileSync(path, canvas.toBuffer());
    console.log(`  ✓ floor_${type}.png (64x32)`);
  });
  
  // Wall tiles
  console.log('\nWall tiles:');
  ['left', 'right', 'corner'].forEach(side => {
    const canvas = createWallTile(side);
    const path = join(ASSETS_DIR, `wall_${side}.png`);
    writeFileSync(path, canvas.toBuffer());
    console.log(`  ✓ wall_${side}.png (64x64)`);
  });
  
  // Character sprites
  console.log('\nCharacter sprites:');
  const directions = ['north', 'south', 'east', 'west'];
  directions.forEach(dir => {
    const canvas = createCharacterFrame(dir);
    const path = join(ASSETS_DIR, `char_${dir}.png`);
    writeFileSync(path, canvas.toBuffer());
    console.log(`  ✓ char_${dir}.png (32x48)`);
  });
  
  // Furniture
  console.log('\nFurniture:');
  ['chair', 'table', 'lamp'].forEach(type => {
    const canvas = createFurniture(type);
    const path = join(ASSETS_DIR, `furn_${type}.png`);
    writeFileSync(path, canvas.toBuffer());
    console.log(`  ✓ furn_${type}.png`);
  });
  
  // Generate sprite atlas JSON for Pixi.js
  console.log('\nGenerating Pixi.js atlas...');
  generatePixiAtlas();
  
  console.log('\n✅ All assets generated successfully!');
}

/**
 * Generate Pixi.js-compatible sprite atlas JSON
 */
function generatePixiAtlas() {
  const atlas = {
    frames: {
      // Floor tiles
      'floor_plain.png': { frame: { x: 0, y: 0, w: 64, h: 32 }, sourceSize: { w: 64, h: 32 } },
      'floor_carpet.png': { frame: { x: 0, y: 0, w: 64, h: 32 }, sourceSize: { w: 64, h: 32 } },
      'floor_checker.png': { frame: { x: 0, y: 0, w: 64, h: 32 }, sourceSize: { w: 64, h: 32 } },
      
      // Walls
      'wall_left.png': { frame: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 } },
      'wall_right.png': { frame: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 } },
      'wall_corner.png': { frame: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 } },
      
      // Characters
      'char_north.png': { frame: { x: 0, y: 0, w: 32, h: 48 }, sourceSize: { w: 32, h: 48 } },
      'char_south.png': { frame: { x: 0, y: 0, w: 32, h: 48 }, sourceSize: { w: 32, h: 48 } },
      'char_east.png': { frame: { x: 0, y: 0, w: 32, h: 48 }, sourceSize: { w: 32, h: 48 } },
      'char_west.png': { frame: { x: 0, y: 0, w: 32, h: 48 }, sourceSize: { w: 32, h: 48 } },
      
      // Furniture
      'furn_chair.png': { frame: { x: 0, y: 0, w: 32, h: 40 }, sourceSize: { w: 32, h: 40 } },
      'furn_table.png': { frame: { x: 0, y: 0, w: 32, h: 40 }, sourceSize: { w: 32, h: 40 } },
      'furn_lamp.png': { frame: { x: 0, y: 0, w: 24, h: 48 }, sourceSize: { w: 24, h: 48 } }
    },
    meta: {
      app: 'OpenClaw Hotel Asset Generator',
      version: '1.0',
      format: 'RGBA8888',
      size: { w: 512, h: 512 }
    }
  };
  
  const atlasPath = join(ASSETS_DIR, 'sprites.json');
  writeFileSync(atlasPath, JSON.stringify(atlas, null, 2));
  console.log('  ✓ sprites.json');
}

// Run generation
generateAssets();
