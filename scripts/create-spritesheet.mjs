/**
 * Create a combined character spritesheet from individual frames
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from './canvas-polyfill.mjs';

const ASSETS_DIR = join(import.meta.dirname, '..', 'client', 'public', 'assets');

// Create 4x1 spritesheet (horizontal layout)
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 48;
const FRAMES = 4;

const canvas = createCanvas(FRAME_WIDTH * FRAMES, FRAME_HEIGHT);
const ctx = canvas.getContext('2d');

// We can't load PNGs directly, so we'll recreate the frames
// Direction mapping: north, east, south, west
const directions = ['north', 'east', 'south', 'west'];

// Character colors
const CHAR_BODY = '#42A5F5';
const CHAR_SKIN = '#FFCCBC';
const CHAR_HAIR = '#795548';
const OUTLINE = '#000000';

directions.forEach((dir, index) => {
  const offsetX = index * FRAME_WIDTH;
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(offsetX + 16, 44, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body
  ctx.fillStyle = CHAR_BODY;
  ctx.fillRect(offsetX + 10, 20, 12, 18);
  
  // Head
  ctx.fillStyle = CHAR_SKIN;
  ctx.beginPath();
  ctx.arc(offsetX + 16, 14, 7, 0, Math.PI * 2);
  ctx.fill();
  
  // Hair
  ctx.fillStyle = CHAR_HAIR;
  ctx.beginPath();
  ctx.arc(offsetX + 16, 10, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  
  // Eyes based on direction
  ctx.fillStyle = '#000';
  const eyeOffsets = {
    north: [{ x: 13, y: 14 }, { x: 19, y: 14 }],
    east: [{ x: 18, y: 14 }, { x: 20, y: 14 }],
    south: [{ x: 13, y: 16 }, { x: 19, y: 16 }],
    west: [{ x: 12, y: 14 }, { x: 14, y: 14 }]
  };
  
  const eyes = eyeOffsets[dir];
  eyes.forEach(eye => {
    ctx.beginPath();
    ctx.arc(offsetX + eye.x, eye.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Outline body
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(offsetX + 10, 20, 12, 18);
  
  // Outline head
  ctx.beginPath();
  ctx.arc(offsetX + 16, 14, 7, 0, Math.PI * 2);
  ctx.stroke();
});

// Save spritesheet
const spritesheetPath = join(ASSETS_DIR, 'character_spritesheet.png');
writeFileSync(spritesheetPath, canvas.toBuffer());
console.log('✓ Created character_spritesheet.png (128x48)');

// Update the sprites.json to include spritesheet frames
const spritesJsonPath = join(ASSETS_DIR, 'sprites.json');
const atlas = JSON.parse(readFileSync(spritesJsonPath, 'utf8'));

// Add spritesheet frames
atlas.frames['char_spritesheet_north'] = {
  frame: { x: 0, y: 0, w: 32, h: 48 },
  sourceSize: { w: 32, h: 48 },
  spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 }
};

atlas.frames['char_spritesheet_east'] = {
  frame: { x: 32, y: 0, w: 32, h: 48 },
  sourceSize: { w: 32, h: 48 },
  spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 }
};

atlas.frames['char_spritesheet_south'] = {
  frame: { x: 64, y: 0, w: 32, h: 48 },
  sourceSize: { w: 32, h: 48 },
  spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 }
};

atlas.frames['char_spritesheet_west'] = {
  frame: { x: 96, y: 0, w: 32, h: 48 },
  sourceSize: { w: 32, h: 48 },
  spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 }
};

// Update meta info
atlas.animations = {
  character: ['char_spritesheet_north', 'char_spritesheet_east', 'char_spritesheet_south', 'char_spritesheet_west']
};

writeFileSync(spritesJsonPath, JSON.stringify(atlas, null, 2));
console.log('✓ Updated sprites.json with spritesheet frames');
