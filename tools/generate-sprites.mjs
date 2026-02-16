#!/usr/bin/env node
/**
 * OpenClaw Hotel — Procedural Pixel Art Sprite Generator
 * Generates isometric pixel art game assets using Node.js Canvas
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'client', 'assets', 'sprites');

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

// Color Palette
const COLORS = {
  // Wood colors
  WOOD_BASE: '#8B6914',
  WOOD_LIGHT: '#A0792C',
  WOOD_DARK: '#6B4F12',
  
  // Stone colors
  STONE_BASE: '#808080',
  STONE_LIGHT: '#A0A0A0',
  STONE_DARK: '#606060',
  
  // Carpet colors
  CARPET_BASE: '#8B1A1A',
  CARPET_LIGHT: '#A02020',
  CARPET_DARK: '#6B1010',
  
  // Grass colors
  GRASS_BASE: '#2E8B57',
  GRASS_LIGHT: '#3CB371',
  GRASS_DARK: '#1E6B37',
  
  // Wall colors
  WALL_BASE: '#D2B48C',
  WALL_MID: '#C4A882',
  WALL_LIGHT: '#E0C8A0',
  
  // Brick colors
  BRICK_BASE: '#B22222',
  BRICK_DARK: '#8B1A1A',
  BRICK_LIGHT: '#CD5C5C',
  
  // Agent skin
  SKIN_LIGHT: '#FFD4B2',
  SKIN_DARK: '#FFBD94',
  
  // Agent clothes
  BLUE_LIGHT: '#4169E1',
  BLUE_DARK: '#1E3A8A',
  RED_LIGHT: '#DC2626',
  RED_DARK: '#991B1B',
  GREEN_LIGHT: '#16A34A',
  GREEN_DARK: '#0D6B2C',
  
  // Accent
  ACCENT: '#00D4AA',
};

/**
 * Helper: Draw an isometric diamond tile
 */
function drawIsoDiamond(ctx, w, h, colors) {
  ctx.imageSmoothingEnabled = false;
  
  const centerX = w / 2;
  const centerY = h / 2;
  
  // Main fill
  ctx.fillStyle = colors.base;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(w, centerY);
  ctx.lineTo(centerX, h);
  ctx.lineTo(0, centerY);
  ctx.closePath();
  ctx.fill();
  
  // Left face (darker)
  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(0, centerY);
  ctx.lineTo(centerX, h);
  ctx.lineTo(centerX, centerY);
  ctx.closePath();
  ctx.fill();
  
  // Right face (lighter)
  ctx.fillStyle = colors.light;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(w, centerY);
  ctx.lineTo(centerX, h);
  ctx.lineTo(centerX, centerY);
  ctx.closePath();
  ctx.fill();
  
  // Outline
  ctx.strokeStyle = colors.dark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(w, centerY);
  ctx.lineTo(centerX, h);
  ctx.lineTo(0, centerY);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Helper: Draw pixel pattern
 */
function drawPattern(ctx, x, y, w, h, color1, color2, patternType = 'checker') {
  ctx.imageSmoothingEnabled = false;
  
  if (patternType === 'checker') {
    // Alternating checker pattern
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        ctx.fillStyle = ((px + py) % 2 === 0) ? color1 : color2;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  } else if (patternType === 'planks') {
    // Horizontal planks
    ctx.fillStyle = color1;
    ctx.fillRect(x, y, w, h);
    
    ctx.strokeStyle = color2;
    ctx.lineWidth = 1;
    for (let i = 0; i < h; i += 4) {
      ctx.beginPath();
      ctx.moveTo(x, y + i);
      ctx.lineTo(x + w, y + i);
      ctx.stroke();
    }
  }
}

// ========================================
// FLOOR TILES (64x32 isometric diamonds)
// ========================================

function generateFloorWood() {
  const canvas = createCanvas(64, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  drawIsoDiamond(ctx, 64, 32, {
    base: COLORS.WOOD_BASE,
    light: COLORS.WOOD_LIGHT,
    dark: COLORS.WOOD_DARK
  });
  
  // Add wood grain details
  ctx.strokeStyle = COLORS.WOOD_DARK;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(16 + i * 8, 8);
    ctx.lineTo(48 + i * 4, 24);
    ctx.stroke();
  }
  
  return canvas.toBuffer('image/png');
}

function generateFloorStone() {
  const canvas = createCanvas(64, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  drawIsoDiamond(ctx, 64, 32, {
    base: COLORS.STONE_BASE,
    light: COLORS.STONE_LIGHT,
    dark: COLORS.STONE_DARK
  });
  
  // Add stone tiles
  ctx.strokeStyle = COLORS.STONE_DARK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 8);
  ctx.lineTo(48, 16);
  ctx.lineTo(32, 24);
  ctx.lineTo(16, 16);
  ctx.closePath();
  ctx.stroke();
  
  return canvas.toBuffer('image/png');
}

function generateFloorCarpet() {
  const canvas = createCanvas(64, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  drawIsoDiamond(ctx, 64, 32, {
    base: COLORS.CARPET_BASE,
    light: COLORS.CARPET_LIGHT,
    dark: COLORS.CARPET_DARK
  });
  
  // Add subtle pattern
  ctx.fillStyle = COLORS.CARPET_LIGHT;
  for (let y = 4; y < 28; y += 4) {
    for (let x = 16; x < 48; x += 4) {
      if ((x + y) % 8 === 0) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  
  return canvas.toBuffer('image/png');
}

function generateFloorGrass() {
  const canvas = createCanvas(64, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  drawIsoDiamond(ctx, 64, 32, {
    base: COLORS.GRASS_BASE,
    light: COLORS.GRASS_LIGHT,
    dark: COLORS.GRASS_DARK
  });
  
  // Add grass texture
  ctx.fillStyle = COLORS.GRASS_LIGHT;
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * 48) + 8;
    const y = Math.floor(Math.random() * 24) + 4;
    ctx.fillRect(x, y, 1, 2);
  }
  
  return canvas.toBuffer('image/png');
}

// ========================================
// WALL SEGMENTS (32x64)
// ========================================

function generateWallDefault() {
  const canvas = createCanvas(32, 64);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  // Main wall fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, COLORS.WALL_LIGHT);
  gradient.addColorStop(0.5, COLORS.WALL_BASE);
  gradient.addColorStop(1, COLORS.WALL_MID);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 64);
  
  // Baseboard
  ctx.fillStyle = COLORS.WALL_MID;
  ctx.fillRect(0, 60, 32, 4);
  
  // Vertical lines for texture
  ctx.strokeStyle = COLORS.WALL_MID;
  ctx.lineWidth = 1;
  for (let x = 4; x < 32; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 64);
    ctx.stroke();
  }
  
  return canvas.toBuffer('image/png');
}

function generateWallBrick() {
  const canvas = createCanvas(32, 64);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  // Base color
  ctx.fillStyle = COLORS.BRICK_BASE;
  ctx.fillRect(0, 0, 32, 64);
  
  // Brick pattern
  const brickW = 8;
  const brickH = 4;
  
  for (let y = 0; y < 64; y += brickH) {
    const offset = (y / brickH) % 2 === 0 ? 0 : brickW / 2;
    for (let x = -brickW; x < 32; x += brickW) {
      const bx = x + offset;
      
      // Brick fill
      ctx.fillStyle = (x % 16 === 0) ? COLORS.BRICK_LIGHT : COLORS.BRICK_BASE;
      ctx.fillRect(bx, y, brickW - 1, brickH - 1);
      
      // Mortar
      ctx.strokeStyle = COLORS.BRICK_DARK;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, y, brickW - 1, brickH - 1);
    }
  }
  
  return canvas.toBuffer('image/png');
}

// ========================================
// AGENT SPRITES (32x48)
// ========================================

function generateAgent(clothesLight, clothesDark) {
  const canvas = createCanvas(32, 48);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  const centerX = 16;
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.ellipse(centerX, 46, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Legs (shoes + pants)
  ctx.fillStyle = '#333333';
  ctx.fillRect(centerX - 6, 38, 4, 6);
  ctx.fillRect(centerX + 2, 38, 4, 6);
  
  ctx.fillStyle = '#2a4494';
  ctx.fillRect(centerX - 6, 28, 4, 10);
  ctx.fillRect(centerX + 2, 28, 4, 10);
  
  // Body (shirt)
  ctx.fillStyle = clothesLight;
  ctx.fillRect(centerX - 7, 18, 14, 10);
  
  // Arms
  ctx.fillStyle = clothesLight;
  ctx.fillRect(centerX - 11, 20, 3, 10);
  ctx.fillRect(centerX + 8, 20, 3, 10);
  
  // Hands
  ctx.fillStyle = COLORS.SKIN_LIGHT;
  ctx.fillRect(centerX - 11, 30, 3, 3);
  ctx.fillRect(centerX + 8, 30, 3, 3);
  
  // Head
  ctx.fillStyle = COLORS.SKIN_LIGHT;
  ctx.beginPath();
  ctx.arc(centerX, 12, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Hair
  ctx.fillStyle = '#4a3728';
  ctx.beginPath();
  ctx.arc(centerX, 8, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(centerX - 7, 8, 14, 3);
  
  // Eyes
  ctx.fillStyle = '#000000';
  ctx.fillRect(centerX - 3, 11, 2, 2);
  ctx.fillRect(centerX + 1, 11, 2, 2);
  
  // Smile
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, 14, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();
  
  // Accent stripe on shirt
  ctx.fillStyle = clothesDark;
  ctx.fillRect(centerX - 7, 22, 14, 2);
  
  return canvas.toBuffer('image/png');
}

function generateAgentDefault() {
  return generateAgent(COLORS.ACCENT, '#009B85');
}

function generateAgentBlue() {
  return generateAgent(COLORS.BLUE_LIGHT, COLORS.BLUE_DARK);
}

function generateAgentRed() {
  return generateAgent(COLORS.RED_LIGHT, COLORS.RED_DARK);
}

function generateAgentGreen() {
  return generateAgent(COLORS.GREEN_LIGHT, COLORS.GREEN_DARK);
}

// ========================================
// FURNITURE
// ========================================

function generateChair() {
  const canvas = createCanvas(24, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  const centerX = 12;
  
  // Chair back (isometric)
  ctx.fillStyle = COLORS.WOOD_BASE;
  ctx.fillRect(centerX - 6, 8, 12, 2);
  ctx.fillRect(centerX - 6, 8, 2, 10);
  ctx.fillRect(centerX + 4, 8, 2, 10);
  
  // Seat (isometric diamond)
  ctx.fillStyle = COLORS.WOOD_LIGHT;
  ctx.beginPath();
  ctx.moveTo(centerX, 18);
  ctx.lineTo(centerX + 6, 21);
  ctx.lineTo(centerX, 24);
  ctx.lineTo(centerX - 6, 21);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = COLORS.WOOD_DARK;
  ctx.beginPath();
  ctx.moveTo(centerX, 18);
  ctx.lineTo(centerX - 6, 21);
  ctx.lineTo(centerX, 24);
  ctx.lineTo(centerX, 21);
  ctx.closePath();
  ctx.fill();
  
  // Legs
  ctx.strokeStyle = COLORS.WOOD_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 5, 24);
  ctx.lineTo(centerX - 5, 30);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX + 5, 24);
  ctx.lineTo(centerX + 5, 30);
  ctx.stroke();
  
  return canvas.toBuffer('image/png');
}

function generateTable() {
  const canvas = createCanvas(48, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  const centerX = 24;
  
  // Table top (isometric)
  ctx.fillStyle = COLORS.WOOD_LIGHT;
  ctx.beginPath();
  ctx.moveTo(centerX, 8);
  ctx.lineTo(centerX + 18, 14);
  ctx.lineTo(centerX, 20);
  ctx.lineTo(centerX - 18, 14);
  ctx.closePath();
  ctx.fill();
  
  // Shading on left side
  ctx.fillStyle = COLORS.WOOD_DARK;
  ctx.beginPath();
  ctx.moveTo(centerX, 8);
  ctx.lineTo(centerX - 18, 14);
  ctx.lineTo(centerX, 20);
  ctx.lineTo(centerX, 14);
  ctx.closePath();
  ctx.fill();
  
  // Edge thickness
  ctx.fillStyle = COLORS.WOOD_BASE;
  ctx.fillRect(centerX - 18, 14, 36, 2);
  
  // Legs
  ctx.strokeStyle = COLORS.WOOD_DARK;
  ctx.lineWidth = 2;
  
  const legPositions = [
    [centerX - 14, 16],
    [centerX + 14, 16],
    [centerX - 6, 20],
    [centerX + 6, 12]
  ];
  
  legPositions.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
  });
  
  return canvas.toBuffer('image/png');
}

function generatePlant() {
  const canvas = createCanvas(24, 40);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  const centerX = 12;
  
  // Pot (isometric)
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(centerX, 28);
  ctx.lineTo(centerX + 6, 32);
  ctx.lineTo(centerX, 36);
  ctx.lineTo(centerX - 6, 32);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = '#6B3510';
  ctx.beginPath();
  ctx.moveTo(centerX, 28);
  ctx.lineTo(centerX - 6, 32);
  ctx.lineTo(centerX, 36);
  ctx.lineTo(centerX, 32);
  ctx.closePath();
  ctx.fill();
  
  // Soil
  ctx.fillStyle = '#5a3825';
  ctx.fillRect(centerX - 5, 28, 10, 2);
  
  // Plant leaves
  const leaves = [
    { x: centerX, y: 8, r: 4 },
    { x: centerX - 5, y: 12, r: 5 },
    { x: centerX + 5, y: 12, r: 5 },
    { x: centerX - 3, y: 18, r: 4 },
    { x: centerX + 3, y: 18, r: 4 },
    { x: centerX, y: 22, r: 5 }
  ];
  
  leaves.forEach(leaf => {
    ctx.fillStyle = COLORS.GRASS_BASE;
    ctx.beginPath();
    ctx.arc(leaf.x, leaf.y, leaf.r, 0, Math.PI * 2);
    ctx.fill();
    
    // Highlight
    ctx.fillStyle = COLORS.GRASS_LIGHT;
    ctx.fillRect(leaf.x - 1, leaf.y - 2, 2, 2);
  });
  
  // Stem
  ctx.strokeStyle = COLORS.GRASS_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, 28);
  ctx.lineTo(centerX, 22);
  ctx.stroke();
  
  return canvas.toBuffer('image/png');
}

function generateComputer() {
  const canvas = createCanvas(32, 40);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  const centerX = 16;
  
  // Monitor base
  ctx.fillStyle = '#444444';
  ctx.fillRect(centerX - 3, 34, 6, 4);
  
  // Monitor stand
  ctx.fillStyle = '#555555';
  ctx.fillRect(centerX - 1, 28, 2, 6);
  
  // Monitor screen (isometric)
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.moveTo(centerX, 8);
  ctx.lineTo(centerX + 12, 14);
  ctx.lineTo(centerX + 12, 26);
  ctx.lineTo(centerX, 32);
  ctx.lineTo(centerX - 12, 26);
  ctx.lineTo(centerX - 12, 14);
  ctx.closePath();
  ctx.fill();
  
  // Screen bezel
  ctx.strokeStyle = '#666666';
  ctx.lineWidth = 2;
  ctx.strokeRect(centerX - 11, 15, 22, 10);
  
  // Screen display (OpenClaw logo color)
  ctx.fillStyle = COLORS.ACCENT;
  ctx.fillRect(centerX - 9, 17, 18, 6);
  
  // Screen highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(centerX - 8, 18, 4, 2);
  
  // Power LED
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(centerX - 1, 30, 2, 1);
  
  return canvas.toBuffer('image/png');
}

// ========================================
// MAIN GENERATOR
// ========================================

const sprites = [
  // Floor tiles
  { name: 'floor_wood.png', generator: generateFloorWood },
  { name: 'floor_stone.png', generator: generateFloorStone },
  { name: 'floor_carpet.png', generator: generateFloorCarpet },
  { name: 'floor_grass.png', generator: generateFloorGrass },
  
  // Walls
  { name: 'wall_default.png', generator: generateWallDefault },
  { name: 'wall_brick.png', generator: generateWallBrick },
  
  // Agents
  { name: 'agent_default.png', generator: generateAgentDefault },
  { name: 'agent_blue.png', generator: generateAgentBlue },
  { name: 'agent_red.png', generator: generateAgentRed },
  { name: 'agent_green.png', generator: generateAgentGreen },
  
  // Furniture
  { name: 'chair.png', generator: generateChair },
  { name: 'table.png', generator: generateTable },
  { name: 'plant.png', generator: generatePlant },
  { name: 'computer.png', generator: generateComputer },
];

console.log('🎨 OpenClaw Hotel — Pixel Art Sprite Generator\n');
console.log(`Output directory: ${OUTPUT_DIR}\n`);

let successCount = 0;
let errorCount = 0;

sprites.forEach(sprite => {
  try {
    const buffer = sprite.generator();
    const path = join(OUTPUT_DIR, sprite.name);
    writeFileSync(path, buffer);
    console.log(`✓ Generated ${sprite.name}`);
    successCount++;
  } catch (error) {
    console.error(`✗ Failed to generate ${sprite.name}:`, error.message);
    errorCount++;
  }
});

console.log(`\n🎉 Generation complete!`);
console.log(`   ✓ Success: ${successCount}`);
console.log(`   ✗ Errors: ${errorCount}`);

if (successCount > 0) {
  console.log(`\n📁 Sprites saved to: ${OUTPUT_DIR}`);
}

process.exit(errorCount > 0 ? 1 : 0);
