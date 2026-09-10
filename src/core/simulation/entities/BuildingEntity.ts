export interface BuildingEntity {
  id: string; // "x,y" of origin tile
  originX: number;
  originY: number;
  footprintW: number;
  footprintL: number;
  type: number; // TileType
  level: number;
  population: number;
  jobs: number;
  powered: boolean;
  watered: boolean;
  abandoned: boolean;
  // Depth metrics
  upgradeProgress: number;
}
