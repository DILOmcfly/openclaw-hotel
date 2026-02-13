export type ItemDef = {
  width: number;
  depth: number;
  height: number;
  canSit: boolean;
  walkable: boolean;
};

export const CATALOG: Record<string, ItemDef> = {
  chair_wood: { width: 1, depth: 1, height: 1.0, canSit: true, walkable: false },
  table_round: { width: 2, depth: 2, height: 0.8, canSit: false, walkable: false },
  lamp_floor: { width: 1, depth: 1, height: 1.5, canSit: false, walkable: false },
  plant_pot: { width: 1, depth: 1, height: 0.5, canSit: false, walkable: false },
  bookshelf: { width: 2, depth: 1, height: 2.0, canSit: false, walkable: false },
  sofa_2seat: { width: 2, depth: 1, height: 0.8, canSit: true, walkable: false },
  rug_small: { width: 2, depth: 2, height: 0.01, canSit: false, walkable: true },
  tv_screen: { width: 2, depth: 1, height: 1.2, canSit: false, walkable: false },
  desk_office: { width: 2, depth: 1, height: 0.8, canSit: false, walkable: false },
  bed_single: { width: 1, depth: 2, height: 0.6, canSit: true, walkable: false },
};
