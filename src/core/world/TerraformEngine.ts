import { TileData } from '../../types';

export type TerraformBrushType = 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';

export interface TerraformBrushOptions {
  type: TerraformBrushType;
  centerX: number;
  centerY: number;
  radius: number; // 1 to 5
  strength: number; // 0.1 to 1.0
  targetElevation?: number;
}

export class TerraformEngine {
  public static applyBrush(grid: TileData[][], options: TerraformBrushOptions): { modifiedTiles: [number, number][] } {
    const { type, centerX, centerY, radius, strength, targetElevation = 3 } = options;
    const height = grid.length;
    const width = grid[0]?.length || 0;
    const modifiedTiles: [number, number][] = [];

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(height - 1, Math.ceil(centerY + radius));

    // Calculate average elevation for smooth brush
    let elevationSum = 0;
    let count = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (dist <= radius) {
          elevationSum += grid[y][x].elevation || 0;
          count++;
        }
      }
    }
    const avgElevation = count > 0 ? elevationSum / count : 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (dist <= radius) {
          const tile = grid[y][x];
          // Cosine falloff
          const falloff = 0.5 * (1 + Math.cos((Math.PI * dist) / radius)) * strength;
          const currentEl = tile.elevation || 0;
          let newEl = currentEl;

          switch (type) {
            case 'RAISE_TERRAIN':
              newEl = Math.min(10, currentEl + Math.max(0.5, falloff * 2));
              break;
            case 'LOWER_TERRAIN':
              newEl = Math.max(0, currentEl - Math.max(0.5, falloff * 2));
              break;
            case 'LEVEL_TERRAIN':
              newEl = currentEl + (targetElevation - currentEl) * falloff;
              break;
            case 'SMOOTH_TERRAIN':
              newEl = currentEl + (avgElevation - currentEl) * falloff;
              break;
          }

          const roundedEl = Math.max(0, Math.min(10, Math.round(newEl * 10) / 10));
          if (tile.elevation !== roundedEl) {
            tile.elevation = roundedEl;
            if (roundedEl === 0 && tile.water) {
              tile.water = true;
            } else if (roundedEl > 0) {
              tile.water = false;
            }
            modifiedTiles.push([x, y]);
          }
        }
      }
    }

    return { modifiedTiles };
  }
}
