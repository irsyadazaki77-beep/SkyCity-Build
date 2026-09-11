import { TileData, TileType, ActiveEvent, ServiceBudgets } from '../../types';
import { GAME_CONFIG } from '../../config';

export interface UtilitiesResult {
  powerCapacity: number;
  powerDemand: number;
  waterCapacity: number;
  waterDemand: number;
  overloadedPowerGrids?: number;
  overloadedWaterGrids?: number;
}

/**
 * Helper to get 4-directional neighboring coordinates within grid bounds
 */
function getNeighbors(x: number, y: number, width: number, height: number): [number, number][] {
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const neighbors: [number, number][] = [];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      neighbors.push([nx, ny]);
    }
  }
  return neighbors;
}

export function simulateUtilityNetworks(
  grid: TileData[][],
  unlockedUpgrades: string[] = [],
  activeEvents: ActiveEvent[] = [],
  serviceBudgets?: ServiceBudgets
): UtilitiesResult {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const hasU = (id: string) => unlockedUpgrades.includes(id);
  const powerBudgetMult = Math.pow((serviceBudgets?.power ?? 100) / 100, 1.25);
  const waterBudgetMult = Math.pow((serviceBudgets?.water ?? 100) / 100, 1.25);

  const powerCapMult = Math.max(0.1, (1 + (hasU('smart_grid') ? 0.2 : 0) + (hasU('adv_turbines') ? 0.5 : 0) + (hasU('smart_sensors') ? 0.1 : 0) + (hasU('solar_expansion') ? 0.5 : 0)) * powerBudgetMult);
  const waterCapMult = Math.max(0.1, (1 + (hasU('high_cap_pipes') ? 0.2 : 0) + (hasU('deep_pumps') ? 0.5 : 0) + (hasU('smart_sensors') ? 0.1 : 0) + (hasU('water_recycling') ? 0.4 : 0)) * waterBudgetMult);

  const powerDemandMult = Math.max(0.1, 1 - (hasU('solar_subsidies') ? 0.1 : 0));
  const waterDemandMult = Math.max(0.1, 1 - (hasU('water_meters') ? 0.1 : 0));

  // Event multipliers
  let eventPowerCapMult = 1.0;
  let eventWaterCapMult = 1.0;
  let eventPowerDemandMult = 1.0;
  let eventWaterDemandMult = 1.0;

  for (const ev of activeEvents) {
    if (ev.type === 'heatwave') {
      eventPowerDemandMult *= 1.5;
      eventWaterDemandMult *= 1.5;
    } else if (ev.type === 'power_shortage') {
      eventPowerCapMult *= 0.7;
    }
  }

  // Reset utility status across all tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid[y][x].powered = false;
      grid[y][x].watered = false;
    }
  }

  const visited = Array.from({ length: height }, () => Array(width).fill(false));

  let totalPowerCapacity = 0;
  let totalPowerDemand = 0;
  let totalWaterCapacity = 0;
  let totalWaterDemand = 0;
  let overloadedPowerGrids = 0;
  let overloadedWaterGrids = 0;

  // Connected network component traversal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x]) continue;

      const startTile = grid[y][x];
      if (startTile.type === TileType.EMPTY) {
        visited[y][x] = true;
        continue;
      }

      // BFS to explore contiguous network component
      const queue: [number, number][] = [[x, y]];
      visited[y][x] = true;
      const componentTiles: TileData[] = [];
      const powerSources: [number, number][] = [];
      const waterSources: [number, number][] = [];

      let compPowerCapacity = 0;
      let compWaterCapacity = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        const currentTile = grid[cy][cx];
        componentTiles.push(currentTile);

        if (currentTile.type === TileType.POWER_PLANT) {
          const cap = Math.round(50 * powerCapMult * eventPowerCapMult);
          compPowerCapacity += cap;
          powerSources.push([cx, cy]);
        } else if (currentTile.type === TileType.WATER_PUMP) {
          const cap = Math.round(50 * waterCapMult * eventWaterCapMult);
          compWaterCapacity += cap;
          waterSources.push([cx, cy]);
        }

        for (const [nx, ny] of getNeighbors(cx, cy, width, height)) {
          if (!visited[ny][nx] && grid[ny][nx].type !== TileType.EMPTY) {
            visited[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }

      totalPowerCapacity += compPowerCapacity;
      totalWaterCapacity += compWaterCapacity;

      // Filter demanding tiles in this component
      const demandingTiles = componentTiles.filter(t => 
        t.type === TileType.RESIDENTIAL ||
        t.type === TileType.COMMERCIAL ||
        t.type === TileType.INDUSTRIAL ||
        t.type === TileType.FIRE_STATION ||
        t.type === TileType.POLICE_STATION ||
        t.type === TileType.CLINIC ||
        t.type === TileType.SCHOOL ||
        t.type === TileType.WASTE_MANAGEMENT
      );

      let compPowerDemand = 0;
      let compWaterDemand = 0;

      for (const tile of demandingTiles) {
        const lvl = Math.min(5, Math.max(1, tile.level || 1));
        let pReq = 1;
        let wReq = 1;

        if (tile.type === TileType.RESIDENTIAL) {
          pReq = lvl * 2;
          wReq = lvl * 2;
        } else if (tile.type === TileType.COMMERCIAL) {
          pReq = lvl * 3;
          wReq = lvl * 2;
        } else if (tile.type === TileType.INDUSTRIAL) {
          pReq = lvl * 5;
          wReq = lvl * 4;
        } else {
          pReq = 2;
          wReq = 2;
        }

        pReq = Math.max(1, Math.round(pReq * powerDemandMult * eventPowerDemandMult));
        wReq = Math.max(1, Math.round(wReq * waterDemandMult * eventWaterDemandMult));

        compPowerDemand += pReq;
        compWaterDemand += wReq;
      }

      totalPowerDemand += compPowerDemand;
      totalWaterDemand += compWaterDemand;

      if (compPowerDemand > compPowerCapacity && compPowerCapacity > 0) {
        overloadedPowerGrids++;
      }
      if (compWaterDemand > compWaterCapacity && compWaterCapacity > 0) {
        overloadedWaterGrids++;
      }

      // Allocate power via BFS from power sources
      if (powerSources.length > 0 && compPowerCapacity > 0) {
        const powerDistQueue: { x: number; y: number; dist: number }[] = [];
        const powerDistMap = new Map<string, number>();

        for (const [px, py] of powerSources) {
          powerDistQueue.push({ x: px, y: py, dist: 0 });
          powerDistMap.set(`${px},${py}`, 0);
          grid[py][px].powered = true;
        }

        while (powerDistQueue.length > 0) {
          const { x: cx, y: cy, dist } = powerDistQueue.shift()!;
          for (const [nx, ny] of getNeighbors(cx, cy, width, height)) {
            const key = `${nx},${ny}`;
            if (grid[ny][nx].type !== TileType.EMPTY && !powerDistMap.has(key)) {
              powerDistMap.set(key, dist + 1);
              powerDistQueue.push({ x: nx, y: ny, dist: dist + 1 });
            }
          }
        }

        // Sort demanding tiles by distance to nearest power source (closer get power first)
        const sortedForPower = [...demandingTiles].sort((a, b) => {
          const dA = powerDistMap.get(`${a.x},${a.y}`) ?? 9999;
          const dB = powerDistMap.get(`${b.x},${b.y}`) ?? 9999;
          return dA - dB;
        });

        let remainingPower = compPowerCapacity;
        for (const tile of sortedForPower) {
          const lvl = Math.min(5, Math.max(1, tile.level || 1));
          let pReq = tile.type === TileType.RESIDENTIAL ? lvl * 2 : (tile.type === TileType.COMMERCIAL ? lvl * 3 : (tile.type === TileType.INDUSTRIAL ? lvl * 5 : 2));
          pReq = Math.max(1, Math.round(pReq * powerDemandMult * eventPowerDemandMult));

          if (remainingPower >= pReq) {
            tile.powered = true;
            remainingPower -= pReq;
          } else {
            tile.powered = false; // Grid overload brownout
          }
        }
      }

      // Allocate water via BFS from water sources
      if (waterSources.length > 0 && compWaterCapacity > 0) {
        const waterDistQueue: { x: number; y: number; dist: number }[] = [];
        const waterDistMap = new Map<string, number>();

        for (const [wx, wy] of waterSources) {
          waterDistQueue.push({ x: wx, y: wy, dist: 0 });
          waterDistMap.set(`${wx},${wy}`, 0);
          grid[wy][wx].watered = true;
        }

        while (waterDistQueue.length > 0) {
          const { x: cx, y: cy, dist } = waterDistQueue.shift()!;
          for (const [nx, ny] of getNeighbors(cx, cy, width, height)) {
            const key = `${nx},${ny}`;
            if (grid[ny][nx].type !== TileType.EMPTY && !waterDistMap.has(key)) {
              waterDistMap.set(key, dist + 1);
              waterDistQueue.push({ x: nx, y: ny, dist: dist + 1 });
            }
          }
        }

        // Sort demanding tiles by distance to nearest water pump
        const sortedForWater = [...demandingTiles].sort((a, b) => {
          const dA = waterDistMap.get(`${a.x},${a.y}`) ?? 9999;
          const dB = waterDistMap.get(`${b.x},${b.y}`) ?? 9999;
          return dA - dB;
        });

        let remainingWater = compWaterCapacity;
        for (const tile of sortedForWater) {
          const lvl = Math.min(5, Math.max(1, tile.level || 1));
          let wReq = tile.type === TileType.RESIDENTIAL ? lvl * 2 : (tile.type === TileType.COMMERCIAL ? lvl * 2 : (tile.type === TileType.INDUSTRIAL ? lvl * 4 : 2));
          wReq = Math.max(1, Math.round(wReq * waterDemandMult * eventWaterDemandMult));

          if (remainingWater >= wReq) {
            tile.watered = true;
            remainingWater -= wReq;
          } else {
            tile.watered = false; // Water shortage
          }
        }
      }
    }
  }

  return {
    powerCapacity: totalPowerCapacity,
    powerDemand: totalPowerDemand,
    waterCapacity: totalWaterCapacity,
    waterDemand: totalWaterDemand,
    overloadedPowerGrids,
    overloadedWaterGrids,
  };
}

