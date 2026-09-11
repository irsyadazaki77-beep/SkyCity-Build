import { TileData, TileType, ServiceBudgets } from './types';
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
 * Uses the road graph to simulate service accessibility, distance attenuation, and capacity constraints.
 */
export function simulateCityServices(
  grid: TileData[][],
  roadGraph: RoadGraph,
  totalPopulation: number,
  employedCitizens: number,
  desirability: number,
  averageCommuteTime: number,
  residentialTaxRate: number,
  unlockedUpgrades: string[],
  serviceBudgets?: ServiceBudgets,
  strikingSectors: string[] = [],
  isFiscalCrisis = false
): CityServicesResult {
  const height = grid.length;
  const width = grid[0].length;
  const hasU = (id: string) => unlockedUpgrades.includes(id);

  const striking = new Set(strikingSectors);

  // Department Budget Multipliers (50% to 150%)
  const fireBudgetMult = (serviceBudgets?.fire ?? 100) / 100;
  const policeBudgetMult = (serviceBudgets?.police ?? 100) / 100;
  const healthBudgetMult = (serviceBudgets?.health ?? 100) / 100;
  const eduBudgetMult = (serviceBudgets?.education ?? 100) / 100;
  const wasteBudgetMult = (serviceBudgets?.waste ?? 100) / 100;
  const parksBudgetMult = (serviceBudgets?.parks ?? 100) / 100;

  // Upgrade bonuses
  const aiCapacityMult = hasU('ai_management') ? 1.25 : 1.0;
  const sensorRangeBonus = hasU('smart_sensors') ? 2 : 0;
  const transitRangeBonus = (hasU('bus_network') ? 2 : 0) + (hasU('tram_system') ? 2 : 0);
  const recyclingCapMult = hasU('recycling') ? 1.35 : 1.0;

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
    remainingCapacity: number;
  }

  const fireFacilities: ServiceFacility[] = [];
  const policeFacilities: ServiceFacility[] = [];
  const clinicFacilities: ServiceFacility[] = [];
  const schoolFacilities: ServiceFacility[] = [];
  const wasteFacilities: ServiceFacility[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      // A service building is only operational if powered and connected to the road network
      const roadNodeKey = getAdjacentRoadNodeKey(x, y, roadGraph);
      if (!roadNodeKey || !tile.powered) continue;

      if (tile.type === TileType.FIRE_STATION) {
        const isStrike = striking.has('fire');
        const cap = isStrike ? 30 : Math.round(GAME_CONFIG.CITY_SERVICES.FIRE_STATION.CAPACITY * aiCapacityMult * fireBudgetMult);
        const range = isStrike ? 3 : Math.max(3, Math.round((GAME_CONFIG.CITY_SERVICES.FIRE_STATION.ROAD_RANGE + sensorRangeBonus) * Math.sqrt(fireBudgetMult)));
        fireFacilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range,
          capacity: cap,
          remainingCapacity: cap,
        });
      } else if (tile.type === TileType.POLICE_STATION) {
        const isStrike = striking.has('police');
        const cap = isStrike ? 30 : Math.round(GAME_CONFIG.CITY_SERVICES.POLICE_STATION.CAPACITY * aiCapacityMult * policeBudgetMult);
        const range = isStrike ? 3 : Math.max(3, Math.round((GAME_CONFIG.CITY_SERVICES.POLICE_STATION.ROAD_RANGE + sensorRangeBonus) * Math.sqrt(policeBudgetMult)));
        policeFacilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range,
          capacity: cap,
          remainingCapacity: cap,
        });
      } else if (tile.type === TileType.CLINIC) {
        const isStrike = striking.has('health');
        const cap = isStrike ? 25 : Math.round(GAME_CONFIG.CITY_SERVICES.CLINIC.CAPACITY * aiCapacityMult * healthBudgetMult);
        const range = isStrike ? 4 : Math.max(4, Math.round((GAME_CONFIG.CITY_SERVICES.CLINIC.ROAD_RANGE + sensorRangeBonus + transitRangeBonus) * Math.sqrt(healthBudgetMult)));
        clinicFacilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range,
          capacity: cap,
          remainingCapacity: cap,
        });
      } else if (tile.type === TileType.SCHOOL) {
        const isStrike = striking.has('education');
        const cap = isStrike ? 20 : Math.round(GAME_CONFIG.CITY_SERVICES.SCHOOL.CAPACITY * aiCapacityMult * eduBudgetMult);
        const range = isStrike ? 4 : Math.max(4, Math.round((GAME_CONFIG.CITY_SERVICES.SCHOOL.ROAD_RANGE + sensorRangeBonus + transitRangeBonus) * Math.sqrt(eduBudgetMult)));
        schoolFacilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range,
          capacity: cap,
          remainingCapacity: cap,
        });
      } else if (tile.type === TileType.WASTE_MANAGEMENT) {
        const isStrike = striking.has('waste');
        const cap = isStrike ? 40 : Math.round(GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.CAPACITY * aiCapacityMult * recyclingCapMult * wasteBudgetMult);
        const range = isStrike ? 4 : Math.max(4, Math.round((GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.ROAD_RANGE + sensorRangeBonus) * Math.sqrt(wasteBudgetMult)));
        wasteFacilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range,
          capacity: cap,
          remainingCapacity: cap,
        });
      }
    }
  }

  /**
   * Helper to perform road Dijkstra / BFS for a set of facilities and allocate capacity to demanding tiles
   */
  function allocateService(
    facilitiesList: ServiceFacility[],
    isTarget: (t: TileData) => boolean,
    getDemand: (t: TileData) => number,
    applyCoverage: (t: TileData, covered: boolean, score: number) => void
  ) {
    if (facilitiesList.length === 0) return;

    // Collect all candidate target tiles with their closest road distance to any facility of this type
    interface TargetCandidate {
      tile: TileData;
      x: number;
      y: number;
      minDist: number;
      facilityIndex: number;
      demand: number;
    }

    const candidates: TargetCandidate[] = [];
    const tileVisited = new Set<string>();

    for (let fIdx = 0; fIdx < facilitiesList.length; fIdx++) {
      const fac = facilitiesList[fIdx];
      const distances = new Map<string, number>();
      const queue: { key: string; dist: number }[] = [{ key: fac.roadNodeKey, dist: 0 }];
      distances.set(fac.roadNodeKey, 0);

      while (queue.length > 0) {
        queue.sort((a, b) => a.dist - b.dist);
        const { key, dist } = queue.shift()!;
        if (dist >= fac.range) continue;

        const node = roadGraph.nodes.get(key);
        if (!node) continue;

        for (const neighborKey of node.neighbors) {
          const nextDist = dist + 1;
          if (nextDist <= fac.range && (!distances.has(neighborKey) || nextDist < distances.get(neighborKey)!)) {
            distances.set(neighborKey, nextDist);
            queue.push({ key: neighborKey, dist: nextDist });
          }
        }
      }

      // Check all tiles adjacent to reachable roads
      for (const [roadKey, roadDist] of distances.entries()) {
        const roadNode = roadGraph.nodes.get(roadKey);
        if (!roadNode) continue;

        for (const [nx, ny] of getNeighbors(roadNode.x, roadNode.y, width, height)) {
          const t = grid[ny][nx];
          if (isTarget(t)) {
            const tileKey = `${nx},${ny}`;
            const demand = getDemand(t);
            candidates.push({
              tile: t,
              x: nx,
              y: ny,
              minDist: roadDist,
              facilityIndex: fIdx,
              demand,
            });
          }
        }
      }
    }

    // Sort candidates by road distance (closer tiles receive priority service)
    candidates.sort((a, b) => a.minDist - b.minDist);

    const servedTiles = new Set<string>();

    for (const cand of candidates) {
      const key = `${cand.x},${cand.y}`;
      if (servedTiles.has(key)) continue;

      const fac = facilitiesList[cand.facilityIndex];
      const req = Math.max(1, cand.demand);

      if (fac.remainingCapacity >= req) {
        fac.remainingCapacity -= req;
        servedTiles.add(key);
        // Distance decay factor
        const decay = Math.max(0.4, 1 - (cand.minDist / (fac.range + 1)) * 0.45);
        applyCoverage(cand.tile, true, Math.round(decay * 100));
      } else if (fac.remainingCapacity > 0) {
        // Partial coverage for slightly overloaded facility
        const partialRatio = fac.remainingCapacity / req;
        fac.remainingCapacity = 0;
        servedTiles.add(key);
        const decay = Math.max(0.2, (1 - (cand.minDist / (fac.range + 1)) * 0.45) * partialRatio);
        applyCoverage(cand.tile, partialRatio >= 0.6, Math.round(decay * 100));
      }
    }
  }

  // 1. Allocate Fire Protection (covers all zoned buildings and utility facilities)
  allocateService(
    fireFacilities,
    (t) => [
      TileType.RESIDENTIAL,
      TileType.COMMERCIAL,
      TileType.INDUSTRIAL,
      TileType.POWER_PLANT,
      TileType.WATER_PUMP,
      TileType.POLICE_STATION,
      TileType.CLINIC,
      TileType.SCHOOL,
      TileType.WASTE_MANAGEMENT,
    ].includes(t.type),
    () => 1,
    (t, covered) => {
      t.fireCovered = covered;
    }
  );

  // 2. Allocate Police Protection (covers Residential, Commercial, Industrial based on pop + jobs)
  allocateService(
    policeFacilities,
    (t) => [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL].includes(t.type),
    (t) => (t.type === TileType.RESIDENTIAL ? Math.max(1, t.population || 1) : Math.max(1, t.jobs || 1)),
    (t, covered) => {
      t.policeCovered = covered;
    }
  );

  // 3. Allocate Healthcare (covers Residential population)
  allocateService(
    clinicFacilities,
    (t) => t.type === TileType.RESIDENTIAL,
    (t) => Math.max(1, t.population || 1),
    (t, covered) => {
      t.healthCovered = covered;
    }
  );

  // 4. Allocate School / Education (covers Residential population)
  allocateService(
    schoolFacilities,
    (t) => t.type === TileType.RESIDENTIAL,
    (t) => Math.max(1, Math.round((t.population || 1) * 0.7)),
    (t, covered) => {
      t.schoolCovered = covered;
    }
  );

  // 5. Allocate Waste Management (covers all zoned buildings based on tonnage produced)
  allocateService(
    wasteFacilities,
    (t) => [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL].includes(t.type),
    (t) => {
      if (t.type === TileType.RESIDENTIAL) return Math.max(1, Math.round((t.population || 1) * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_POP_WASTE));
      if (t.type === TileType.COMMERCIAL) return Math.max(1, Math.round((t.jobs || 1) * 0.5));
      return Math.max(1, Math.round((t.jobs || 1) * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_IND_WASTE));
    },
    (t, covered) => {
      t.wasteCovered = covered;
    }
  );

  // Calculate Aggregate Service Metrics
  let totalZonedBuildings = 0;
  let fireCoveredBuildings = 0;
  let healthCoveredPop = 0;
  let schoolCoveredPop = 0;
  let policeCoveredUnits = 0;
  let wasteUnitsProduced = 0;
  let totalWasteCapacity = 0;

  for (const facility of wasteFacilities) {
    totalWasteCapacity += facility.capacity;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.RESIDENTIAL) {
        totalZonedBuildings++;
        if (tile.fireCovered) fireCoveredBuildings++;
        if (tile.healthCovered) healthCoveredPop += (tile.population || 0);
        if (tile.schoolCovered) schoolCoveredPop += (tile.population || 0);
        if (tile.policeCovered) policeCoveredUnits += (tile.population || 0);
        wasteUnitsProduced += (tile.population || 0) * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_POP_WASTE;
      } else if (tile.type === TileType.COMMERCIAL) {
        totalZonedBuildings++;
        if (tile.fireCovered) fireCoveredBuildings++;
        if (tile.policeCovered) policeCoveredUnits += (tile.jobs || 0);
        wasteUnitsProduced += (tile.jobs || 0) * 0.5;
      } else if (tile.type === TileType.INDUSTRIAL) {
        totalZonedBuildings++;
        if (tile.fireCovered) fireCoveredBuildings++;
        if (tile.policeCovered) policeCoveredUnits += (tile.jobs || 0);
        wasteUnitsProduced += (tile.jobs || 0) * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_IND_WASTE;
      }
    }
  }

  wasteUnitsProduced = Math.round(wasteUnitsProduced);

  // Compute coverage percentages
  const healthcareCoverage = totalPopulation > 0 
    ? Math.min(100, Math.round((healthCoveredPop / totalPopulation) * 100)) 
    : (clinicFacilities.length > 0 ? 100 : 0);

  const educationCoverage = totalPopulation > 0 
    ? Math.min(100, Math.round((schoolCoveredPop / totalPopulation) * 100)) 
    : (schoolFacilities.length > 0 ? 100 : 0);

  const fireSafety = totalZonedBuildings > 0 
    ? Math.min(100, Math.round((fireCoveredBuildings / totalZonedBuildings) * 100)) 
    : 100;

  const policeRatio = totalPopulation > 0 
    ? Math.min(1, policeCoveredUnits / totalPopulation) 
    : (policeFacilities.length > 0 ? 1 : 0);
  
  // Crime rate: base 35% without police, drops down to 5% with full police coverage
  let crimeRate = Math.max(5, Math.min(80, Math.round(35 - policeRatio * 30)));
  if (striking.has('police')) {
    crimeRate = Math.min(95, crimeRate + 30);
  }

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
  
  // Parks budget impact
  happiness += (parksBudgetMult - 1.0) * 8;

  // Fiscal Crisis Morale penalty
  if (isFiscalCrisis) {
    happiness -= GAME_CONFIG.CRISIS_HAPPINESS_PENALTY;
  }
  
  // Traffic & commute friction
  if (averageCommuteTime > 8) {
    happiness -= Math.min(22, (averageCommuteTime - 8) * 1.8);
  } else if (averageCommuteTime > 0 && averageCommuteTime <= 5) {
    happiness += 5; // Fast, smooth commute bonus
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
