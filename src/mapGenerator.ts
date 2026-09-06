import { TileData, TileType } from './types';

// Deterministic LCG Seeded Random
function seededRandom(seed: number) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Seeded Bilinear Value Noise with Fractional Brownian Motion
class SeededNoise {
  private grid: number[] = [];
  constructor(seed: number) {
    const rnd = seededRandom(seed);
    for (let i = 0; i < 256; i++) {
      this.grid.push(rnd());
    }
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const r00 = this.grid[(X + Y) & 255];
    const r10 = this.grid[(X + 1 + Y) & 255];
    const r01 = this.grid[(X + Y + 1) & 255];
    const r11 = this.grid[(X + 1 + Y + 1) & 255];

    // Smoothstep interpolation
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const i1 = r00 + u * (r10 - r00);
    const i2 = r01 + u * (r11 - r01);
    return i1 + v * (i2 - i1);
  }

  fbm(x: number, y: number, octaves = 3): number {
    let value = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxVal += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value / maxVal;
  }
}

export type MapPreset = 'river_valley' | 'coastal_plains' | 'highland' | 'flatlands';

export interface GeneratorParams {
  seed: number;
  preset: MapPreset;
  roughness: number;     // 0 to 1
  waterAmount: number;   // 0 to 1
  treeDensity: number;   // 0 to 1
  width?: number;
  height?: number;
}

export const REGION_SIZE = 20;
export const REGIONS_X = 3;
export const REGIONS_Y = 3;
export const WORLD_WIDTH = REGION_SIZE * REGIONS_X;  // 60
export const WORLD_HEIGHT = REGION_SIZE * REGIONS_Y; // 60

export function generateWorld(params: GeneratorParams): TileData[][] {
  const { seed, preset, roughness, waterAmount, treeDensity } = params;
  const WORLD_W = params.width || WORLD_WIDTH;
  const WORLD_H = params.height || WORLD_HEIGHT;
  const n = new SeededNoise(seed);
  const rnd = seededRandom(seed + 42);

  const grid: TileData[][] = [];

  for (let y = 0; y < WORLD_H; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < WORLD_W; x++) {
      // 1. Calculate Base Elevation based on Preset
      let elevation = 0;
      let isWater = false;
      let resource: 'none' | 'fertile' | 'ore' | 'oil' | 'forest' = 'none';

      const nx = x / WORLD_W;
      const ny = y / WORLD_H;

      if (preset === 'river_valley') {
        // Flat valley in center (x around 30) with mountains on left/right
        const distFromCenter = Math.abs(nx - 0.5);
        const mountainBase = Math.max(0, distFromCenter - 0.15) * 15;
        const noiseVal = n.fbm(x * 0.08, y * 0.08, 4) * roughness * 5;
        elevation = Math.round(mountainBase + noiseVal);

        // River curving down the center
        const riverCenter = 0.5 + Math.sin(y * 0.15) * 0.08 + n.noise(x * 0.05, y * 0.05) * 0.05;
        const riverWidth = 0.05 + waterAmount * 0.04;
        if (Math.abs(nx - riverCenter) < riverWidth) {
          isWater = true;
          elevation = 0;
        }
      } else if (preset === 'coastal_plains') {
        // Water on bottom half, plains rising into hills towards top
        const noiseVal = n.fbm(x * 0.06, y * 0.06, 3) * roughness * 4;
        elevation = Math.round(ny * 5 + noiseVal);

        const coastline = 0.7 + Math.sin(x * 0.1) * 0.05 + n.noise(x * 0.1, y * 0.1) * 0.05;
        if (ny > coastline - waterAmount * 0.15) {
          isWater = true;
          elevation = 0;
        }
      } else if (preset === 'highland') {
        // High base elevation with rough craters/lakes
        const baseNoise = n.fbm(x * 0.07, y * 0.07, 4) * roughness * 8;
        elevation = Math.round(2 + baseNoise);

        // Crater lake in center
        const distFromCenter = Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2));
        if (distFromCenter < 0.15 + waterAmount * 0.1) {
          isWater = true;
          elevation = 1;
        }
      } else {
        // Flatlands - very smooth, minor water body
        const noiseVal = n.fbm(x * 0.04, y * 0.04, 2) * roughness * 2;
        elevation = Math.round(1 + noiseVal);

        // Small circular lake in corner
        const distFromCorner = Math.sqrt(Math.pow(nx - 0.15, 2) + Math.pow(ny - 0.15, 2));
        if (distFromCorner < 0.12 + waterAmount * 0.08) {
          isWater = true;
          elevation = 0;
        }
      }

      // Constrain elevation safely
      elevation = Math.max(0, Math.min(10, elevation));

      // 2. Generate Natural Resources
      const forestNoise = n.noise(x * 0.15, y * 0.15);
      const oilNoise = n.noise(x * 0.2 + 100, y * 0.2 + 100);
      const oreNoise = n.noise(x * 0.25 + 200, y * 0.25 + 200);

      if (isWater) {
        resource = 'none';
      } else if (elevation >= 5 && oreNoise > 0.65) {
        resource = 'ore';
      } else if (elevation <= 2 && oilNoise > 0.7) {
        resource = 'oil';
      } else if (forestNoise > 0.5 + (1 - treeDensity) * 0.3) {
        resource = 'forest';
      } else if (elevation === 1 || elevation === 2) {
        // Near water fertile land check
        let nearWater = false;
        if (preset === 'river_valley' && Math.abs(nx - 0.5) < 0.18) {
          nearWater = true;
        } else if (preset === 'coastal_plains' && ny > 0.5 && ny < 0.7) {
          nearWater = true;
        }
        if (nearWater || rnd() < 0.12) {
          resource = 'fertile';
        }
      }

      row.push({
        type: TileType.EMPTY,
        x,
        y,
        level: 1,
        population: 0,
        jobs: 0,
        traffic: 0,
        powered: false,
        watered: false,
        productivity: 0,
        abandoned: false,
        fireCovered: false,
        policeCovered: false,
        healthCovered: false,
        schoolCovered: false,
        wasteCovered: false,
        landValue: isWater ? 40 : 30 + elevation * 2,
        pollution: 0,
        noise: 0,
        crime: 30,
        health: 50,
        education: 0,
        upgradeProgress: 0,
        elevation,
        resource,
        water: isWater,
      } as any);
    }
    grid.push(row);
  }

  // 3. Construct Outside Connection: Dual Highway running left-to-right at center
  const highwayY = Math.min(Math.floor(WORLD_H / 2), WORLD_H - 1);
  for (let x = 0; x < WORLD_W; x++) {
    if (highwayY < WORLD_H && grid[highwayY] && grid[highwayY][x]) {
      const t1 = grid[highwayY][x];
      t1.type = TileType.ROAD;
      t1.elevation = 1;
      t1.water = false;
      t1.powered = true;
      t1.watered = true;
    }

    // Dual highway has double lanes
    if (highwayY + 1 < WORLD_H && grid[highwayY + 1] && grid[highwayY + 1][x]) {
      const t2 = grid[highwayY + 1][x];
      t2.type = TileType.ROAD;
      t2.elevation = 1;
      t2.water = false;
      t2.powered = true;
      t2.watered = true;
    }
  }

  return grid;
}
