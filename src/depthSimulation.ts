import { TileData, TileType, CityState } from './types';
import { RoadGraph, getAdjacentRoadNodeKey } from './traffic';

export const RESIDENTIAL_CAPACITIES = [0, 4, 12, 25, 50, 100];
export const COMMERCIAL_CAPACITIES = [0, 4, 12, 25, 50, 90];
export const INDUSTRIAL_CAPACITIES = [0, 5, 15, 30, 55, 90];

export const BUILDING_NAMES = {
  RESIDENTIAL: [
    'Empty Plot',
    'Small Housing',
    'Townhouse',
    'Apartment Block',
    'High-Rise Residences',
    'Residential Skyscraper'
  ],
  COMMERCIAL: [
    'Empty Plot',
    'Small Shop',
    'Office Building',
    'Commercial Complex',
    'Commercial Tower',
    'Commercial Skyscraper'
  ],
  INDUSTRIAL: [
    'Empty Plot',
    'Workshop',
    'Factory',
    'Industrial Complex',
    'Advanced Industry',
    'High-Tech Industrial Hub'
  ]
};

export interface DepthSimulationResult {
  landValueAverage: number;
  pollutionAverage: number;
  noiseAverage: number;
  educationLevel: number;
  healthIndex: number;
  buildingLevelCounts: {
    residential: number[];
    commercial: number[];
    industrial: number[];
  };
}

/**
 * Simulates Land Value, Pollution, Noise, Health, Education, and Crime across the city grid.
 */
export function simulateCityDepthAndEnvironment(
  grid: TileData[][],
  roadGraph: RoadGraph,
  unlockedUpgrades: string[]
): DepthSimulationResult {
  const height = grid.length;
  const width = grid[0].length;
  const hasU = (id: string) => unlockedUpgrades.includes(id);

  // Initialize depth maps
  const pollutionMap = Array.from({ length: height }, () => Array(width).fill(0));
  const noiseMap = Array.from({ length: height }, () => Array(width).fill(0));

  // 1. Calculate Pollution & Noise sources
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];

      let pollSource = 0;
      let noiseSource = 0;

      if (tile.type === TileType.POWER_PLANT) {
        pollSource = 35;
        noiseSource = 20;
      } else if (tile.type === TileType.INDUSTRIAL) {
        // High level industrial L4/L5 are cleaner high-tech
        if (tile.level === 1) { pollSource = 8; noiseSource = 8; }
        else if (tile.level === 2) { pollSource = 18; noiseSource = 15; }
        else if (tile.level === 3) { pollSource = 28; noiseSource = 22; }
        else if (tile.level === 4) { pollSource = 12; noiseSource = 10; }
        else if (tile.level === 5) { pollSource = 5; noiseSource = 5; }
      } else if (tile.type === TileType.ROAD && tile.traffic > 5) {
        pollSource = Math.min(25, Math.round(tile.traffic * 0.8));
        noiseSource = Math.min(35, Math.round(tile.traffic * 1.2));
      } else if (tile.type === TileType.WASTE_MANAGEMENT) {
        pollSource = 15;
        noiseSource = 10;
      }

      // Environmental policies & park absorption
      if (hasU('recycling')) pollSource *= 0.8;
      if (hasU('green_roofs')) pollSource *= 0.85;

      if (pollSource > 0 || noiseSource > 0) {
        // Spread radiation in a 3-4 tile radius
        const radius = 3;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= radius) {
                const decay = (radius - dist) / radius;
                pollutionMap[ny][nx] += pollSource * decay;
                noiseMap[ny][nx] += noiseSource * decay;
              }
            }
          }
        }
      }
    }
  }

  // 2. Apply Parks absorption & calculate Land Value, Crime, Health, Education per tile
  let totalLandValue = 0;
  let totalPollution = 0;
  let totalNoise = 0;
  let totalHealth = 0;
  let totalEducation = 0;
  let activeTilesCount = 0;

  const resLevels = [0, 0, 0, 0, 0, 0];
  const comLevels = [0, 0, 0, 0, 0, 0];
  const indLevels = [0, 0, 0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];

      // Park absorption
      if (tile.type === TileType.PARK) {
        const radius = 3;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              pollutionMap[ny][nx] = Math.max(0, pollutionMap[ny][nx] - 12);
              noiseMap[ny][nx] = Math.max(0, noiseMap[ny][nx] - 10);
            }
          }
        }
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];

      const pVal = Math.min(100, Math.round(pollutionMap[y][x]));
      const nVal = Math.min(100, Math.round(noiseMap[y][x]));

      tile.pollution = pVal;
      tile.noise = nVal;

      // Local Health: boosted by healthcare, penalized by pollution & missing waste
      let health = (tile.healthCovered ? 85 : 40) - (pVal * 0.4) - (tile.wasteCovered ? 0 : 20);
      health = Math.max(0, Math.min(100, Math.round(health)));
      tile.health = health;

      // Local Education: boosted by schools over time
      let edu = tile.education ?? 0;
      if (tile.schoolCovered) {
        edu = Math.min(100, edu + 5);
      } else {
        edu = Math.max(0, edu - 2);
      }
      tile.education = edu;

      // Local Crime: police coverage suppresses crime
      let crime = tile.policeCovered ? 10 : 45;
      if (nVal > 40) crime += 10;
      crime = Math.max(0, Math.min(100, Math.round(crime)));
      tile.crime = crime;

      // Local Land Value Calculation
      let lv = 35; // base
      if (tile.fireCovered) lv += 10;
      if (tile.policeCovered) lv += 10;
      if (tile.healthCovered) lv += 10;
      if (tile.schoolCovered) lv += 10;

      // Nearby Park check (3-tile Manhattan radius)
      let nearbyPark = false;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (grid[ny][nx].type === TileType.PARK) nearbyPark = true;
          }
        }
      }
      if (nearbyPark) lv += 25;

      lv -= (pVal * 0.35) + (nVal * 0.25) + (crime * 0.3);
      lv = Math.max(0, Math.min(100, Math.round(lv)));
      tile.landValue = lv;

      // Accumulate stats
      if (tile.type !== TileType.EMPTY) {
        totalLandValue += lv;
        totalPollution += pVal;
        totalNoise += nVal;
        totalHealth += health;
        totalEducation += edu;
        activeTilesCount++;
      }

      // Count building levels
      if (tile.type === TileType.RESIDENTIAL && !tile.abandoned) {
        resLevels[Math.min(5, Math.max(1, tile.level))]++;
      } else if (tile.type === TileType.COMMERCIAL && !tile.abandoned) {
        comLevels[Math.min(5, Math.max(1, tile.level))]++;
      } else if (tile.type === TileType.INDUSTRIAL && !tile.abandoned) {
        indLevels[Math.min(5, Math.max(1, tile.level))]++;
      }
    }
  }

  const denominator = Math.max(1, activeTilesCount);

  return {
    landValueAverage: Math.round(totalLandValue / denominator),
    pollutionAverage: Math.round(totalPollution / denominator),
    noiseAverage: Math.round(totalNoise / denominator),
    educationLevel: Math.round(totalEducation / denominator),
    healthIndex: Math.round(totalHealth / denominator),
    buildingLevelCounts: {
      residential: resLevels.slice(1), // L1 to L5
      commercial: comLevels.slice(1),
      industrial: indLevels.slice(1),
    }
  };
}

/**
 * Simulates Building Evolution (Level 1 to 5) with Stability & Progression Requirements.
 */
export function simulateBuildingEvolution(
  grid: TileData[][],
  roadGraph: RoadGraph,
  resDemand: number,
  comDemand: number,
  indDemand: number,
  unlockedUpgrades: string[]
): void {
  const height = grid.length;
  const width = grid[0].length;
  const hasU = (id: string) => unlockedUpgrades.includes(id);

  const maxResLevel = hasU('sky_permits') ? 5 : (hasU('high_dens_res') ? 3 : 2);
  const maxComLevel = hasU('sky_permits') ? 5 : (hasU('high_dens_com') ? 3 : 2);
  const maxIndLevel = hasU('sky_permits') ? 5 : (hasU('high_dens_ind') ? 3 : 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];

      if (
        tile.type !== TileType.RESIDENTIAL &&
        tile.type !== TileType.COMMERCIAL &&
        tile.type !== TileType.INDUSTRIAL
      ) {
        continue;
      }

      const hasRoad = getAdjacentRoadNodeKey(x, y, roadGraph) !== null;
      const isActive = tile.powered && tile.watered && hasRoad;

      if (!isActive) {
        tile.upgradeProgress = 0;
        tile.jobs = Math.max(0, tile.jobs - 2);
        tile.population = Math.max(0, tile.population - 2);
        if (tile.population === 0 && tile.jobs === 0) {
          tile.abandoned = true;
          if (tile.level > 1) tile.level = Math.max(1, tile.level - 1);
        }
        continue;
      }

      // Active building evaluation
      if (tile.abandoned) {
        const demand = tile.type === TileType.RESIDENTIAL ? resDemand : (tile.type === TileType.COMMERCIAL ? comDemand : indDemand);
        if (demand > 10) {
          tile.abandoned = false;
          tile.upgradeProgress = 0;
        }
        continue;
      }

      let currentLevel = Math.min(5, Math.max(1, tile.level));
      let currentCap = 0;
      let targetDemand = 0;
      let maxLevel = 1;

      if (tile.type === TileType.RESIDENTIAL) {
        currentCap = RESIDENTIAL_CAPACITIES[currentLevel];
        targetDemand = resDemand;
        maxLevel = maxResLevel;
      } else if (tile.type === TileType.COMMERCIAL) {
        currentCap = COMMERCIAL_CAPACITIES[currentLevel];
        targetDemand = comDemand;
        maxLevel = maxComLevel;
      } else {
        currentCap = INDUSTRIAL_CAPACITIES[currentLevel];
        targetDemand = indDemand;
        maxLevel = maxIndLevel;
      }

      const currentOcc = tile.type === TileType.RESIDENTIAL ? tile.population : tile.jobs;
      const occupancyRatio = currentCap > 0 ? currentOcc / currentCap : 0;

      // Evolution Check to Upgrade to Next Level
      if (currentLevel < maxLevel && occupancyRatio >= 0.75 && targetDemand > 0) {
        let reqsMet = false;

        const nextLevel = currentLevel + 1;
        const lv = tile.landValue ?? 30;
        const pVal = tile.pollution ?? 0;
        const cVal = tile.crime ?? 30;
        const edu = tile.education ?? 0;

        if (nextLevel === 2) {
          reqsMet = lv >= 20;
        } else if (nextLevel === 3) {
          reqsMet = lv >= 35 && (tile.fireCovered || tile.policeCovered);
        } else if (nextLevel === 4) {
          reqsMet = lv >= 50 && tile.fireCovered && tile.policeCovered && (tile.healthCovered || tile.schoolCovered) && pVal < 35;
        } else if (nextLevel === 5) {
          reqsMet = lv >= 65 && tile.fireCovered && tile.policeCovered && tile.healthCovered && tile.schoolCovered && tile.wasteCovered && edu >= 50 && pVal < 25 && cVal < 20;
        }

        if (reqsMet) {
          tile.upgradeProgress = (tile.upgradeProgress ?? 0) + 25;
          if (tile.upgradeProgress >= 100) {
            tile.level = nextLevel;
            tile.upgradeProgress = 0;
          }
        } else {
          tile.upgradeProgress = Math.max(0, (tile.upgradeProgress ?? 0) - 10);
        }
      } else {
        tile.upgradeProgress = Math.max(0, (tile.upgradeProgress ?? 0) - 10);
      }

      // Check degradation if conditions severely decay
      if (tile.pollution! > 75 || tile.crime! > 75) {
        tile.upgradeProgress = 0;
        if (tile.level > 1) {
          tile.level -= 1;
        } else {
          tile.abandoned = true;
        }
      }
    }
  }
}
