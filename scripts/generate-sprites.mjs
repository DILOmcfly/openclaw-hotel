/**
 * T-041: Generate pixel art sprites for OpenClaw Hotel
 * Uses node:canvas-less approach — writes raw PNG via sharp-less method
 * Actually: generates sprite data as base64 PNGs embedded in a JS module
 * that the client can load directly. No native deps needed.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', 'client', 'assets', 'sprites');
mkdirSync(OUT, { recursive: true });

// We'll generate a sprite atlas as a TypeScript module with inline SVGs
// converted to data URLs — works everywhere, no native deps

const TILE_W = 64;
const TILE_H = 32;

function diamond(fill, stroke = '#000000', strokeWidth = 1) {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}">
    <polygon points="${hw},0 ${TILE_W},${hh} ${hw},${TILE_H} 0,${hh}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
  </svg>`;
}

function wallSvg(fill, height = 48) {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${height}" viewBox="0 0 ${TILE_W} ${height}">
    <polygon points="${hw},0 ${TILE_W},${hh} ${TILE_W},${hh + height - TILE_H} ${hw},${height} 0,${hh + height - TILE_H} 0,${hh}" fill="${fill}" stroke="#000" stroke-width="1"/>
    <polygon points="${hw},0 ${TILE_W},${hh} ${hw},${TILE_H} 0,${hh}" fill="${fill}" stroke="#000" stroke-width="1" opacity="0.85"/>
  </svg>`;
}

function agentSvg(bodyColor = '#888888', dir = 0) {
  // Simple isometric agent: body + head circle
  // 32x48 sprite
  const w = 32, h = 48;
  const cx = w / 2;
  // Direction indicator offset
  const dx = [0, 3, 4, 3, 0, -3, -4, -3][dir] || 0;
  const dy = [-3, -2, 0, 2, 3, 2, 0, -2][dir] || 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <ellipse cx="${cx}" cy="38" rx="10" ry="6" fill="${bodyColor}" stroke="#000" stroke-width="1"/>
    <rect x="${cx - 6}" y="18" width="12" height="22" rx="3" fill="${bodyColor}" stroke="#000" stroke-width="1"/>
    <circle cx="${cx}" cy="14" r="8" fill="${bodyColor}" stroke="#000" stroke-width="1"/>
    <circle cx="${cx + dx}" cy="${14 + dy}" r="2" fill="#fff"/>
    <circle cx="${cx + dx}" cy="${14 + dy}" r="1" fill="#000"/>
  </svg>`;
}

function furnitureSvg(name, color, w = 32, h = 40) {
  const hw = w / 2;
  switch (name) {
    case 'chair':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect x="4" y="20" width="24" height="4" rx="1" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="6" y="24" width="3" height="14" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="23" y="24" width="3" height="14" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="4" y="6" width="4" height="18" rx="1" fill="${color}" stroke="#000" stroke-width="1"/>
      </svg>`;
    case 'table':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect x="2" y="12" width="28" height="4" rx="1" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="4" y="16" width="3" height="20" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="25" y="16" width="3" height="20" fill="${color}" stroke="#000" stroke-width="1"/>
      </svg>`;
    case 'lamp':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect x="14" y="14" width="4" height="24" fill="#888" stroke="#000" stroke-width="1"/>
        <polygon points="8,14 24,14 20,4 12,4" fill="${color}" stroke="#000" stroke-width="1"/>
        <circle cx="16" cy="6" r="2" fill="#FFE082"/>
      </svg>`;
    case 'sofa':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="${h}" viewBox="0 0 48 ${h}">
        <rect x="2" y="16" width="44" height="12" rx="3" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="2" y="6" width="8" height="22" rx="2" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="38" y="6" width="8" height="22" rx="2" fill="${color}" stroke="#000" stroke-width="1"/>
        <rect x="4" y="28" width="4" height="8" fill="#555" stroke="#000" stroke-width="1"/>
        <rect x="40" y="28" width="4" height="8" fill="#555" stroke="#000" stroke-width="1"/>
      </svg>`;
    case 'plant':
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect x="10" y="24" width="12" height="14" rx="2" fill="#8D6E63" stroke="#000" stroke-width="1"/>
        <circle cx="16" cy="18" r="8" fill="#4CAF50" stroke="#000" stroke-width="1"/>
        <circle cx="12" cy="14" r="5" fill="#66BB6A" stroke="#000" stroke-width="1"/>
        <circle cx="20" cy="16" r="4" fill="#43A047" stroke="#000" stroke-width="1"/>
      </svg>`;
    default:
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect x="4" y="4" width="${w-8}" height="${h-8}" rx="2" fill="${color}" stroke="#000" stroke-width="1"/>
      </svg>`;
  }
}

function bubbleSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
    <rect x="2" y="2" width="116" height="28" rx="8" fill="#fff" stroke="#000" stroke-width="1.5"/>
    <polygon points="20,30 28,38 36,30" fill="#fff" stroke="#000" stroke-width="1.5"/>
    <line x1="21" y1="30" x2="35" y2="30" stroke="#fff" stroke-width="2"/>
  </svg>`;
}

// Generate sprite atlas module
const tiles = {
  floor_stone: diamond('#BDBDBD'),
  floor_wood: diamond('#A1887F'),
  floor_grass: diamond('#66BB6A'),
  floor_carpet: diamond('#7E57C2'),
  floor_sand: diamond('#FFD54F'),
  floor_water: diamond('#42A5F5', '#1565C0'),
};

const walls = {
  wall_stone: wallSvg('#9E9E9E'),
  wall_brick: wallSvg('#C62828'),
  wall_wood: wallSvg('#6D4C41'),
  wall_metal: wallSvg('#78909C'),
};

const door = { door: wallSvg('#3E2723', 48) };

// Agent in 4 directions (0=N, 2=E, 4=S, 6=W) — greyscale base
const agents = {};
for (const dir of [0, 2, 4, 6]) {
  agents[`agent_dir${dir}`] = agentSvg('#AAAAAA', dir);
}

const furniture = {
  furn_chair: furnitureSvg('chair', '#8D6E63'),
  furn_table: furnitureSvg('table', '#5D4037'),
  furn_lamp: furnitureSvg('lamp', '#FFB74D'),
  furn_sofa: furnitureSvg('sofa', '#1565C0'),
  furn_plant: furnitureSvg('plant', '#4CAF50'),
  furn_bookshelf: furnitureSvg('default', '#6D4C41', 32, 48),
  furn_computer: furnitureSvg('default', '#37474F'),
  furn_bed: furnitureSvg('default', '#E91E63', 48, 40),
  furn_fridge: furnitureSvg('default', '#ECEFF1', 28, 48),
  furn_tv: furnitureSvg('default', '#212121', 40, 32),
};

const bubble = { speech_bubble: bubbleSvg() };

const all = { ...tiles, ...walls, ...door, ...agents, ...furniture, ...bubble };

// Write individual SVG files
for (const [name, svg] of Object.entries(all)) {
  writeFileSync(join(OUT, `${name}.svg`), svg);
}

// Write sprite atlas TS module
const entries = Object.entries(all).map(([name, svg]) => {
  const b64 = Buffer.from(svg).toString('base64');
  return `  '${name}': 'data:image/svg+xml;base64,${b64}'`;
});

const atlasModule = `// Auto-generated sprite atlas — do not edit
// Generated by scripts/generate-sprites.mjs

export const SPRITES: Record<string, string> = {
${entries.join(',\n')}
};

export const TILE_SPRITES = ['floor_stone', 'floor_wood', 'floor_grass', 'floor_carpet', 'floor_sand', 'floor_water'] as const;
export const WALL_SPRITES = ['wall_stone', 'wall_brick', 'wall_wood', 'wall_metal'] as const;
export const AGENT_SPRITES = ['agent_dir0', 'agent_dir2', 'agent_dir4', 'agent_dir6'] as const;
export const FURNITURE_SPRITES = ['furn_chair', 'furn_table', 'furn_lamp', 'furn_sofa', 'furn_plant', 'furn_bookshelf', 'furn_computer', 'furn_bed', 'furn_fridge', 'furn_tv'] as const;
`;

writeFileSync(join(import.meta.dirname, '..', 'client', 'src', 'sprites.ts'), atlasModule);

console.log(`Generated ${Object.keys(all).length} sprites:`);
console.log(`  Floors: ${Object.keys(tiles).length}`);
console.log(`  Walls: ${Object.keys(walls).length}`);
console.log(`  Door: 1`);
console.log(`  Agents: ${Object.keys(agents).length} (4 directions)`);
console.log(`  Furniture: ${Object.keys(furniture).length}`);
console.log(`  Bubble: 1`);
console.log(`  Atlas module: client/src/sprites.ts`);
