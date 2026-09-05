import { CityState, TileData, TileType, HistoryRecord } from './types';
import { GAME_CONFIG } from './config';
import { buildRoadGraph, simulateRoadNetworkAndTraffic, getAdjacentRoadNodeKey } from './traffic';
import { simulateUtilityNetworks, simulateCityServices } from './services';
import { 
  simulateCityDepthAndEnvironment, 
  simulateBuildingEvolution,
  RESIDENTIAL_CAPACITIES,
  COMMERCIAL_CAPACITIES,
  INDUSTRIAL_CAPACITIES
} from './depthSimulation';
import { getCurrentMilestone, POLICIES, EVENT_PROTOTYPES, ActiveEvent } from './progression';
import { saveGame } from './saveSystem';
import { generateWorld } from './mapGenerator';

export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 60;

export function createEmptyGrid(width = 60, height = 60): TileData[][] {
  return generateWorld({
    seed: 42,
    preset: 'river_valley',
    roughness: 0.5,
    waterAmount: 0.4,
    treeDensity: 0.5
  });
}

// Subsystem 1: Network-based Utilities Allocation
export function allocateUtilities(grid: TileData[][], unlockedUpgrades: string[]) {
  return simulateUtilityNetworks(grid, unlockedUpgrades);
}

// Subsystem 2: Deterministic calculation of city desirability and demands
export function calculateDemandsAndDesirability(
  grid: TileData[][],
  prevState: CityState,
  powerCapacity: number,
  powerDemand: number,
  waterCapacity: number,
  waterDemand: number
) {
  const hasU = (id: string) => prevState.unlockedUpgrades.includes(id);

  let desirability = 50;

  // Power & Water coverage benefits desirability
  const powerCoverage = powerDemand > 0 ? Math.min(1, powerCapacity / powerDemand) : 1;
  const waterCoverage = waterDemand > 0 ? Math.min(1, waterCapacity / waterDemand) : 1;
  desirability += (powerCoverage >= 1 ? 12 : (powerCoverage * 12 - 12));
  desirability += (waterCoverage >= 1 ? 12 : (waterCoverage * 12 - 12));

  // City Services impact on desirability
  const happiness = prevState.happiness ?? 50;
  const healthCov = prevState.healthcareCoverage ?? 50;
  const eduCov = prevState.educationCoverage ?? 50;
  const fireSafety = prevState.fireSafety ?? 100;
  const crimeRate = prevState.crimeRate ?? 35;
  const wasteCov = prevState.wasteCoverage ?? 80;

  desirability += (healthCov - 50) * 0.12;
  desirability += (eduCov - 50) * 0.12;
  desirability += (fireSafety - 50) * 0.10;
  desirability += (35 - crimeRate) * 0.15;
  desirability += (wasteCov - 50) * 0.10;
  desirability += (happiness - 50) * 0.15;

  // Traffic congestion & commute time friction
  const congestionIndex = prevState.congestionIndex ?? 0;
  const averageCommute = prevState.averageCommuteTime ?? 0;

  if (congestionIndex > 15) {
    desirability -= Math.min(25, Math.round((congestionIndex - 15) * 0.7));
  } else if (prevState.trafficAverage > 0 && congestionIndex === 0) {
    desirability += 6; // Smooth flowing network bonus
  }

  if (averageCommute > 8) {
    desirability -= Math.min(15, Math.round((averageCommute - 8) * 1.5));
  }

  // Policies impacts
  if (hasU('prop_tax_hike')) desirability -= 5;
  if (hasU('wealth_tax')) desirability -= 5;
  if (hasU('green_roofs')) desirability += 5;
  if (hasU('recycling')) desirability += 5;
  if (hasU('ai_management')) desirability += 10;
  if (hasU('tourism')) desirability += 5;

  // Apply Policy & Active Events Desirability Modifiers
  const activePolicies = prevState.activePolicies || [];
  const activeEvents = (prevState.activeEvents || []) as ActiveEvent[];

  if (activePolicies.includes('FREE_TRANSIT')) {
    desirability += 5;
  }
  if (activePolicies.includes('GREEN_SUBSIDY')) {
    desirability += 3;
    powerDemand = Math.round(powerDemand * 0.85);
  }

  // Active Events desirability & capacity modifiers
  for (const ev of activeEvents) {
    if (ev.type === 'boom') {
      desirability += 20;
    } else if (ev.type === 'heatwave') {
      powerDemand = Math.round(powerDemand * 1.5);
      waterDemand = Math.round(waterDemand * 1.5);
    } else if (ev.type === 'power_shortage') {
      powerCapacity = Math.round(powerCapacity * 0.7);
    }
  }

  desirability = Math.max(0, Math.min(100, Math.round(desirability)));

  // Extract Tax rates (default to 9 if undefined)
  const resTaxRate = prevState.residentialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
  const comTaxRate = prevState.commercialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
  const indTaxRate = prevState.industrialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;

  // Calculate RCI Demands (-100 to 100)
  const jobsVSWorkers = prevState.availableJobs - prevState.population;
  const unemploymentFriction = (prevState.unemploymentRate - 5) * 3.5;
  const utilityFactor = (powerCoverage + waterCoverage) / 2;
  const commutePenalty = averageCommute > 10 ? (averageCommute - 10) * 2 : 0;
  
  let residentialDemand = (desirability - 50) * 1.5 + jobsVSWorkers * 2.0 - unemploymentFriction + (utilityFactor - 0.9) * 40 - commutePenalty;

  // Apply Residential Tax scaling
  if (resTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    residentialDemand -= (resTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
  } else {
    residentialDemand += (GAME_CONFIG.TAX_OPTIMAL - resTaxRate) * 4;
  }
  residentialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(residentialDemand)));

  // 2. Commercial Demand
  const employmentRate = 1 - (prevState.unemploymentRate / 100);
  const purchasingPower = prevState.population * employmentRate;
  const commercialTrafficPenalty = congestionIndex > 20 ? (congestionIndex - 20) * 0.8 : 0;
  
  let commercialDemand = (purchasingPower * 0.45) - (prevState.unemploymentRate * 0.5) - commercialTrafficPenalty - 20;
  if (hasU('mixed_use')) commercialDemand += 15;
  if (hasU('small_biz')) commercialDemand += 10;
  if (hasU('tourism')) commercialDemand += 20;

  if (comTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    commercialDemand -= (comTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
  } else {
    commercialDemand += (GAME_CONFIG.TAX_OPTIMAL - comTaxRate) * 4;
  }
  commercialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(commercialDemand)));

  // 3. Industrial Demand
  const laborPoolAvailability = prevState.workers - prevState.employment;
  const industrialTrafficPenalty = (prevState.trafficAverage * 1.5) + (congestionIndex * 0.5);

  let industrialDemand = (laborPoolAvailability * 2.2) - industrialTrafficPenalty - 15;
  if (hasU('highway_conn')) industrialDemand += 15;
  if (hasU('corp_subsidies')) industrialDemand += 15;
  if (hasU('auto_logistics')) industrialDemand += 20;

  if (indTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    industrialDemand -= (indTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
  } else {
    industrialDemand += (GAME_CONFIG.TAX_OPTIMAL - indTaxRate) * 4;
  }
  industrialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(industrialDemand)));

  // Apply Policy & Active Events Modifiers to RCI Demands
  if (activePolicies.includes('IND_TAX_BREAK')) {
    industrialDemand += 25;
  }

  for (const ev of activeEvents) {
    if (ev.type === 'boom') {
      residentialDemand += 40;
    } else if (ev.type === 'recession') {
      commercialDemand -= 30;
      industrialDemand -= 30;
    } else if (ev.type === 'industrial_boom') {
      industrialDemand += 30;
    }
  }

  residentialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(residentialDemand)));
  commercialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(commercialDemand)));
  industrialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(industrialDemand)));

  return { desirability, residentialDemand, commercialDemand, industrialDemand };
}

// Subsystem 3: Population simulation with Road Access, Services, and Abandonment
export function simulatePopulation(
  grid: TileData[][], 
  residentialDemand: number, 
  happiness: number,
  unlockedUpgrades: string[]
) {
  const roadGraph = buildRoadGraph(grid, unlockedUpgrades);

  const getResCapacity = (level: number) => {
    const lvl = Math.min(5, Math.max(1, level));
    return RESIDENTIAL_CAPACITIES[lvl];
  };

  let totalPop = 0;
  const height = grid.length;
  const width = grid[0]?.length || 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type !== TileType.RESIDENTIAL) continue;

      const hasRoadAccess = getAdjacentRoadNodeKey(x, y, roadGraph) !== null;
      const hasUtilities = tile.powered && tile.watered;
      const isActive = hasUtilities && hasRoadAccess;

      if (isActive) {
        if (tile.abandoned && residentialDemand > 10) {
          tile.abandoned = false;
        }

        if (!tile.abandoned) {
          const capacity = getResCapacity(tile.level);
          
          if (residentialDemand > 0 && tile.population < capacity) {
            // Growth rate accelerated by high city happiness and healthcare/school coverage
            const bonusGrowth = (happiness > 70 && (tile.healthCovered || tile.schoolCovered)) ? 1 : 0;
            const growth = (residentialDemand > 60 ? 3 : 1) + bonusGrowth;
            tile.population = Math.min(capacity, tile.population + growth);
          } else if (residentialDemand < -30 && tile.population > 0) {
            const decline = residentialDemand < -70 ? 2 : 1;
            tile.population = Math.max(0, tile.population - decline);
          }
        }
      } else {
        // Unserviced or isolated housing without road access loses inhabitants rapidly
        tile.population = Math.max(0, tile.population - 2);
        
        if (tile.population === 0) {
          tile.abandoned = true;
          if (tile.level > 1) {
            tile.level = Math.max(1, tile.level - 1);
          }
        }
      }

      totalPop += tile.population;
    }
  }

  const households = Math.round(totalPop / 3.0);
  const workers = Math.round(totalPop * GAME_CONFIG.WORKING_AGE_RATIO);

  return { totalPop, households, workers };
}

// Subsystem 4: Employment simulation with Road Access and Services
export function simulateEmployment(
  grid: TileData[][],
  workers: number,
  commercialDemand: number,
  industrialDemand: number,
  unlockedUpgrades: string[]
) {
  const roadGraph = buildRoadGraph(grid, unlockedUpgrades);

  const getComCapacity = (level: number) => COMMERCIAL_CAPACITIES[Math.min(5, Math.max(1, level))];
  const getIndCapacity = (level: number) => INDUSTRIAL_CAPACITIES[Math.min(5, Math.max(1, level))];

  let totalComNominalJobs = 0;
  let totalIndNominalJobs = 0;
  const height = grid.length;
  const width = grid[0]?.length || 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      const hasRoadAccess = getAdjacentRoadNodeKey(x, y, roadGraph) !== null;
      const hasUtilities = tile.powered && tile.watered;
      const isActive = hasUtilities && hasRoadAccess;

      if (tile.type === TileType.COMMERCIAL) {
        if (isActive) {
          if (tile.abandoned && commercialDemand > 10) {
            tile.abandoned = false;
          }

          if (!tile.abandoned) {
            // Police & fire coverage protects commercial productivity
            const serviceMult = (tile.policeCovered ? 1.1 : 0.9) * (tile.fireCovered ? 1.05 : 0.95);
            tile.productivity = Math.min(100, Math.round(100 * serviceMult));
            const capacity = getComCapacity(tile.level);
            
            if (commercialDemand > 0 && tile.jobs < capacity) {
              const growth = commercialDemand > 60 ? 3 : 1;
              tile.jobs = Math.min(capacity, tile.jobs + growth);
            } else if (commercialDemand < -30 && tile.jobs > 0) {
              const decline = commercialDemand < -70 ? 2 : 1;
              tile.jobs = Math.max(0, tile.jobs - decline);
            }
          }
        } else {
          tile.productivity = 0;
          tile.jobs = Math.max(0, tile.jobs - 2);
          if (tile.jobs === 0) {
            tile.abandoned = true;
            if (tile.level > 1) {
              tile.level = Math.max(1, tile.level - 1);
            }
          }
        }
        totalComNominalJobs += tile.jobs;

      } else if (tile.type === TileType.INDUSTRIAL) {
        if (isActive) {
          if (tile.abandoned && industrialDemand > 10) {
            tile.abandoned = false;
          }

          if (!tile.abandoned) {
            // Waste management and fire coverage protect industrial plants
            const serviceMult = (tile.wasteCovered ? 1.1 : 0.9) * (tile.fireCovered ? 1.05 : 0.95);
            tile.productivity = Math.min(100, Math.round(100 * serviceMult));
            const capacity = getIndCapacity(tile.level);

            if (industrialDemand > 0 && tile.jobs < capacity) {
              const growth = industrialDemand > 60 ? 3 : 1;
              tile.jobs = Math.min(capacity, tile.jobs + growth);
            } else if (industrialDemand < -30 && tile.jobs > 0) {
              const decline = industrialDemand < -70 ? 2 : 1;
              tile.jobs = Math.max(0, tile.jobs - decline);
            }
          }
        } else {
          tile.productivity = 0;
          tile.jobs = Math.max(0, tile.jobs - 2);
          if (tile.jobs === 0) {
            tile.abandoned = true;
            if (tile.level > 1) {
              tile.level = Math.max(1, tile.level - 1);
            }
          }
        }
        totalIndNominalJobs += tile.jobs;
      }
    }
  }

  const totalNominalJobs = totalComNominalJobs + totalIndNominalJobs;

  // Labor constraint modeling
  const employedCitizens = Math.min(workers, totalNominalJobs);
  const unemployedCount = Math.max(0, workers - employedCitizens);
  const unemploymentRate = workers > 0 ? Math.round((unemployedCount / workers) * 100) : 0;

  // Sum up maximum possible active job capacity
  let availableJobs = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      const hasRoadAccess = getAdjacentRoadNodeKey(x, y, roadGraph) !== null;
      const isActive = tile.powered && tile.watered && hasRoadAccess;
      if (isActive && !tile.abandoned) {
        if (tile.type === TileType.COMMERCIAL) availableJobs += getComCapacity(tile.level);
        if (tile.type === TileType.INDUSTRIAL) availableJobs += getIndCapacity(tile.level);
      }
    }
  }

  return {
    availableJobs,
    totalNominalJobs,
    employedCitizens,
    unemploymentRate
  };
}

// Subsystem 5: Detailed economy & budget breakdown including City Services maintenance
export function calculateEconomy(
  grid: TileData[][],
  totalPop: number,
  employedCitizens: number,
  totalNominalJobs: number,
  workers: number,
  unlockedUpgrades: string[],
  resTaxRate: number,
  comTaxRate: number,
  indTaxRate: number,
  activePolicies: string[] = [],
  activeEvents: any[] = []
) {
  // 1. Infrastructure & City Services Maintenance Expenses
  let infraMaint = 0;
  let utilityMaint = 0;
  let serviceMaint = 0;
  const height = grid.length;
  const width = grid[0]?.length || 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.ROAD) infraMaint += GAME_CONFIG.MAINTENANCE_COSTS.ROAD;
      else if (tile.type === TileType.RESIDENTIAL) infraMaint += GAME_CONFIG.MAINTENANCE_COSTS.RESIDENTIAL;
      else if (tile.type === TileType.COMMERCIAL) infraMaint += GAME_CONFIG.MAINTENANCE_COSTS.COMMERCIAL;
      else if (tile.type === TileType.INDUSTRIAL) infraMaint += GAME_CONFIG.MAINTENANCE_COSTS.INDUSTRIAL;
      else if (tile.type === TileType.POWER_PLANT) utilityMaint += GAME_CONFIG.MAINTENANCE_COSTS.POWER_PLANT;
      else if (tile.type === TileType.WATER_PUMP) utilityMaint += GAME_CONFIG.MAINTENANCE_COSTS.WATER_PUMP;
      else if (tile.type === TileType.FIRE_STATION) serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.FIRE_STATION;
      else if (tile.type === TileType.POLICE_STATION) serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.POLICE_STATION;
      else if (tile.type === TileType.CLINIC) serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.CLINIC;
      else if (tile.type === TileType.SCHOOL) serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.SCHOOL;
      else if (tile.type === TileType.WASTE_MANAGEMENT) serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.WASTE_MANAGEMENT;
      else if (tile.type === TileType.PARK) serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.PARK;
    }
  }

  // 2. Policy & Upgrades monthly operations fees
  let policyExpenses = 0;
  for (const upgradeId of unlockedUpgrades) {
    if (GAME_CONFIG.UPGRADE_MAINTENANCE[upgradeId]) {
      policyExpenses += GAME_CONFIG.UPGRADE_MAINTENANCE[upgradeId];
    }
  }

  // Add Policy Upkeep Fees
  for (const polId of activePolicies) {
    const pol = POLICIES.find((p) => p.id === polId);
    if (pol) {
      policyExpenses += pol.dailyUpkeep;
    }
  }

  const expenses = Math.round(infraMaint + utilityMaint + serviceMaint + policyExpenses);

  // 3. Tax Revenues Calculation
  const taxResMult = resTaxRate / GAME_CONFIG.TAX_OPTIMAL;
  const taxComMult = comTaxRate / GAME_CONFIG.TAX_OPTIMAL;
  const taxIndMult = indTaxRate / GAME_CONFIG.TAX_OPTIMAL;

  let residentialIncome = 0;
  let commercialIncome = 0;
  let industrialIncome = 0;

  // Staffing ratio for Commercial and Industrial filled jobs
  const staffingRatio = totalNominalJobs > 0 ? employedCitizens / totalNominalJobs : 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.abandoned) continue; // Abandoned tiles pay 0 taxes

      if (tile.type === TileType.RESIDENTIAL) {
        residentialIncome += tile.population * GAME_CONFIG.BASE_RES_TAX_COEFF * taxResMult;
      } else if (tile.type === TileType.COMMERCIAL) {
        const activeJobs = Math.round(tile.jobs * staffingRatio);
        const productivityFactor = Math.max(0.2, (tile.productivity || 100) / 100);
        commercialIncome += activeJobs * productivityFactor * GAME_CONFIG.BASE_COM_TAX_COEFF * taxComMult;
      } else if (tile.type === TileType.INDUSTRIAL) {
        const activeJobs = Math.round(tile.jobs * staffingRatio);
        const productivityFactor = Math.max(0.2, (tile.productivity || 100) / 100);
        industrialIncome += activeJobs * productivityFactor * GAME_CONFIG.BASE_IND_TAX_COEFF * taxIndMult;
      }
    }
  }

  const income = Math.round(residentialIncome + commercialIncome + industrialIncome);

  return { 
    income, 
    expenses,
    infraMaint: Math.round(infraMaint),
    utilityMaint: Math.round(utilityMaint),
    serviceMaint: Math.round(serviceMaint),
    policyExpenses: Math.round(policyExpenses)
  };
}

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pure main entry point pipeline
export function simulateTick(prevState: CityState): CityState {
  const nextGrid = prevState.grid.map(row => row.map(tile => ({ ...tile })));

  const resTax = prevState.residentialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
  const comTax = prevState.commercialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
  const indTax = prevState.industrialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;

  // Process Active Events Ticks
  let activeEvents: ActiveEvent[] = (prevState.activeEvents || [])
    .map((ev) => ({ ...ev, remainingDays: ev.remainingDays - 1 }))
    .filter((ev) => ev.remainingDays > 0);

  // Deterministic seed generation
  const seed = prevState.seed ?? 1337;
  const nextSeed = (seed * 1664525 + 1013904223) % 4294967296;
  const rand = mulberry32(seed);

  // Random chance (3.5% per day) to trigger a random event if less than 2 events active
  if (activeEvents.length < 2 && rand() < 0.035) {
    const protoIndex = Math.floor(rand() * EVENT_PROTOTYPES.length);
    const proto = EVENT_PROTOTYPES[protoIndex];
    if (!activeEvents.some((ev) => ev.type === proto.type)) {
      activeEvents.push({
        id: `${proto.type}_day${prevState.day}_seed${seed}`,
        type: proto.type as any,
        name: proto.name,
        description: proto.description,
        remainingDays: Math.floor(rand() * 10) + 10, // 10-20 days
      });
    }
  }

  // Subsystem 1: Network-connected Utilities Allocation
  const { powerCapacity, powerDemand, waterCapacity, waterDemand } = allocateUtilities(nextGrid, prevState.unlockedUpgrades);

  // Subsystem 2: Demands & Desirability
  const { desirability, residentialDemand, commercialDemand, industrialDemand } = calculateDemandsAndDesirability(
    nextGrid,
    { ...prevState, activeEvents },
    powerCapacity,
    powerDemand,
    waterCapacity,
    waterDemand
  );

  // Subsystem 3: Population with Abandonment and Services checks
  const { totalPop, households, workers } = simulatePopulation(
    nextGrid, 
    residentialDemand, 
    prevState.happiness ?? 50,
    prevState.unlockedUpgrades
  );

  // Subsystem 4: Employment & Labor caps
  const { availableJobs, totalNominalJobs, employedCitizens, unemploymentRate } = simulateEmployment(
    nextGrid,
    workers,
    commercialDemand,
    industrialDemand,
    prevState.unlockedUpgrades
  );

  // Subsystem 5: Road Network & Traffic Engine 2.0
  const trafficResult = simulateRoadNetworkAndTraffic(nextGrid, employedCitizens, prevState.unlockedUpgrades);
  const roadGraph = buildRoadGraph(nextGrid, prevState.unlockedUpgrades);

  // Subsystem 6: City Services Simulation (Fire, Police, Healthcare, Education, Waste)
  const servicesResult = simulateCityServices(
    nextGrid,
    roadGraph,
    totalPop,
    employedCitizens,
    desirability,
    trafficResult.averageCommuteTime,
    resTax,
    prevState.unlockedUpgrades
  );

  // Subsystem 7: Phase 6 Environmental & City Depth Engine (Land Value, Pollution, Noise)
  const depthResult = simulateCityDepthAndEnvironment(nextGrid, roadGraph, prevState.unlockedUpgrades);

  // Subsystem 8: Phase 6 Building Level 1-5 Evolution Engine
  simulateBuildingEvolution(
    nextGrid,
    roadGraph,
    residentialDemand,
    commercialDemand,
    industrialDemand,
    prevState.unlockedUpgrades
  );

  // Subsystem 9: Economy with detailed breakdowns and taxes
  const activePolicies = prevState.activePolicies || [];
  const { income, expenses } = calculateEconomy(
    nextGrid,
    totalPop,
    employedCitizens,
    totalNominalJobs,
    workers,
    prevState.unlockedUpgrades,
    resTax,
    comTax,
    indTax,
    activePolicies,
    activeEvents
  );

  const netIncome = income - expenses;
  const nextMoney = Math.max(0, prevState.money + netIncome);

  // Recalculate Milestone level
  const milestone = getCurrentMilestone(totalPop, nextMoney);

  // Log trend history
  const newHistoryRecord: HistoryRecord = {
    day: prevState.day,
    money: nextMoney,
    income,
    expenses,
    population: totalPop,
  };
  const nextHistory = [...(prevState.history || []), newHistoryRecord].slice(-10);

  const nextState: CityState = {
    ...prevState,
    grid: nextGrid,
    day: prevState.day + 1,
    money: nextMoney,
    population: totalPop,
    milestoneLevel: milestone.level,
    activeEvents,
    activePolicies,
    completedMissions: prevState.completedMissions || [],
    unlockedAchievements: prevState.unlockedAchievements || [],
    powerCapacity,
    powerDemand,
    waterCapacity,
    waterDemand,
    trafficAverage: trafficResult.averageTraffic,
    averageCommuteTime: trafficResult.averageCommuteTime,
    congestionIndex: trafficResult.congestionIndex,
    income,
    expenses,
    households,
    workers,
    employment: employedCitizens,
    unemploymentRate,
    availableJobs,
    residentialDemand,
    commercialDemand,
    industrialDemand,
    desirability,
    residentialTaxRate: resTax,
    commercialTaxRate: comTax,
    industrialTaxRate: indTax,
    history: nextHistory,

    // City Services & Happiness metrics
    happiness: servicesResult.happiness,
    healthcareCoverage: servicesResult.healthcareCoverage,
    educationCoverage: servicesResult.educationCoverage,
    fireSafety: servicesResult.fireSafety,
    crimeRate: servicesResult.crimeRate,
    wasteCapacity: servicesResult.wasteCapacity,
    wasteProduction: servicesResult.wasteProduction,
    wasteCoverage: servicesResult.wasteCoverage,

    // Phase 6 Depth & Evolution Metrics
    landValueAverage: depthResult.landValueAverage,
    pollutionAverage: depthResult.pollutionAverage,
    noiseAverage: depthResult.noiseAverage,
    educationLevel: depthResult.educationLevel,
    healthIndex: depthResult.healthIndex,
    buildingLevelCounts: depthResult.buildingLevelCounts,
    seed: nextSeed,
  };

  // Trigger Autosave every 15 simulation days
  if (nextState.day % 15 === 0) {
    saveGame('autosave', nextState);
  }

  return nextState;
}

export function checkAdjacentRoad(grid: TileData[][], x: number, y: number): boolean {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
       if (grid[ny][nx].type === TileType.ROAD) return true;
    }
  }
  return false;
}
