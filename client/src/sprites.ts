// Sprite atlas with real pixel art assets
// Updated by scripts/update-sprites-from-generated.mjs
// Original SVG placeholders replaced with Gemini-generated pixel art PNGs

export const SPRITES: Record<string, string> = {
  'floor_stone': '/assets/sprites/floor_stone.png',
  'floor_wood': '/assets/sprites/floor_wood.png',
  'floor_grass': '/assets/sprites/floor_grass.png',
  'floor_carpet': '/assets/sprites/floor_carpet.png',
  'floor_sand': '/assets/sprites/floor_sand.svg',
  'floor_water': '/assets/sprites/floor_water.svg',
  'wall_stone': '/assets/generated/walls/stone_wall_32x64.png',
  'wall_brick': '/assets/sprites/wall_brick.png',
  'wall_wood': '/assets/sprites/wall_wood.png',
  'wall_metal': '/assets/sprites/wall_metal.svg',
  'door': '/assets/sprites/door.png',
  'agent_dir0': '/assets/sprites/agent_dir0.png',
  'agent_dir2': '/assets/sprites/agent_dir2.png',
  'agent_dir4': '/assets/sprites/agent_dir4.png',
  'agent_dir6': '/assets/sprites/agent_dir6.png',
  'furn_chair': '/assets/sprites/furn_chair.png',
  'furn_table': '/assets/sprites/furn_table.png',
  'furn_lamp': '/assets/sprites/furn_lamp.png',
  'furn_sofa': '/assets/sprites/furn_sofa.png',
  'furn_plant': '/assets/sprites/furn_plant.png',
  'furn_bookshelf': '/assets/sprites/furn_bookshelf.png',
  'furn_computer': '/assets/sprites/furn_computer.png',
  'furn_bed': '/assets/sprites/furn_bed.png',
  'furn_fridge': '/assets/sprites/furn_fridge.png',
  'furn_tv': '/assets/sprites/furn_tv.png',
  'speech_bubble': '/assets/sprites/speech_bubble.svg'
};

export const TILE_SPRITES = ['floor_stone', 'floor_wood', 'floor_grass', 'floor_carpet', 'floor_sand', 'floor_water'] as const;
export const WALL_SPRITES = ['wall_stone', 'wall_brick', 'wall_wood', 'wall_metal'] as const;
export const AGENT_SPRITES = ['agent_dir0', 'agent_dir2', 'agent_dir4', 'agent_dir6'] as const;
export const FURNITURE_SPRITES = ['furn_chair', 'furn_table', 'furn_lamp', 'furn_sofa', 'furn_plant', 'furn_bookshelf', 'furn_computer', 'furn_bed', 'furn_fridge', 'furn_tv'] as const;
