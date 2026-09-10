import { TileData, TileType } from './types';
import { GAME_CONFIG } from './config';
import { RoadGraph, getAdjacentRoadNodeKey } from './core/simulation/TrafficSubsystem';

export interface NetworkUtilityResult {
  powerCapacity: number;
  powerDemand: number;
  waterCapacity: number;
  waterDemand: number;
  overloadedPowerGrids: number;
  overloadedWaterGrids: number;
}

export interface CityServicesResult {
  healthcareCoverage: number;
  educationCoverage: number;
  fireSafety: number;
  crimeRate: number;
  wasteCapacity: number;
  wasteProduction: number;
  wasteCoverage: number;
  happiness: number;
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

/**
 * Power & Water Network Distribution Engine
 * Analyzes contiguous networks formed by roads, utility plants, and zoned buildings.
 */
export function simulateUtilityNetworks(
  grid: TileData[][],
  unlockedUpgrades: string[]
): NetworkUtilityResult {
  const height = grid.length;
  const width = grid[0].length;
  const hasU = (id: string) => unlockedUpgrades.includes(id);

  const powerCapMult = Math.max(0.1, 1 + (hasU('smart_grid') ? 0.2 : 0) + (hasU('adv_turbines') ? 0.5 : 0) + (hasU('smart_sensors') ? 0.1 : 0));
  const waterCapMult = Math.max(0.1, 1 + (hasU('high_cap_pipes') ? 0.2 : 0) + (hasU('deep_pumps') ? 0.5 : 0) + (hasU('smart_sensors') ? 0.1 : 0));
  
  const powerDemandMult = Math.max(0.1, 1 - (hasU('solar_subsidies') ? 0.1 : 0));
  const waterDemandMult = Math.max(0.1, 1 - (hasU('water_meters') ? 0.1 : 0));

  const visited = Array.from({ length: height }, () => Array(width).fill(false));

  let totalPowerCapacity = 0;
  let totalPowerDemand = 0;
  let totalWaterCapacity = 0;
  let totalWaterDemand = 0;
  let overloadedPowerGrids = 0;
  let overloadedWaterGrids = 0;

  // Reset all tiles before distribution
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid[y][x].powered = false;
      grid[y][x].watered = false;
    }
  }

  // Find all connected utility networks via BFS
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x]) continue;

      const startTile = grid[y][x];
      // Only non-empty tiles conduct utilities through the city grid
      if (startTile.type === TileType.EMPTY) {
        visited[y][x] = true;
        continue;
      }

      // BFS to find connected component network
      const queue: [number, number][] = [[x, y]];
      visited[y][x] = true;
      const componentTiles: TileData[] = [];

      let compPowerCapacity = 0;
      let compWaterCapacity = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        const currentTile = grid[cy][cx];
        componentTiles.push(currentTile);

        // Power Plant generation
        if (currentTile.type === TileType.POWER_PLANT) {
          compPowerCapacity += 50 * powerCapMult;
        }
        // Water Pump generation
        if (currentTile.type === TileType.WATER_PUMP) {
          compWaterCapacity += 50 * waterCapMult;
        }

        // Expand to active non-empty adjacent tiles
        for (const [nx, ny] of getNeighbors(cx, cy, width, height)) {
          if (!visited[ny][nx] && grid[ny][nx].type !== TileType.EMPTY) {
            visited[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }

      compPowerCapacity = Math.round(compPowerCapacity);
      compWaterCapacity = Math.round(compWaterCapacity);

      totalPowerCapacity += compPowerCapacity;
      totalWaterCapacity += compWaterCapacity;

      // Filter demanding buildings (Residential, Commercial, Industrial, and Services)
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
        compPowerDemand += Math.max(1, Math.round(1 * powerDemandMult));
        compWaterDemand += Math.max(1, Math.round(1 * waterDemandMult));
      }

      totalPowerDemand += compPowerDemand;
      totalWaterDemand += compWaterDemand;

      if (compPowerDemand > compPowerCapacity && compPowerCapacity > 0) {
        overloadedPowerGrids++;
      }
      if (compWaterDemand > compWaterCapacity && compWaterCapacity > 0) {
        overloadedWaterGrids++;
      }

      // Allocate power deterministically within this connected network component
      let powerPool = compPowerCapacity;
      for (const tile of demandingTiles) {
        const pReq = Math.max(1, Math.round(1 * powerDemandMult));
        if (powerPool >= pReq) {
          tile.powered = true;
          powerPool -= pReq;
        } else {
          tile.powered = false;
        }
      }

      // Allocate water deterministically within this connected network component
      let waterPool = compWaterCapacity;
      for (const tile of demandingTiles) {
        const wReq = Math.max(1, Math.round(1 * waterDemandMult));
        if (waterPool >= wReq) {
          tile.watered = true;
          waterPool -= wReq;
        } else {
          tile.watered = false;
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

/**
 * City Services Network Engine (Fire, Police, Healthcare, Education, Waste)
 * Uses the road graph to simulate service accessibility, capacity, and reach.
 */
export function simulateCityServices(
  grid: TileData[][],
  roadGraph: RoadGraph,
  totalPopulation: number,
  employedCitizens: number,
  desirability: number,
  averageCommuteTime: number,
  residentialTaxRate: number,
  unlockedUpgrades: string[]
): CityServicesResult {
  const height = grid.length;
  const width = grid[0].length;

  // Reset coverage tags
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid[y][x].fireCovered = false;
      grid[y][x].policeCovered = false;
      grid[y][x].healthCovered = false;
      grid[y][x].schoolCovered = false;
      grid[y][x].wasteCovered = false;
    }
  }

  // Collect active service buildings
  interface ServiceFacility {
    type: TileType;
    x: number;
    y: number;
    roadNodeKey: string;
    range: number;
    capacity: number;
  }

  const facilities: ServiceFacility[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      // A service building is only operational if powered and connected to the road network
      const roadNodeKey = getAdjacentRoadNodeKey(x, y, roadGraph);
      if (!roadNodeKey || !tile.powered) continue;

      if (tile.type === TileType.FIRE_STATION) {
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.FIRE_STATION.ROAD_RANGE,
          capacity: GAME_CONFIG.CITY_SERVICES.FIRE_STATION.CAPACITY,
        });
      } else if (tile.type === TileType.POLICE_STATION) {
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.POLICE_STATION.ROAD_RANGE,
          capacity: GAME_CONFIG.CITY_SERVICES.POLICE_STATION.CAPACITY,
        });
      } else if (tile.type === TileType.CLINIC) {
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.CLINIC.ROAD_RANGE,
          capacity: GAME_CONFIG.CITY_SERVICES.CLINIC.CAPACITY,
        });
      } else if (tile.type === TileType.SCHOOL) {
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.SCHOOL.ROAD_RANGE,
          capacity: GAME_CONFIG.CITY_SERVICES.SCHOOL.CAPACITY,
        });
      } else if (tile.type === TileType.WASTE_MANAGEMENT) {
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.ROAD_RANGE,
          capacity: GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.CAPACITY,
        });
      }
    }
  }

  // Calculate road reach for each facility via Dijkstra/BFS
  for (const facility of facilities) {
    const reachableRoads = new Set<string>();
    const distances = new Map<string, number>();
    const queue: { key: string; dist: number }[] = [{ key: facility.roadNodeKey, dist: 0 }];
    distances.set(facility.roadNodeKey, 0);

    while (queue.length > 0) {
      queue.sort((a, b) => a.dist - b.dist);
      const { key, dist } = queue.shift()!;
      reachableRoads.add(key);

      if (dist >= facility.range) continue;

      const node = roadGraph.nodes.get(key);
      if (!node) continue;

      for (const neighborKey of node.neighbors) {
        const nextDist = dist + 1;
        if (nextDist <= facility.range && (!distances.has(neighborKey) || nextDist < distances.get(neighborKey)!)) {
          distances.set(neighborKey, nextDist);
          queue.push({ key: neighborKey, dist: nextDist });
        }
      }
    }

    // Tag adjacent zoned buildings touched by this covered road network
    for (const roadKey of reachableRoads) {
      const roadNode = roadGraph.nodes.get(roadKey);
      if (!roadNode) continue;

      for (const [nx, ny] of getNeighbors(roadNode.x, roadNode.y, width, height)) {
        const neighborTile = grid[ny][nx];
        if (
          neighborTile.type === TileType.RESIDENTIAL ||
          neighborTile.type === TileType.COMMERCIAL ||
          neighborTile.type === TileType.INDUSTRIAL ||
          neighborTile.type === TileType.FIRE_STATION ||
          neighborTile.type === TileType.POLICE_STATION ||
          neighborTile.type === TileType.CLINIC ||
          neighborTile.type === TileType.SCHOOL ||
          neighborTile.type === TileType.WASTE_MANAGEMENT
        ) {
          if (facility.type === TileType.FIRE_STATION) neighborTile.fireCovered = true;
          if (facility.type === TileType.POLICE_STATION) neighborTile.policeCovered = true;
          if (facility.type === TileType.CLINIC) neighborTile.healthCovered = true;
          if (facility.type === TileType.SCHOOL) neighborTile.schoolCovered = true;
          if (facility.type === TileType.WASTE_MANAGEMENT) neighborTile.wasteCovered = true;
        }
      }
    }
  }

  // Calculate Aggregate Service Metrics
  let totalZonedBuildings = 0;
  let fireCoveredBuildings = 0;
  let healthCoveredPop = 0;
  let schoolCoveredPop = 0;
  let policeCoveredUnits = 0;
  let wasteUnitsProduced = 0;
  let totalWasteCapacity = 0;

  for (const facility of facilities) {
    if (facility.type === TileType.WASTE_MANAGEMENT) {
      totalWasteCapacity += facility.capacity;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.RESIDENTIAL) {
        totalZonedBuildings++;
        if (tile.fireCovered) fireCoveredBuildings++;
        if (tile.healthCovered) healthCoveredPop += tile.population;
        if (tile.schoolCovered) schoolCoveredPop += tile.population;
        if (tile.policeCovered) policeCoveredUnits += tile.population;
        wasteUnitsProduced += tile.population * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_POP_WASTE;
      } else if (tile.type === TileType.COMMERCIAL) {
        totalZonedBuildings++;
        if (tile.fireCovered) fireCoveredBuildings++;
        if (tile.policeCovered) policeCoveredUnits += tile.jobs;
        wasteUnitsProduced += tile.jobs * 0.5;
      } else if (tile.type === TileType.INDUSTRIAL) {
        totalZonedBuildings++;
        if (tile.fireCovered) fireCoveredBuildings++;
        if (tile.policeCovered) policeCoveredUnits += tile.jobs;
        wasteUnitsProduced += tile.jobs * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_IND_WASTE;
      }
    }
  }

  wasteUnitsProduced = Math.round(wasteUnitsProduced);

  // Compute coverage percentages
  const healthcareCoverage = totalPopulation > 0 
    ? Math.min(100, Math.round((healthCoveredPop / totalPopulation) * 100)) 
    : (facilities.some(f => f.type === TileType.CLINIC) ? 100 : 0);

  const educationCoverage = totalPopulation > 0 
    ? Math.min(100, Math.round((schoolCoveredPop / totalPopulation) * 100)) 
    : (facilities.some(f => f.type === TileType.SCHOOL) ? 100 : 0);

  const fireSafety = totalZonedBuildings > 0 
    ? Math.min(100, Math.round((fireCoveredBuildings / totalZonedBuildings) * 100)) 
    : 100;

  const policeRatio = totalPopulation > 0 
    ? Math.min(1, policeCoveredUnits / totalPopulation) 
    : (facilities.some(f => f.type === TileType.POLICE_STATION) ? 1 : 0);
  
  // Crime rate: base 35% without police, drops down to 5% with full police coverage
  const crimeRate = Math.max(5, Math.min(80, Math.round(35 - policeRatio * 30)));

  const wasteCoverage = wasteUnitsProduced > 0 
    ? Math.min(100, Math.round((totalWasteCapacity / wasteUnitsProduced) * 100)) 
    : (totalWasteCapacity > 0 ? 100 : 80);

  // Happiness calculation (0 to 100% composite score)
  let happiness = 50;
  // Services boost happiness
  happiness += (healthcareCoverage - 50) * 0.15;
  happiness += (educationCoverage - 50) * 0.15;
  happiness += (fireSafety - 50) * 0.15;
  happiness += (50 - crimeRate) * 0.2;
  happiness += (wasteCoverage - 50) * 0.15;
  
  // Traffic & commute friction
  if (averageCommuteTime > 8) {
    happiness -= Math.min(15, (averageCommuteTime - 8) * 1.5);
  }

  // Tax friction
  if (residentialTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    happiness -= (residentialTaxRate - GAME_CONFIG.TAX_OPTIMAL) * 2;
  } else {
    happiness += (GAME_CONFIG.TAX_OPTIMAL - residentialTaxRate) * 1.5;
  }

  happiness = Math.max(0, Math.min(100, Math.round(happiness)));

  return {
    healthcareCoverage,
    educationCoverage,
    fireSafety,
    crimeRate,
    wasteCapacity: totalWasteCapacity,
    wasteProduction: wasteUnitsProduced,
    wasteCoverage,
    happiness,
  };
}
