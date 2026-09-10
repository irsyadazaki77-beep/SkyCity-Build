import { CityState, TileData, TileType, ActiveEvent, HistoryRecord } from '../../types';
import { GAME_CONFIG } from '../../config';
import { ChunkManager } from './ChunkManager';
import { CitizenSubsystem } from './CitizenSubsystem';
import { TrafficSubsystem } from './TrafficSubsystem';
import { simulateUtilityNetworks } from './UtilitiesSubsystem';
import { EconomySubsystem } from './EconomySubsystem';
import { EntityRegistry } from './entities/EntityRegistry';
import { simulateCityServices } from '../../services';
import { 
  simulateCityDepthAndEnvironment, 
  simulateBuildingEvolution,
  RESIDENTIAL_CAPACITIES,
  COMMERCIAL_CAPACITIES,
  INDUSTRIAL_CAPACITIES
} from '../../depthSimulation';
import { getCurrentMilestone, EVENT_PROTOTYPES } from '../../progression';
import { generateWorld } from '../../mapGenerator';

export const GRID_WIDTH = 60;
export const GRID_HEIGHT = 60;

// Deterministic PRNG
export function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEmptyGrid(width = 60, height = 60): TileData[][] {
  return generateWorld({
    seed: 42,
    preset: 'river_valley',
    roughness: 0.5,
    waterAmount: 0.4,
    treeDensity: 0.5,
    width,
    height,
  });
}

export function allocateUtilities(grid: TileData[][], unlockedUpgrades: string[] = [], activeEvents: ActiveEvent[] = []) {
  return simulateUtilityNetworks(grid, unlockedUpgrades, activeEvents);
}

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

  const powerCoverage = powerDemand > 0 ? Math.min(1, powerCapacity / powerDemand) : 1;
  const waterCoverage = waterDemand > 0 ? Math.min(1, waterCapacity / waterDemand) : 1;
  desirability += (powerCoverage >= 1 ? 12 : (powerCoverage * 12 - 12));
  desirability += (waterCoverage >= 1 ? 12 : (waterCoverage * 12 - 12));

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

  const congestionIndex = prevState.congestionIndex ?? 0;
  const averageCommute = prevState.averageCommuteTime ?? 0;

  if (congestionIndex > 15) {
    desirability -= Math.min(25, Math.round((congestionIndex - 15) * 0.7));
  } else if (prevState.trafficAverage > 0 && congestionIndex === 0) {
    desirability += 6;
  }

  if (averageCommute > 8) {
    desirability -= Math.min(15, Math.round((averageCommute - 8) * 1.5));
  }

  if (hasU('prop_tax_hike')) desirability -= 5;
  if (hasU('wealth_tax')) desirability -= 5;
  if (hasU('green_roofs')) desirability += 5;
  if (hasU('recycling')) desirability += 5;
  if (hasU('ai_management')) desirability += 10;
  if (hasU('tourism')) desirability += 5;

  const activePolicies = prevState.activePolicies || [];
  const activeEvents = (prevState.activeEvents || []) as ActiveEvent[];

  if (activePolicies.includes('FREE_TRANSIT')) {
    desirability += 5;
  }
  if (activePolicies.includes('GREEN_SUBSIDY')) {
    desirability += 3;
    powerDemand = Math.round(powerDemand * 0.85);
  }

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

  const resTaxRate = prevState.residentialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
  const comTaxRate = prevState.commercialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
  const indTaxRate = prevState.industrialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;

  const laborSupply = prevState.workers > 0 ? prevState.workers : Math.round(prevState.population * 0.65);
  const jobsVSWorkers = prevState.availableJobs - laborSupply;
  const unemploymentFriction = ((prevState.unemploymentRate ?? 0) - 5) * 3.5;
  const utilityFactor = (powerCoverage + waterCoverage) / 2;
  const commutePenalty = averageCommute > 10 ? (averageCommute - 10) * 2 : 0;

  let residentialDemand = (desirability - 50) * 1.5 + jobsVSWorkers * 2.0 - unemploymentFriction + (utilityFactor - 0.9) * 40 - commutePenalty;

  if (resTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    residentialDemand -= (resTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
  } else {
    residentialDemand += (GAME_CONFIG.TAX_OPTIMAL - resTaxRate) * 4;
  }
  residentialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(residentialDemand)));

  const employmentRate = 1 - ((prevState.unemploymentRate ?? 0) / 100);
  const purchasingPower = prevState.population * employmentRate;
  const commercialTrafficPenalty = congestionIndex > 20 ? (congestionIndex - 20) * 0.8 : 0;

  let commercialDemand = (purchasingPower * 0.45) - ((prevState.unemploymentRate ?? 0) * 0.5) - commercialTrafficPenalty - 20;
  if (hasU('mixed_use')) commercialDemand += 15;
  if (hasU('small_biz')) commercialDemand += 10;
  if (hasU('tourism')) commercialDemand += 20;

  if (comTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    commercialDemand -= (comTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
  } else {
    commercialDemand += (GAME_CONFIG.TAX_OPTIMAL - comTaxRate) * 4;
  }
  commercialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(commercialDemand)));

  const workforce = laborSupply;
  let industrialDemand = (workforce * 0.45) - jobsVSWorkers * 1.5 - (utilityFactor < 1 ? 25 : 0);
  if (hasU('heavy_industry')) industrialDemand += 20;
  if (hasU('logistics_hub')) industrialDemand += 15;

  if (indTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    industrialDemand -= (indTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
  } else {
    industrialDemand += (GAME_CONFIG.TAX_OPTIMAL - indTaxRate) * 4;
  }
  industrialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(industrialDemand)));

  return {
    desirability,
    residentialDemand,
    commercialDemand,
    industrialDemand,
    powerCapacity,
    powerDemand,
    waterCapacity,
    waterDemand,
  };
}

export function simulatePopulation(
  grid: TileData[][],
  residentialDemand: number,
  happiness: number,
  unlockedUpgrades: string[] = []
): { totalPop: number; households: number; workers: number } {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  let totalPop = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.RESIDENTIAL) {
        if (!tile.powered || !tile.watered) {
          tile.population = 0;
          tile.abandoned = true;
        } else {
          tile.abandoned = false;
          const lvl = Math.max(1, Math.min(5, tile.level || 1));
          const maxCapacity = RESIDENTIAL_CAPACITIES[lvl] || 4;

          if (residentialDemand > 0) {
            const growthStep = Math.max(1, Math.ceil((residentialDemand / 100) * 2));
            tile.population = Math.min(maxCapacity, tile.population + growthStep);
          } else if (residentialDemand < -30) {
            tile.population = Math.max(0, tile.population - 1);
          }

          if (tile.population === 0 && residentialDemand < 0) {
            tile.abandoned = true;
          }
        }
        totalPop += tile.population;
      }
    }
  }

  const households = Math.ceil(totalPop / 2.8);
  const workers = Math.round(totalPop * 0.65);
  return { totalPop, households, workers };
}

export function simulateEmployment(
  grid: TileData[][],
  workers: number,
  commercialDemand: number,
  industrialDemand: number,
  unlockedUpgrades: string[] = []
) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  let totalNominalJobs = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.COMMERCIAL) {
        if (!tile.powered || !tile.watered) {
          tile.jobs = 0;
          tile.abandoned = true;
        } else {
          tile.abandoned = false;
          const lvl = Math.max(1, Math.min(5, tile.level || 1));
          const maxJobs = COMMERCIAL_CAPACITIES[lvl] || 3;
          if (commercialDemand > 0) {
            tile.jobs = Math.min(maxJobs, tile.jobs + 1);
          } else if (commercialDemand < -30) {
            tile.jobs = Math.max(0, tile.jobs - 1);
          }
        }
        totalNominalJobs += tile.jobs;
      } else if (tile.type === TileType.INDUSTRIAL) {
        if (!tile.powered || !tile.watered) {
          tile.jobs = 0;
          tile.abandoned = true;
        } else {
          tile.abandoned = false;
          const lvl = Math.max(1, Math.min(5, tile.level || 1));
          const maxJobs = INDUSTRIAL_CAPACITIES[lvl] || 5;
          if (industrialDemand > 0) {
            tile.jobs = Math.min(maxJobs, tile.jobs + 1);
          } else if (industrialDemand < -30) {
            tile.jobs = Math.max(0, tile.jobs - 1);
          }
        }
        totalNominalJobs += tile.jobs;
      }
    }
  }

  const employedCitizens = Math.min(workers, totalNominalJobs);
  const unemploymentRate = workers > 0 ? Math.round(((workers - employedCitizens) / workers) * 100) : 0;
  const availableJobs = totalNominalJobs;

  return {
    availableJobs,
    totalNominalJobs,
    employedCitizens,
    unemploymentRate,
  };
}

export function calculateEconomy(
  grid: TileData[][],
  totalPop: number,
  employedCitizens: number,
  totalNominalJobs: number,
  workers: number,
  unlockedUpgrades: string[],
  resTax: number,
  comTax: number,
  indTax: number,
  activePolicies: string[] = [],
  activeEvents: ActiveEvent[] = []
) {
  const eco = new EconomySubsystem();
  return eco.calculateEconomy(
    grid,
    totalPop,
    employedCitizens,
    totalNominalJobs,
    workers,
    unlockedUpgrades,
    resTax,
    comTax,
    indTax,
    activePolicies,
    activeEvents
  );
}

export function checkAdjacentRoad(grid: TileData[][], x: number, y: number): boolean {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      if (grid[ny][nx].type === TileType.ROAD) return true;
    }
  }
  return false;
}

export class SimulationEngine {
  private citizenSubsystem = new CitizenSubsystem();
  private trafficSubsystem = new TrafficSubsystem();
  private economySubsystem = new EconomySubsystem();
  private entityRegistry = new EntityRegistry();
  public chunkManager = new ChunkManager(GRID_WIDTH, GRID_HEIGHT);

  public simulateTick(prevState: CityState): CityState {
    const nextGrid: TileData[][] = prevState.grid.map((row) => row.map((t) => ({ ...t })));
    return this.runSimulationOnGrid(prevState, nextGrid);
  }

  public simulateTickInPlace(state: CityState): CityState {
    return this.runSimulationOnGrid(state, state.grid);
  }

  private runSimulationOnGrid(prevState: CityState, nextGrid: TileData[][]): CityState {
    const resTax = prevState.residentialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
    const comTax = prevState.commercialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;
    const indTax = prevState.industrialTaxRate ?? GAME_CONFIG.DEFAULT_TAX_RATE;

    let activeEvents: ActiveEvent[] = (prevState.activeEvents || [])
      .map((ev) => ({ ...ev, remainingDays: ev.remainingDays - 1 }))
      .filter((ev) => ev.remainingDays > 0);

    const seed = prevState.seed ?? 1337;
    const nextSeed = (seed * 1664525 + 1013904223) % 4294967296;
    const rand = mulberry32(seed);

    if (activeEvents.length < 2 && rand() < 0.035) {
      const protoIndex = Math.floor(rand() * EVENT_PROTOTYPES.length);
      const proto = EVENT_PROTOTYPES[protoIndex];
      if (!activeEvents.some((ev) => ev.type === proto.type)) {
        activeEvents.push({
          id: `${proto.type}_day${prevState.day}_seed${seed}`,
          type: proto.type as any,
          name: proto.name,
          description: proto.description,
          remainingDays: Math.floor(rand() * 10) + 10,
        });
      }
    }

    const utilities = allocateUtilities(nextGrid, prevState.unlockedUpgrades, activeEvents);

    const demands = calculateDemandsAndDesirability(
      nextGrid,
      { ...prevState, activeEvents },
      utilities.powerCapacity,
      utilities.powerDemand,
      utilities.waterCapacity,
      utilities.waterDemand
    );

    const popLegacy = simulatePopulation(
      nextGrid,
      demands.residentialDemand,
      prevState.happiness ?? 50,
      prevState.unlockedUpgrades
    );

    const totalPop = popLegacy.totalPop;
    const households = popLegacy.households;
    const workers = popLegacy.workers;

    const { availableJobs, totalNominalJobs, employedCitizens, unemploymentRate } = simulateEmployment(
      nextGrid,
      workers,
      demands.commercialDemand,
      demands.industrialDemand,
      prevState.unlockedUpgrades
    );

    const trafficResult = this.trafficSubsystem.simulate(nextGrid, employedCitizens, prevState.unlockedUpgrades);
    const roadGraph = this.trafficSubsystem.roadNetwork.getGraph();

    const servicesResult = simulateCityServices(
      nextGrid,
      roadGraph,
      totalPop,
      employedCitizens,
      demands.desirability,
      trafficResult.averageCommuteTime,
      resTax,
      prevState.unlockedUpgrades
    );

    const depthResult = simulateCityDepthAndEnvironment(nextGrid, roadGraph, prevState.unlockedUpgrades);

    simulateBuildingEvolution(
      nextGrid,
      roadGraph,
      demands.residentialDemand,
      demands.commercialDemand,
      demands.industrialDemand,
      prevState.unlockedUpgrades
    );

    const activePolicies = prevState.activePolicies || [];
    const { income, expenses } = this.economySubsystem.calculateEconomy(
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

    const milestone = getCurrentMilestone(totalPop, nextMoney);

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
      buildings: this.entityRegistry.getBuildingsAsRecord(),
      day: prevState.day + 1,
      money: nextMoney,
      population: totalPop,
      milestoneLevel: milestone.level,
      activeEvents,
      activePolicies,
      completedMissions: prevState.completedMissions || [],
      unlockedAchievements: prevState.unlockedAchievements || [],
      powerCapacity: demands.powerCapacity,
      powerDemand: demands.powerDemand,
      waterCapacity: demands.waterCapacity,
      waterDemand: demands.waterDemand,
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
      residentialDemand: demands.residentialDemand,
      commercialDemand: demands.commercialDemand,
      industrialDemand: demands.industrialDemand,
      desirability: demands.desirability,
      residentialTaxRate: resTax,
      commercialTaxRate: comTax,
      industrialTaxRate: indTax,
      history: nextHistory,

      happiness: servicesResult.happiness,
      healthcareCoverage: servicesResult.healthcareCoverage,
      educationCoverage: servicesResult.educationCoverage,
      fireSafety: servicesResult.fireSafety,
      crimeRate: servicesResult.crimeRate,
      wasteCapacity: servicesResult.wasteCapacity,
      wasteProduction: servicesResult.wasteProduction,
      wasteCoverage: servicesResult.wasteCoverage,

      landValueAverage: depthResult.landValueAverage,
      pollutionAverage: depthResult.pollutionAverage,
      noiseAverage: depthResult.noiseAverage,
      educationLevel: depthResult.educationLevel,
      healthIndex: depthResult.healthIndex,
      buildingLevelCounts: depthResult.buildingLevelCounts,
      seed: nextSeed,
    };

    return nextState;
  }
}

const defaultEngine = new SimulationEngine();

export function simulateTick(prevState: CityState): CityState {
  return defaultEngine.simulateTick(prevState);
}

export function simulateTickInPlace(state: CityState): CityState {
  return defaultEngine.simulateTickInPlace(state);
}
