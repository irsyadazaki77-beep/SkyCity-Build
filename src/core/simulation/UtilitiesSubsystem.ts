import { TileData, TileType, ActiveEvent } from '../../types';

export interface UtilitiesResult {
  powerCapacity: number;
  powerDemand: number;
  waterCapacity: number;
  waterDemand: number;
}

export function simulateUtilityNetworks(
  grid: TileData[][],
  unlockedUpgrades: string[] = [],
  activeEvents: ActiveEvent[] = []
): UtilitiesResult {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const hasU = (id: string) => unlockedUpgrades.includes(id);
  const powerGenMultiplier = hasU('solar_expansion') ? 1.5 : 1.0;
  const waterGenMultiplier = hasU('water_recycling') ? 1.4 : 1.0;

  let rawPowerCapacity = 0;
  let rawWaterCapacity = 0;
  let powerDemand = 0;
  let waterDemand = 0;

  // Find generators and initial sources
  const powerSources: [number, number][] = [];
  const waterSources: [number, number][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      // Reset utility status
      tile.powered = false;
      tile.watered = false;

      if (tile.type === TileType.POWER_PLANT) {
        rawPowerCapacity += Math.round(50 * powerGenMultiplier);
        powerSources.push([x, y]);
      } else if (tile.type === TileType.WATER_PUMP) {
        rawWaterCapacity += Math.round(50 * waterGenMultiplier);
        waterSources.push([x, y]);
      }

      // Calculate demands
      if (tile.type === TileType.RESIDENTIAL) {
        const lvl = tile.level || 1;
        powerDemand += lvl * 2;
        waterDemand += lvl * 2;
      } else if (tile.type === TileType.COMMERCIAL) {
        const lvl = tile.level || 1;
        powerDemand += lvl * 3;
        waterDemand += lvl * 2;
      } else if (tile.type === TileType.INDUSTRIAL) {
        const lvl = tile.level || 1;
        powerDemand += lvl * 5;
        waterDemand += lvl * 4;
      } else if (
        [
          TileType.FIRE_STATION,
          TileType.POLICE_STATION,
          TileType.CLINIC,
          TileType.SCHOOL,
          TileType.WASTE_MANAGEMENT,
        ].includes(tile.type)
      ) {
        powerDemand += 2;
        waterDemand += 2;
      }
    }
  }

  // Adjust for active events
  let powerCapacity = rawPowerCapacity;
  let waterCapacity = rawWaterCapacity;

  for (const ev of activeEvents) {
    if (ev.type === 'heatwave') {
      powerDemand = Math.round(powerDemand * 1.5);
      waterDemand = Math.round(waterDemand * 1.5);
    } else if (ev.type === 'power_shortage') {
      powerCapacity = Math.round(powerCapacity * 0.7);
    }
  }

  // Breadth-First-Search for Power Propagation through Road and Zone Networks
  const powerVisited = new Set<string>();
  const powerQueue: [number, number][] = [...powerSources];
  for (const [px, py] of powerSources) {
    powerVisited.add(`${px},${py}`);
    grid[py][px].powered = true;
  }

  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (powerQueue.length > 0) {
    const [cx, cy] = powerQueue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const key = `${nx},${ny}`;
        const neighbor = grid[ny][nx];
        if (!powerVisited.has(key) && neighbor.type !== TileType.EMPTY) {
          powerVisited.add(key);
          neighbor.powered = powerCapacity >= powerDemand || powerCapacity > 0;
          powerQueue.push([nx, ny]);
        }
      }
    }
  }

  // Breadth-First-Search for Water Propagation
  const waterVisited = new Set<string>();
  const waterQueue: [number, number][] = [...waterSources];
  for (const [wx, wy] of waterSources) {
    waterVisited.add(`${wx},${wy}`);
    grid[wy][wx].watered = true;
  }

  while (waterQueue.length > 0) {
    const [cx, cy] = waterQueue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const key = `${nx},${ny}`;
        const neighbor = grid[ny][nx];
        if (!waterVisited.has(key) && neighbor.type !== TileType.EMPTY) {
          waterVisited.add(key);
          neighbor.watered = waterCapacity >= waterDemand || waterCapacity > 0;
          waterQueue.push([nx, ny]);
        }
      }
    }
  }

  return {
    powerCapacity,
    powerDemand,
    waterCapacity,
    waterDemand,
  };
}
