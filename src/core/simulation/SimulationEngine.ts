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

export function allocateUtilities(grid: TileData[][], unlockedUpgrades: string[] = [], activeEvents: ActiveEvent[] = [], serviceBudgets?: any) {
  return simulateUtilityNetworks(grid, unlockedUpgrades, activeEvents, serviceBudgets);
}

export function calculateDemandsAndDesirability(
  grid: TileData[][],
  prevState: CityState,
  powerCapacity: number,
  powerDemand: number,
  waterCapacity: number,
  waterDemand: number
) {
  const hasU = (id: string) => (prevState.unlockedUpgrades || []).includes(id);

  let desirability = 50;

  const powerCoverage = powerDemand > 0 ? Math.min(1, powerCapacity / powerDemand) : 1;
  const waterCoverage = waterDemand > 0 ? Math.min(1, waterCapacity / waterDemand) : 1;
  
  // Power & Water reliability
  if (powerCoverage >= 1) desirability += 12;
  else desirability -= Math.round((1 - powerCoverage) * 35);

  if (waterCoverage >= 1) desirability += 12;
  else desirability -= Math.round((1 - waterCoverage) * 35);

  const happiness = prevState.happiness ?? 50;
  const healthCov = prevState.healthcareCoverage ?? 50;
  const eduCov = prevState.educationCoverage ?? 50;
  const fireSafety = prevState.fireSafety ?? 100;
  const crimeRate = prevState.crimeRate ?? 35;
  const wasteCov = prevState.wasteCoverage ?? 80;
  const avgPollution = prevState.pollutionAverage ?? 0;
  const avgNoise = prevState.noiseAverage ?? 0;

  // City services and environmental desirability
  desirability += (healthCov - 50) * 0.16;
  desirability += (eduCov - 50) * 0.14;
  desirability += (fireSafety - 50) * 0.12;
  desirability += (30 - crimeRate) * 0.25; // Crime is a major deterrent
  desirability += (wasteCov - 50) * 0.15;
  desirability += (happiness - 50) * 0.15;

  // Environmental impact on desirability
  if (avgPollution > 25) desirability -= Math.round((avgPollution - 25) * 0.4);
  if (avgNoise > 30) desirability -= Math.round((avgNoise - 30) * 0.3);

  const congestionIndex = prevState.congestionIndex ?? 0;
  const averageCommute = prevState.averageCommuteTime ?? 0;

  // Traffic & Commute friction
  if (congestionIndex > 15) {
    desirability -= Math.min(25, Math.round((congestionIndex - 15) * 0.8));
  } else if (prevState.trafficAverage > 0 && congestionIndex === 0) {
    desirability += 5;
  }

  if (averageCommute > 8) {
    desirability -= Math.min(20, Math.round((averageCommute - 8) * 1.8));
  }

  // Upgrade bonuses
  if (hasU('prop_tax_hike')) desirability -= 5;
  if (hasU('wealth_tax')) desirability -= 5;
  if (hasU('green_roofs')) desirability += 6;
  if (hasU('recycling')) desirability += 5;
  if (hasU('ai_management')) desirability += 10;
  if (hasU('tourism')) desirability += 6;

  const activePolicies = prevState.activePolicies || [];
  const activeEvents = (prevState.activeEvents || []) as ActiveEvent[];

  if (activePolicies.includes('FREE_TRANSIT')) {
    desirability += 6;
  }
  if (activePolicies.includes('GREEN_SUBSIDY')) {
    desirability += 4;
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

  const laborSupply = prevState.workers > 0 ? prevState.workers : Math.round((prevState.population || 0) * 0.65);
  const jobsVSWorkers = (prevState.availableJobs || 0) - laborSupply;
  const unempRate = prevState.unemploymentRate ?? 0;
  const unemploymentFriction = unempRate > 6 ? (unempRate - 6) * 3.5 : (6 - unempRate) * 1.5;
  const utilityFactor = (powerCoverage + waterCoverage) / 2;
  const commutePenalty = averageCommute > 9 ? (averageCommute - 9) * 2.5 : 0;

  // 1. RESIDENTIAL DEMAND: Jobs availability, desirability, unemployment, utilities, taxes, commute
  let residentialDemand = (desirability - 50) * 1.4 + (jobsVSWorkers * 1.8) - unemploymentFriction + ((utilityFactor - 1) * 60) - commutePenalty;

  if (resTaxRate <= GAME_CONFIG.TAX_OPTIMAL) {
    residentialDemand += (GAME_CONFIG.TAX_OPTIMAL - resTaxRate) * 4.5;
  } else {
    residentialDemand -= (resTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
    if (resTaxRate > 13) {
      residentialDemand -= (resTaxRate - 13) * 6; // Severe tax flight
    }
  }
  residentialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(residentialDemand)));

  // 2. COMMERCIAL DEMAND: Population, purchasing power, road access, traffic, supply chain, taxes
  const employmentRate = Math.max(0, 1 - (unempRate / 100));
  const purchasingPower = (prevState.population || 0) * employmentRate * (1 - resTaxRate / 100);
  const commercialTrafficPenalty = congestionIndex > 18 ? (congestionIndex - 18) * 1.1 : 0;
  const goodsSupplyIndex = prevState.goodsSupplyIndex ?? 80;
  const goodsSupplyPenalty = goodsSupplyIndex < 65 ? (65 - goodsSupplyIndex) * 0.9 : 0;
  const crimePenaltyCom = crimeRate > 30 ? (crimeRate - 30) * 0.6 : 0;

  let commercialDemand = (purchasingPower * 0.55) - (unempRate * 0.8) - commercialTrafficPenalty - goodsSupplyPenalty - crimePenaltyCom - 15;
  if (hasU('mixed_use')) commercialDemand += 15;
  if (hasU('small_biz')) commercialDemand += 10;
  if (hasU('tourism')) commercialDemand += 20;
  if (hasU('digital_econ')) commercialDemand += 15;

  if (comTaxRate <= GAME_CONFIG.TAX_OPTIMAL) {
    commercialDemand += (GAME_CONFIG.TAX_OPTIMAL - comTaxRate) * 4;
  } else {
    commercialDemand -= (comTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
    if (comTaxRate > 13) {
      commercialDemand -= (comTaxRate - 13) * 6;
    }
  }
  commercialDemand = Math.max(GAME_CONFIG.DEMAND_MIN, Math.min(GAME_CONFIG.DEMAND_MAX, Math.round(commercialDemand)));

  // 3. INDUSTRIAL DEMAND: Workforce supply, logistics access, utilities, taxes
  const availableWorkforce = Math.max(0, laborSupply - (prevState.employment || 0));
  const logisticsEfficiency = prevState.logisticsEfficiency ?? 80;
  const logisticsPenalty = congestionIndex > 15 ? (congestionIndex - 15) * 1.2 : 0;
  const logisticsDeficitPenalty = logisticsEfficiency < 65 ? (65 - logisticsEfficiency) * 0.8 : 0;
  const indUtilityPenalty = (utilityFactor < 1 ? (1 - utilityFactor) * 70 : 0);

  let industrialDemand = (availableWorkforce * 1.2) - (jobsVSWorkers > 0 ? jobsVSWorkers * 1.2 : 0) - logisticsPenalty - logisticsDeficitPenalty - indUtilityPenalty + 10;
  if (hasU('heavy_industry')) industrialDemand += 20;
  if (hasU('logistics_hub')) industrialDemand += 15;
  if (hasU('automation')) industrialDemand += 15;

  if (indTaxRate <= GAME_CONFIG.TAX_OPTIMAL) {
    industrialDemand += (GAME_CONFIG.TAX_OPTIMAL - indTaxRate) * 4;
  } else {
    industrialDemand -= (indTaxRate - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT;
    if (indTaxRate > 13) {
      industrialDemand -= (indTaxRate - 13) * 6;
    }
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
        } else if (tile.abandoned) {
          tile.population = 0;
        } else {
          const lvl = Math.max(1, Math.min(5, tile.level || 1));
          const maxCapacity = RESIDENTIAL_CAPACITIES[lvl] || 4;

          // Local conditions affect growth pacing
          const localBlight = (tile.pollution ?? 0) > 50 || (tile.crime ?? 0) > 55;

          if (residentialDemand > 0 && !localBlight) {
            const growthStep = Math.max(1, Math.ceil((residentialDemand / 100) * 2));
            tile.population = Math.min(maxCapacity, (tile.population || 0) + growthStep);
          } else if (residentialDemand < -20 || localBlight) {
            tile.population = Math.max(0, (tile.population || 0) - 1);
          }

          if (tile.population === 0 && residentialDemand < -10) {
            tile.abandoned = true;
          }
        }
        totalPop += tile.population || 0;
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
        } else if (tile.abandoned) {
          tile.jobs = 0;
        } else {
          const lvl = Math.max(1, Math.min(5, tile.level || 1));
          const maxJobs = COMMERCIAL_CAPACITIES[lvl] || 3;
          if (commercialDemand > 0) {
            const growth = Math.max(1, Math.ceil((commercialDemand / 100) * 2));
            tile.jobs = Math.min(maxJobs, (tile.jobs || 0) + growth);
          } else if (commercialDemand < -20) {
            tile.jobs = Math.max(0, (tile.jobs || 0) - 1);
          }

          if (tile.jobs === 0 && commercialDemand < -15) {
            tile.abandoned = true;
          }
        }
        totalNominalJobs += tile.jobs || 0;
      } else if (tile.type === TileType.INDUSTRIAL) {
        if (!tile.powered || !tile.watered) {
          tile.jobs = 0;
          tile.abandoned = true;
        } else if (tile.abandoned) {
          tile.jobs = 0;
        } else {
          const lvl = Math.max(1, Math.min(5, tile.level || 1));
          const maxJobs = INDUSTRIAL_CAPACITIES[lvl] || 5;
          if (industrialDemand > 0) {
            const growth = Math.max(1, Math.ceil((industrialDemand / 100) * 2));
            tile.jobs = Math.min(maxJobs, (tile.jobs || 0) + growth);
          } else if (industrialDemand < -20) {
            tile.jobs = Math.max(0, (tile.jobs || 0) - 1);
          }

          if (tile.jobs === 0 && industrialDemand < -15) {
            tile.abandoned = true;
          }
        }
        totalNominalJobs += tile.jobs || 0;
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
  private lastTrafficResult: any = null;
  public chunkManager = new ChunkManager(GRID_WIDTH, GRID_HEIGHT);

  public getLastTrafficResult() {
    return this.lastTrafficResult;
  }

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

    const serviceBudgets = prevState.serviceBudgets || { ...GAME_CONFIG.DEFAULT_SERVICE_BUDGETS };
    let cityLoans = (prevState.cityLoans || []).map((l) => ({ ...l }));
    let consecutiveDeficitDays = prevState.consecutiveDeficitDays || 0;
    let fiscalCrisis: import('../../types').FiscalCrisisState = prevState.fiscalCrisis ? { ...prevState.fiscalCrisis } : {
      isInCrisis: false,
      isCrisis: false,
      daysInCrisis: 0,
      severity: 0,
      consecutiveDeficitDays: 0,
      creditRating: 'AAA',
      borrowingLimit: 20000,
      strikingSectors: [],
    };
    let roadConditionAverage = prevState.roadConditionAverage ?? 100;

    // 1. Road Condition dynamics based on Road Maintenance Budget
    const roadTargetCondition = serviceBudgets.roads;
    if (roadConditionAverage < roadTargetCondition) {
      roadConditionAverage = Math.min(100, Math.round(roadConditionAverage + 1.0));
    } else if (roadConditionAverage > roadTargetCondition) {
      roadConditionAverage = Math.max(25, Math.round(roadConditionAverage - 1.5));
    }

    // 2. Active Events management
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

    // 3. Allocate Utilities scaled by Power and Water Budgets
    const utilities = allocateUtilities(nextGrid, prevState.unlockedUpgrades, activeEvents, serviceBudgets);

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

    // 4. Simulate Traffic with Road Budget and Condition
    const trafficResult = this.trafficSubsystem.simulate(
      nextGrid,
      employedCitizens,
      prevState.unlockedUpgrades,
      serviceBudgets.roads,
      roadConditionAverage
    );
    this.lastTrafficResult = trafficResult;
    const roadGraph = this.trafficSubsystem.roadNetwork.getGraph();

    // 5. Simulate City Services scaled by Budgets & Striking sectors
    const servicesResult = simulateCityServices(
      nextGrid,
      roadGraph,
      totalPop,
      employedCitizens,
      demands.desirability,
      trafficResult.averageCommuteTime,
      resTax,
      prevState.unlockedUpgrades,
      serviceBudgets,
      fiscalCrisis.strikingSectors || [],
      fiscalCrisis.isCrisis
    );

    const depthResult = simulateCityDepthAndEnvironment(nextGrid, roadGraph, prevState.unlockedUpgrades);

    simulateBuildingEvolution(
      nextGrid,
      roadGraph,
      demands.residentialDemand,
      demands.commercialDemand,
      demands.industrialDemand,
      prevState.unlockedUpgrades,
      {
        unemploymentRate,
        educationLevel: depthResult.educationLevel,
        congestionIndex: trafficResult.congestionIndex,
        logisticsEfficiency: trafficResult.logisticsEfficiency,
        goodsSupplyIndex: trafficResult.goodsSupplyIndex,
        purchasingPower: Math.round(totalPop * Math.max(0, 1 - (unemploymentRate / 100))),
        workers,
        employedCitizens,
        resTax,
        comTax,
        indTax,
      }
    );

    const activePolicies = prevState.activePolicies || [];

    // 6. Calculate Deep Economy with Service Budgets, Loans, Deficits, and Overdrafts
    const ecoResult = this.economySubsystem.calculateEconomy(
      nextGrid,
      totalPop,
      employedCitizens,
      totalNominalJobs,
      workers,
      prevState.unlockedUpgrades,
      resTax,
      comTax,
      indTax,
      {
        serviceBudgets,
        cityLoans,
        currentMoney: prevState.money,
        activePolicies,
        activeEvents,
        isFiscalCrisis: fiscalCrisis.isCrisis,
        strikingSectors: fiscalCrisis.strikingSectors,
        trafficAverage: trafficResult.averageTraffic,
        powerDemand: demands.powerDemand,
        powerCapacity: demands.powerCapacity,
        waterDemand: demands.waterDemand,
        waterCapacity: demands.waterCapacity,
        wasteProduction: servicesResult.wasteProduction,
        wasteCapacity: servicesResult.wasteCapacity,
      }
    );

    const income = ecoResult.income;
    const expenses = ecoResult.expenses;
    const netIncome = income - expenses;

    // 7. Loan Amortization Progression
    const updatedLoans = cityLoans
      .map((loan) => {
        const remainingDays = loan.remainingDays - 1;
        const paidFraction = 1 / Math.max(1, loan.remainingDays);
        const newPrincipal = Math.max(0, Math.round(loan.principal * (1 - paidFraction)));
        return {
          ...loan,
          remainingDays,
          principal: newPrincipal,
        };
      })
      .filter((l) => l.remainingDays > 0 && l.principal > 0);

    const totalDebt = updatedLoans.reduce((sum, l) => sum + l.principal, 0);
    const dailyDebtService = updatedLoans.reduce((sum, l) => sum + l.dailyPayment, 0);

    // 8. Net Treasury Update (Deficits allowed!)
    const nextMoney = prevState.money + netIncome;

    if (nextMoney < 0) {
      consecutiveDeficitDays += 1;
    } else {
      consecutiveDeficitDays = Math.max(0, consecutiveDeficitDays - 1);
    }

    // 9. Credit Rating Evaluation
    let creditRating: any = 'AAA';
    const debtToIncome = income > 0 ? totalDebt / income : totalDebt / 100;

    if (consecutiveDeficitDays >= 14 || nextMoney < -30000) {
      creditRating = 'D';
    } else if (consecutiveDeficitDays >= 9 || nextMoney < -12000 || debtToIncome > 50) {
      creditRating = 'C';
    } else if (consecutiveDeficitDays >= 6 || nextMoney < -4000 || debtToIncome > 30) {
      creditRating = 'BB';
    } else if (consecutiveDeficitDays >= 3 || nextMoney < 0 || debtToIncome > 18) {
      creditRating = 'BBB';
    } else if (debtToIncome > 10) {
      creditRating = 'A';
    } else if (debtToIncome > 4) {
      creditRating = 'AA';
    } else {
      creditRating = 'AAA';
    }

    const ratingConfig = GAME_CONFIG.CREDIT_RATINGS[creditRating as keyof typeof GAME_CONFIG.CREDIT_RATINGS] || GAME_CONFIG.CREDIT_RATINGS.AAA;
    const borrowingCapacity = Math.max(0, Math.round(Math.max(5000, totalPop * 40 + income * 15) * ratingConfig.maxBorrowMultiplier - totalDebt));

    // 10. Fiscal Crisis State Machine
    if (consecutiveDeficitDays >= GAME_CONFIG.CRISIS_TRIGGER_DEFICIT_DAYS || nextMoney < -15000 || creditRating === 'D') {
      const daysInCrisis = (fiscalCrisis.daysInCrisis || 0) + 1;
      const severity = Math.min(100, Math.round(20 + daysInCrisis * 6 + Math.min(50, Math.abs(Math.min(0, nextMoney)) / 500)));
      
      const strikingSectors: string[] = [];
      if (severity >= 25) strikingSectors.push('roads', 'waste');
      if (severity >= 50) strikingSectors.push('health', 'police');
      if (severity >= 75) strikingSectors.push('fire', 'education', 'power', 'water');

      fiscalCrisis = {
        isInCrisis: true,
        isCrisis: true,
        daysInCrisis,
        severity,
        consecutiveDeficitDays,
        creditRating,
        borrowingLimit: borrowingCapacity,
        strikingSectors,
      };
    } else if (nextMoney >= 0 && consecutiveDeficitDays === 0) {
      fiscalCrisis = {
        isInCrisis: false,
        isCrisis: false,
        daysInCrisis: 0,
        severity: 0,
        consecutiveDeficitDays: 0,
        creditRating,
        borrowingLimit: borrowingCapacity,
        strikingSectors: [],
      };
    } else if (fiscalCrisis.isCrisis || fiscalCrisis.isInCrisis) {
      // De-escalating crisis
      const daysInCrisis = Math.max(0, (fiscalCrisis.daysInCrisis || 1) - 1);
      fiscalCrisis = {
        ...fiscalCrisis,
        isInCrisis: true,
        isCrisis: true,
        consecutiveDeficitDays,
        creditRating,
        borrowingLimit: borrowingCapacity,
        daysInCrisis,
        severity: Math.max(10, (fiscalCrisis.severity || 20) - 10),
      };
    }

    const milestone = getCurrentMilestone(totalPop, Math.max(0, nextMoney));

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
      buildings: prevState.buildings ?? {},
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
      logisticsEfficiency: trafficResult.logisticsEfficiency,
      goodsSupplyIndex: trafficResult.goodsSupplyIndex,
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

      // Deep Financial State
      serviceBudgets,
      cityLoans: updatedLoans,
      creditRating,
      fiscalCrisis,
      consecutiveDeficitDays,
      totalDebt,
      borrowingCapacity,
      dailyDebtService,
      roadConditionAverage,
      taxEfficiency: Math.round((ecoResult.taxEfficiency.residential + ecoResult.taxEfficiency.commercial + ecoResult.taxEfficiency.industrial) / 3),
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
