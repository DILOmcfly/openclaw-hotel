#!/usr/bin/env node
/**
 * Extract base64 PNG sprites from sprites.ts and save as physical PNG files
 * Destination: public/assets/room-sprites/
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read sprites.ts
const spritesPath = join(projectRoot, 'client/src/sprites.ts');
const spritesContent = readFileSync(spritesPath, 'utf8');

// Parse the SPRITES object
const spritesMatch = spritesContent.match(/export const SPRITES[^=]*=\s*{([^}]*)}/s);
if (!spritesMatch) {
  console.error('[EXTRACT] Failed to parse SPRITES object');
  process.exit(1);
}

const spritesObjectContent = spritesMatch[1];

// Extract each sprite entry
const spriteRegex = /'([^']+)':\s*'data:image\/png;base64,([^']+)'/g;
let match;
const sprites = [];

while ((match = spriteRegex.exec(spritesObjectContent)) !== null) {
  const [, name, base64Data] = match;
  sprites.push({ name, base64Data });
}

console.log(`[EXTRACT] Found ${sprites.length} base64 PNG sprites`);

// Create destination directory
const destDir = join(projectRoot, 'public/assets/room-sprites');
mkdirSync(destDir, { recursive: true });

// Write each sprite as a PNG file
let written = 0;
for (const sprite of sprites) {
  const buffer = Buffer.from(sprite.base64Data, 'base64');
  const outputPath = join(destDir, `${sprite.name}.png`);
  writeFileSync(outputPath, buffer);
  console.log(`[EXTRACT] ✓ ${sprite.name}.png (${buffer.length} bytes)`);
  written++;
}

console.log(`\n[EXTRACT] ✅ Extracted ${written} sprites to ${destDir}`);
