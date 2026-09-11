import { TileData, TileType, CityState } from './types';
import { RoadGraph, getAdjacentRoadNodeKey } from './core/simulation/TrafficSubsystem';

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

      // Local Health: boosted by healthcare (clinic), penalized by pollution, noise, uncollected waste, missing water/power
      let health = (tile.healthCovered ? 85 : 40);
      health -= (pVal * 0.45);
      health -= (nVal * 0.15);
      if (!tile.wasteCovered) health -= 25; // Severe sanitation sickness penalty
      if (!tile.watered) health -= 30;      // Dehydration & sanitation crisis
      if (!tile.powered) health -= 15;      // Cold/spoilage issues
      health = Math.max(0, Math.min(100, Math.round(health)));
      tile.health = health;

      // Local Education: boosted by schools and power over time
      let edu = tile.education ?? 0;
      if (tile.schoolCovered && tile.powered) {
        edu = Math.min(100, edu + 6);
      } else if (tile.schoolCovered) {
        edu = Math.min(100, edu + 2);
      } else {
        edu = Math.max(0, edu - 2);
      }
      tile.education = edu;

      // Local Crime: police coverage and safety suppression
      let crime = 45; // baseline unpoliced
      if (tile.policeCovered) {
        crime = Math.max(5, 12 - (tile.landValue > 60 ? 5 : 0));
      } else {
        if (nVal > 35) crime += 12;
        if (pVal > 35) crime += 8;
        if (!tile.wasteCovered) crime += 10; // urban decay and blight
      }
      crime = Math.max(5, Math.min(100, Math.round(crime)));
      tile.crime = crime;

      // Local Land Value Calculation
      let lv = 35; // base
      if (tile.type === TileType.PARK) {
        lv = 60; // Parks have high innate recreational value
      } else {
        if (tile.fireCovered) lv += 10;
        if (tile.policeCovered) lv += 12;
        if (tile.healthCovered) lv += 12;
        if (tile.schoolCovered) lv += 12;
        if (tile.wasteCovered) lv += 10;
      }

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

      // Deductions
      lv -= (pVal * 0.35) + (nVal * 0.25) + (crime * 0.3);

      const hasOccupants = (tile.population || 0) > 0 || (tile.jobs || 0) > 0;
      if (hasOccupants) {
        if (!tile.wasteCovered) lv -= 20;
        if (!tile.powered || !tile.watered) lv -= 20;
      } else if (tile.type !== TileType.PARK && tile.type !== TileType.ROAD) {
        if (!tile.powered || !tile.watered) lv -= 8;
      }

      lv = Math.max(0, Math.min(100, Math.round(lv)));
      tile.landValue = lv;

      // Update tile productivity based on health, education, and safety
      const baseProductivity = tile.powered && tile.watered ? 100 : 0;
      const healthFactor = 0.5 + 0.5 * (health / 100);
      const eduFactor = 0.75 + 0.35 * (edu / 100);
      const crimePenalty = crime > 30 ? (crime - 30) * 0.006 : 0;
      tile.productivity = Math.max(0, Math.min(100, Math.round(baseProductivity * healthFactor * (1 - crimePenalty))));

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

export interface CityEvolutionContext {
  unemploymentRate?: number;
  educationLevel?: number;
  congestionIndex?: number;
  logisticsEfficiency?: number;
  goodsSupplyIndex?: number;
  purchasingPower?: number;
  workers?: number;
  employedCitizens?: number;
  resTax?: number;
  comTax?: number;
  indTax?: number;
}

/**
 * Simulates Building Evolution (Level 1 to 5) with deep economic, service, and environmental requirements.
 * Implements full lifecycle: Growth (Upgrade), Stagnation, Downgrade (Level Down), Abandonment, and Recovery.
 */
export function simulateBuildingEvolution(
  grid: TileData[][],
  roadGraph: RoadGraph,
  resDemand: number,
  comDemand: number,
  indDemand: number,
  unlockedUpgrades: string[],
  context: CityEvolutionContext = {}
): void {
  const height = grid.length;
  const width = grid[0].length;
  const hasU = (id: string) => unlockedUpgrades.includes(id);

  const maxResLevel = hasU('sky_permits') ? 5 : (hasU('high_dens_res') ? 3 : 2);
  const maxComLevel = hasU('sky_permits') ? 5 : (hasU('high_dens_com') ? 3 : 2);
  const maxIndLevel = hasU('sky_permits') ? 5 : (hasU('high_dens_ind') ? 3 : 2);

  const unempRate = context.unemploymentRate ?? 5;
  const cityEdu = context.educationLevel ?? 30;
  const congestion = context.congestionIndex ?? 0;
  const purchasingPower = context.purchasingPower ?? 50;
  const resTax = context.resTax ?? 9;
  const comTax = context.comTax ?? 9;
  const indTax = context.indTax ?? 9;

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

      // 1. Inactive building (missing essential utility or road)
      if (!isActive) {
        tile.upgradeProgress = 0;
        tile.jobs = Math.max(0, (tile.jobs || 0) - 2);
        tile.population = Math.max(0, (tile.population || 0) - 2);
        if (tile.population === 0 && tile.jobs === 0) {
          tile.abandoned = true;
          if ((tile.level || 1) > 1) {
            tile.level = Math.max(1, (tile.level || 1) - 1);
          }
        }
        continue;
      }

      const demand = tile.type === TileType.RESIDENTIAL 
        ? resDemand 
        : (tile.type === TileType.COMMERCIAL ? comDemand : indDemand);

      const lv = tile.landValue ?? 35;
      const pVal = tile.pollution ?? 0;
      const nVal = tile.noise ?? 0;
      const cVal = tile.crime ?? 30;
      const tileEdu = tile.education ?? cityEdu;
      const currentLevel = Math.min(5, Math.max(1, tile.level || 1));

      // 2. Abandoned Building Check & Recovery
      if (tile.abandoned) {
        const canRecover = isActive && demand > 8 && pVal < 60 && cVal < 60;
        if (canRecover) {
          tile.abandoned = false;
          tile.upgradeProgress = 0;
          if (tile.type === TileType.RESIDENTIAL) {
            tile.population = 1;
          } else {
            tile.jobs = 1;
          }
        }
        continue;
      }

      let currentCap = 0;
      let maxLevel = 1;

      if (tile.type === TileType.RESIDENTIAL) {
        currentCap = RESIDENTIAL_CAPACITIES[currentLevel];
        maxLevel = maxResLevel;
      } else if (tile.type === TileType.COMMERCIAL) {
        currentCap = COMMERCIAL_CAPACITIES[currentLevel];
        maxLevel = maxComLevel;
      } else {
        currentCap = INDUSTRIAL_CAPACITIES[currentLevel];
        maxLevel = maxIndLevel;
      }

      const currentOcc = tile.type === TileType.RESIDENTIAL ? (tile.population || 0) : (tile.jobs || 0);
      const occupancyRatio = currentCap > 0 ? currentOcc / currentCap : 0;

      // 3. Evaluation for Upgrade (Level Up)
      const nextLevel = currentLevel + 1;
      let canUpgrade = false;

      if (currentLevel < maxLevel && occupancyRatio >= 0.70 && demand > 10) {
        if (tile.type === TileType.RESIDENTIAL) {
          const taxOk = resTax <= 12;
          const unempOk = unempRate <= 15;
          const commuteOk = congestion <= 35;

          if (taxOk && unempOk && commuteOk) {
            if (nextLevel === 2) {
              canUpgrade = lv >= 25 && (tile.fireCovered || tile.policeCovered) && pVal < 45;
            } else if (nextLevel === 3) {
              canUpgrade = lv >= 40 && tile.fireCovered && tile.policeCovered && (tile.healthCovered || tile.schoolCovered) && pVal < 35 && cVal < 35;
            } else if (nextLevel === 4) {
              canUpgrade = lv >= 60 && tile.fireCovered && tile.policeCovered && tile.healthCovered && tile.schoolCovered && tile.wasteCovered && pVal < 25 && cVal < 25 && tileEdu >= 35;
            } else if (nextLevel === 5) {
              canUpgrade = lv >= 78 && tile.fireCovered && tile.policeCovered && tile.healthCovered && tile.schoolCovered && tile.wasteCovered && pVal < 15 && cVal < 15 && tileEdu >= 55 && congestion < 25;
            }
          }
        } else if (tile.type === TileType.COMMERCIAL) {
          const taxOk = comTax <= 12;
          const marketOk = purchasingPower >= 15;
          const trafficOk = congestion <= 40;
          const stock = tile.goodsStock !== undefined ? tile.goodsStock : 80;
          const goodsSupplyOk = stock >= 40;

          if (taxOk && marketOk && trafficOk && goodsSupplyOk) {
            if (nextLevel === 2) {
              canUpgrade = lv >= 28 && tile.policeCovered && cVal < 45;
            } else if (nextLevel === 3) {
              canUpgrade = lv >= 48 && tile.fireCovered && tile.policeCovered && tile.wasteCovered && purchasingPower >= 40 && comTax <= 11 && stock >= 50;
            } else if (nextLevel === 4) {
              canUpgrade = lv >= 65 && tile.fireCovered && tile.policeCovered && tile.healthCovered && tile.wasteCovered && tileEdu >= 40 && cVal < 25 && stock >= 60;
            } else if (nextLevel === 5) {
              canUpgrade = lv >= 80 && tile.fireCovered && tile.policeCovered && tile.healthCovered && tile.schoolCovered && tile.wasteCovered && tileEdu >= 60 && cVal < 15 && congestion < 25 && stock >= 70;
            }
          }
        } else {
          // INDUSTRIAL
          const taxOk = indTax <= 12;
          const logisticsOk = congestion <= 45;
          const logSat = tile.logisticsSatisfaction !== undefined ? tile.logisticsSatisfaction : 80;
          const supplyChainOk = logSat >= 40;

          if (taxOk && logisticsOk && supplyChainOk) {
            if (nextLevel === 2) {
              canUpgrade = tile.fireCovered;
            } else if (nextLevel === 3) {
              canUpgrade = tile.fireCovered && tile.wasteCovered && logSat >= 50;
            } else if (nextLevel === 4) {
              // Advanced clean manufacturing requires educated workforce
              canUpgrade = tile.fireCovered && tile.wasteCovered && tileEdu >= 40 && logSat >= 60 && (hasU('logistics_hub') || hasU('automation') || hasU('high_dens_ind'));
            } else if (nextLevel === 5) {
              // High-Tech Industrial Hub requires high education
              canUpgrade = tile.fireCovered && tile.wasteCovered && tileEdu >= 60 && pVal < 30 && logSat >= 70 && (hasU('automation') || hasU('sky_permits'));
            }
          }
        }
      }

      // 4. Upgrade Progress / Stagnation handling
      if (canUpgrade) {
        tile.upgradeProgress = (tile.upgradeProgress ?? 0) + 25;
        if (tile.upgradeProgress >= 100) {
          tile.level = nextLevel;
          tile.upgradeProgress = 0;
        }
      } else {
        // Drifts back toward 0 if simply stagnating
        if ((tile.upgradeProgress ?? 0) > 0) {
          tile.upgradeProgress = Math.max(0, (tile.upgradeProgress ?? 0) - 10);
        }
      }

      // 5. Downgrade (Level Down) and Degradation Check
      let shouldDegrade = false;
      if (currentLevel > 1) {
        if (tile.type === TileType.RESIDENTIAL) {
          const severePollution = pVal > 55;
          const severeCrime = cVal > 55;
          const severeDepression = demand < -25 && unempRate > 20;
          const lostServices = !tile.fireCovered && !tile.policeCovered;
          if (severePollution || severeCrime || severeDepression || lostServices || resTax > 15) {
            shouldDegrade = true;
          }
        } else if (tile.type === TileType.COMMERCIAL) {
          const severeCrime = cVal > 60;
          const marketCrash = demand < -25 || comTax > 15;
          const gridlock = congestion > 65;
          const severeSupplyShortage = (tile.goodsStock !== undefined && tile.goodsStock < 15);
          if (severeCrime || marketCrash || gridlock || severeSupplyShortage) {
            shouldDegrade = true;
          }
        } else {
          // INDUSTRIAL
          const lostLogistics = congestion > 70 || (tile.logisticsSatisfaction !== undefined && tile.logisticsSatisfaction < 15);
          const indTaxTooHigh = indTax > 15;
          const indCrash = demand < -25;
          if (lostLogistics || indTaxTooHigh || indCrash) {
            shouldDegrade = true;
          }
        }
      }

      if (shouldDegrade) {
        tile.upgradeProgress = (tile.upgradeProgress ?? 0) - 20;
        if (tile.upgradeProgress <= -60) {
          tile.level = Math.max(1, currentLevel - 1);
          tile.upgradeProgress = 0;
        }
      }

      // 6. Abandonment from extreme conditions
      const extremeBlight = pVal > 80 || cVal > 80;
      const zeroOccupancyCollapse = (currentOcc === 0 && demand < -20);

      if (extremeBlight || zeroOccupancyCollapse) {
        tile.abandoned = true;
        tile.upgradeProgress = 0;
        tile.population = 0;
        tile.jobs = 0;
      }
    }
  }
}
