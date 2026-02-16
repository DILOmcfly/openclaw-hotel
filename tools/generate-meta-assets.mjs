#!/usr/bin/env node
/**
 * Generate favicon and OG image for OpenClaw Hotel
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../client/public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

/**
 * Generate a simple pixel art hotel icon
 */
function drawHotelIcon(ctx, x, y, size, color) {
  const pixelSize = size / 8;
  
  // Simple hotel/building pattern (8x8 grid)
  const pattern = [
    [0,0,1,1,1,1,0,0],
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [0,1,0,1,1,0,1,0],
    [0,1,1,1,1,1,1,0],
    [0,1,0,1,1,0,1,0],
    [0,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,0,0],
  ];
  
  ctx.fillStyle = color;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (pattern[row][col]) {
        ctx.fillRect(
          x + col * pixelSize,
          y + row * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    }
  }
}

/**
 * Generate 32x32 favicon
 */
function generateFavicon() {
  const canvas = createCanvas(32, 32);
  const ctx = canvas.getContext('2d');
  
  // Transparent background (default)
  ctx.clearRect(0, 0, 32, 32);
  
  // Draw hotel icon centered
  drawHotelIcon(ctx, 4, 4, 24, '#00D4AA');
  
  // Save as PNG
  const faviconPath = path.join(publicDir, 'favicon.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(faviconPath, buffer);
  
  console.log('✅ Generated favicon.png');
}

/**
 * Generate 1200x630 OG image
 */
function generateOGImage() {
  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');
  
  // Dark background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, 1200, 630);
  
  // Title: "OpenClaw Hotel"
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OpenClaw Hotel', 600, 250);
  
  // Subtitle
  ctx.fillStyle = '#00D4AA';
  ctx.font = '36px sans-serif';
  ctx.fillText('Where AI agents build their own society', 600, 350);
  
  // Draw small hotel icons as decoration
  drawHotelIcon(ctx, 200, 450, 80, '#00D4AA');
  drawHotelIcon(ctx, 920, 450, 80, '#00D4AA');
  
  // Add small pixel art "agents" (simple dots with eyes)
  const agentColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];
  for (let i = 0; i < 4; i++) {
    const x = 350 + i * 120;
    const y = 480;
    
    // Body
    ctx.fillStyle = agentColors[i];
    ctx.fillRect(x, y, 40, 40);
    
    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, y + 12, 8, 8);
    ctx.fillRect(x + 24, y + 12, 8, 8);
    
    // Pupils
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 11, y + 15, 3, 3);
    ctx.fillRect(x + 27, y + 15, 3, 3);
  }
  
  // Save as PNG
  const ogImagePath = path.join(publicDir, 'og-image.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(ogImagePath, buffer);
  
  console.log('✅ Generated og-image.png');
}

// Generate both assets
console.log('🎨 Generating meta assets...');
generateFavicon();
generateOGImage();
console.log('✨ Done!');
