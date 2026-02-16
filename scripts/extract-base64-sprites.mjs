#!/usr/bin/env node
/**
 * Extract Base64-Encoded Sprites from sprites.ts
 * 
 * Reads client/src/sprites.ts, extracts all data:image/png;base64 and data:image/svg+xml;base64
 * sprites, decodes them to physical files in client/assets/sprites/, and updates sprites.ts
 * with file paths.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPRITES_TS_PATH = path.join(__dirname, '../client/src/sprites.ts');
const ASSETS_DIR = path.join(__dirname, '../client/assets/sprites');

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Read sprites.ts
const spritesContent = fs.readFileSync(SPRITES_TS_PATH, 'utf8');

// Extract sprite definitions (name: 'data:image/...')
const spriteRegex = /'([^']+)':\s*'(data:image\/[^']+)'/g;
let match;
const sprites = [];

while ((match = spriteRegex.exec(spritesContent)) !== null) {
  const [, name, dataUrl] = match;
  
  // Skip if already a file path (not data URL)
  if (!dataUrl.startsWith('data:')) continue;
  
  sprites.push({ name, dataUrl });
}

console.log(`Found ${sprites.length} base64-encoded sprites to extract.`);

let updatedContent = spritesContent;

for (const { name, dataUrl } of sprites) {
  // Parse data URL
  const matches = dataUrl.match(/^data:image\/(png|svg\+xml);base64,(.+)$/);
  
  if (!matches) {
    console.warn(`⚠️  Could not parse data URL for sprite: ${name}`);
    continue;
  }
  
  const [, format, base64Data] = matches;
  const extension = format === 'svg+xml' ? 'svg' : 'png';
  const filename = `${name}.${extension}`;
  const filePath = path.join(ASSETS_DIR, filename);
  
  // Decode and write file
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);
  
  console.log(`✅ Extracted: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
  
  // Update sprites.ts (replace data URL with file path)
  const relativePath = `/assets/sprites/${filename}`;
  updatedContent = updatedContent.replace(
    new RegExp(`'${name}':\\s*'${dataUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`),
    `'${name}': '${relativePath}'`
  );
}

// Write updated sprites.ts
fs.writeFileSync(SPRITES_TS_PATH, updatedContent, 'utf8');

console.log(`\n✅ Updated client/src/sprites.ts with file paths.`);
console.log(`📦 Extracted ${sprites.length} sprites to client/assets/sprites/`);

const originalSize = Buffer.byteLength(spritesContent, 'utf8');
const newSize = Buffer.byteLength(updatedContent, 'utf8');
const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);

console.log(`📉 File size: ${(originalSize / 1024).toFixed(2)} KB → ${(newSize / 1024).toFixed(2)} KB (${reduction}% reduction)`);
