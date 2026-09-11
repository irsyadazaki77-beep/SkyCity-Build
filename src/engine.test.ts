import { describe, it, expect } from 'vitest';
import { TileType, CityState } from './types';
import { 
  createEmptyGrid, 
  allocateUtilities, 
  calculateDemandsAndDesirability, 
  simulatePopulation, 
  calculateEconomy, 
  simulateTick 
} from './engine';
import { TrafficSubsystem, getAdjacentRoadNodeKey } from './core/simulation/TrafficSubsystem';
import { simulateCityServices } from './services';
import { simulateCityDepthAndEnvironment, simulateBuildingEvolution } from './depthSimulation';

describe('Skyline Simulator Engine 5.0 Subsystems', () => {
  
  it('should allocate power and water strictly through connected network infrastructure', () => {
    const grid = createEmptyGrid();
    
    // Connected Network A: Power Plant at (0,0), connected Road at (0,1), Residential at (0,2)
    grid[0][0].type = TileType.POWER_PLANT;
    grid[0][1].type = TileType.ROAD;
    grid[0][2].type = TileType.RESIDENTIAL;

    // Connected Network B: Water Pump at (2,0), connected Road at (2,1), Residential at (2,2)
    grid[2][0].type = TileType.WATER_PUMP;
    grid[2][1].type = TileType.ROAD;
    grid[2][2].type = TileType.RESIDENTIAL;

    // Disconnected Isolated Residential at (5,5) with no generator or pump connected
    grid[5][5].type = TileType.RESIDENTIAL;
    
    const { powerCapacity, powerDemand, waterCapacity, waterDemand } = allocateUtilities(grid, []);
    
    expect(powerCapacity).toBe(50);
    expect(waterCapacity).toBe(50);
    
    // Network A residential has power, but no water
    expect(grid[0][2].powered).toBe(true);
    expect(grid[0][2].watered).toBe(false);

    // Network B residential has water, but no power
    expect(grid[2][2].watered).toBe(true);
    expect(grid[2][2].powered).toBe(false);

    // Isolated residential has neither power nor water
    expect(grid[5][5].powered).toBe(false);
    expect(grid[5][5].watered).toBe(false);
  });

  it('should calculate desirability and zoning demands correctly with taxes and services', () => {
    const state: CityState = {
      grid: createEmptyGrid(),
      money: 10000,
      population: 10,
      day: 1,
      powerCapacity: 50,
      powerDemand: 10,
      waterCapacity: 50,
      waterDemand: 10,
      trafficAverage: 0,
      averageCommuteTime: 0,
      congestionIndex: 0,
      income: 0,
      expenses: 0,
      unlockedUpgrades: [],
      households: 3,
      workers: 6,
      employment: 6,
      unemploymentRate: 0,
      availableJobs: 15,
      residentialDemand: 0,
      commercialDemand: 0,
      industrialDemand: 0,
      desirability: 50,
      residentialTaxRate: 9,
      commercialTaxRate: 9,
      industrialTaxRate: 9,
      history: [],
      happiness: 65,
      healthcareCoverage: 80,
      educationCoverage: 75,
      fireSafety: 90,
      crimeRate: 15,
      wasteCapacity: 200,
      wasteProduction: 20,
      wasteCoverage: 100,
      milestoneLevel: 0,
      activePolicies: [],
      activeEvents: [],
      completedMissions: [],
      unlockedAchievements: [],
      landValueAverage: 35,
      pollutionAverage: 0,
      noiseAverage: 0,
      educationLevel: 0,
      healthIndex: 50,
      buildingLevelCounts: {
        residential: [0, 0, 0, 0, 0],
        commercial: [0, 0, 0, 0, 0],
        industrial: [0, 0, 0, 0, 0],
      },
    };

    const { desirability, residentialDemand } = calculateDemandsAndDesirability(
      state.grid,
      state,
      50, 10, 50, 10
    );

    expect(desirability).toBeGreaterThanOrEqual(50); 
    expect(residentialDemand).toBeGreaterThanOrEqual(-100);
  });

  it('should penalize residential demand when tax rates are excessively high', () => {
    const state: CityState = {
      grid: createEmptyGrid(),
      money: 10000,
      population: 10,
      day: 1,
      powerCapacity: 50,
      powerDemand: 10,
      waterCapacity: 50,
      waterDemand: 10,
      trafficAverage: 0,
      averageCommuteTime: 0,
      congestionIndex: 0,
      income: 0,
      expenses: 0,
      unlockedUpgrades: [],
      households: 3,
      workers: 6,
      employment: 6,
      unemploymentRate: 0,
      availableJobs: 15,
      residentialDemand: 0,
      commercialDemand: 0,
      industrialDemand: 0,
      desirability: 50,
      residentialTaxRate: 20, // 20% Tax rate (sharp penalty!)
      commercialTaxRate: 9,
      industrialTaxRate: 9,
      history: [],
      happiness: 50,
      healthcareCoverage: 0,
      educationCoverage: 0,
      fireSafety: 100,
      crimeRate: 35,
      wasteCapacity: 0,
      wasteProduction: 0,
      wasteCoverage: 80,
      milestoneLevel: 0,
      activePolicies: [],
      activeEvents: [],
      completedMissions: [],
      unlockedAchievements: [],
      landValueAverage: 35,
      pollutionAverage: 0,
      noiseAverage: 0,
      educationLevel: 0,
      healthIndex: 50,
      buildingLevelCounts: {
        residential: [0, 0, 0, 0, 0],
        commercial: [0, 0, 0, 0, 0],
        industrial: [0, 0, 0, 0, 0],
      },
    };

    const { residentialDemand } = calculateDemandsAndDesirability(
      state.grid,
      state,
      50, 10, 50, 10
    );

    // Demand should be penalized and pushed to very low levels
    expect(residentialDemand).toBeLessThan(0);
  });

  it('should simulate city services coverage along connected road networks', () => {
    const grid = createEmptyGrid();
    
    // Connected road from (1,0) to (5,0)
    for (let x = 1; x <= 5; x++) {
      grid[0][x].type = TileType.ROAD;
    }

    // Power plant connected to road
    grid[0][0].type = TileType.POWER_PLANT;

    // Clinic placed next to road at (1,1)
    grid[1][1].type = TileType.CLINIC;
    grid[1][1].powered = true;

    // Fire Station placed next to road at (2,1)
    grid[1][2].type = TileType.FIRE_STATION;
    grid[1][2].powered = true;

    // Residential building next to road at (5,1)
    grid[1][5].type = TileType.RESIDENTIAL;
    grid[1][5].population = 10;
    grid[1][5].powered = true;
    grid[1][5].watered = true;

    const trafficSys = new TrafficSubsystem();
    trafficSys.roadNetwork.rebuildFull(grid, []);
    const roadGraph = trafficSys.roadNetwork.getGraph();
    const servicesResult = simulateCityServices(grid, roadGraph, 10, 5, 60, 2, 9, []);

    expect(grid[1][5].healthCovered).toBe(true);
    expect(grid[1][5].fireCovered).toBe(true);
    expect(servicesResult.healthcareCoverage).toBe(100);
    expect(servicesResult.fireSafety).toBe(100);
    expect(servicesResult.happiness).toBeGreaterThan(50);
  });

  it('should cause abandonment when utilities or road access are missing', () => {
    const grid = createEmptyGrid();
    grid[1][0].type = TileType.ROAD; 
    grid[1][1].type = TileType.RESIDENTIAL;
    grid[1][1].powered = false; // missing power
    grid[1][1].watered = true;
    grid[1][1].population = 1;

    // Run tick - population drops to 0
    const { totalPop } = simulatePopulation(grid, 50, 50, []);
    expect(totalPop).toBe(0);
    expect(grid[1][1].abandoned).toBe(true);
  });

  it('should calculate economy breakdown correctly with services maintenance', () => {
    const grid = createEmptyGrid();
    grid[0][0].type = TileType.ROAD;
    grid[0][1].type = TileType.FIRE_STATION;
    grid[0][2].type = TileType.POLICE_STATION;
    grid[0][3].type = TileType.CLINIC;

    const { expenses, serviceMaint } = calculateEconomy(
      grid,
      0, 0, 0, 0, [], 9, 9, 9
    );

    expect(serviceMaint).toBeGreaterThan(0);
    expect(expenses).toBeGreaterThan(0);
  });

  it('should simulate entire cycles deterministically under the same state inputs', () => {
    const state: CityState = {
      grid: createEmptyGrid(),
      money: 10000,
      population: 0,
      day: 1,
      powerCapacity: 0,
      powerDemand: 0,
      waterCapacity: 0,
      waterDemand: 0,
      trafficAverage: 0,
      averageCommuteTime: 0,
      congestionIndex: 0,
      income: 0,
      expenses: 0,
      unlockedUpgrades: [],
      households: 0,
      workers: 0,
      employment: 0,
      unemploymentRate: 0,
      availableJobs: 0,
      residentialDemand: 0,
      commercialDemand: 0,
      industrialDemand: 0,
      desirability: 50,
      residentialTaxRate: 9,
      commercialTaxRate: 9,
      industrialTaxRate: 9,
      history: [],
      happiness: 50,
      healthcareCoverage: 0,
      educationCoverage: 0,
      fireSafety: 100,
      crimeRate: 35,
      wasteCapacity: 0,
      wasteProduction: 0,
      wasteCoverage: 80,
      milestoneLevel: 0,
      activePolicies: [],
      activeEvents: [],
      completedMissions: [],
      unlockedAchievements: [],
      landValueAverage: 35,
      pollutionAverage: 0,
      noiseAverage: 0,
      educationLevel: 0,
      healthIndex: 50,
      buildingLevelCounts: {
        residential: [0, 0, 0, 0, 0],
        commercial: [0, 0, 0, 0, 0],
        industrial: [0, 0, 0, 0, 0],
      },
    };

    const firstRun = simulateTick(state);
    const secondRun = simulateTick(state);

    expect(firstRun.population).toBe(secondRun.population);
    expect(firstRun.money).toBe(secondRun.money);
    expect(firstRun.income).toBe(secondRun.income);
    expect(firstRun.expenses).toBe(secondRun.expenses);
  });

  it('should calculate environmental pollution from industrial zones and absorb it via parks', () => {
    const grid = createEmptyGrid();
    
    // Industrial zone at (5,5) generating pollution
    grid[5][5].type = TileType.INDUSTRIAL;
    grid[5][5].level = 3; // High level heavy industrial

    // Residential zone at (5,6) near industrial
    grid[5][6].type = TileType.RESIDENTIAL;

    // Park zone at (5,7) absorbing pollution
    grid[5][7].type = TileType.PARK;

    const trafficSys = new TrafficSubsystem();
    trafficSys.roadNetwork.rebuildFull(grid, []);
    const roadGraph = trafficSys.roadNetwork.getGraph();
    const { pollutionAverage, landValueAverage } = simulateCityDepthAndEnvironment(grid, roadGraph, []);

    // Environmental pollution recorded
    expect(grid[5][6].pollution).toBeGreaterThan(0);
    expect(pollutionAverage).toBeGreaterThanOrEqual(0);
    expect(landValueAverage).toBeGreaterThan(0);
  });

  it('should upgrade building levels progressively when stability and service requirements are satisfied', () => {
    const grid = createEmptyGrid();
    grid[0][0].type = TileType.ROAD;
    
    // Residential building at (0,1) with high occupancy and high land value
    grid[0][1].type = TileType.RESIDENTIAL;
    grid[0][1].level = 1;
    grid[0][1].population = 4; // 100% capacity for L1
    grid[0][1].powered = true;
    grid[0][1].watered = true;
    grid[0][1].landValue = 40;
    grid[0][1].fireCovered = true;

    const trafficSys = new TrafficSubsystem();
    trafficSys.roadNetwork.rebuildFull(grid, []);
    const roadGraph = trafficSys.roadNetwork.getGraph();

    // Simulate 4 progression ticks to reach upgrade threshold
    for (let i = 0; i < 4; i++) {
      simulateBuildingEvolution(grid, roadGraph, 50, 20, 20, []);
    }

    // Building should now be Level 2
    expect(grid[0][1].level).toBe(2);
  });

  it('should route freight from Industrial to Commercial and calculate goods supply and traffic loads', () => {
    const grid = createEmptyGrid();
    // Build a connected road corridor from (0,0) to (5,0)
    for (let x = 0; x <= 5; x++) {
      grid[0][x].type = TileType.ROAD;
      grid[0][x].powered = true;
      grid[0][x].watered = true;
    }

    // Place Residential at (1,0), Commercial at (1,4), Industrial at (1,5)
    grid[1][0].type = TileType.RESIDENTIAL;
    grid[1][0].population = 40;
    grid[1][0].powered = true;
    grid[1][0].watered = true;

    grid[1][4].type = TileType.COMMERCIAL;
    grid[1][4].jobs = 8;
    grid[1][4].powered = true;
    grid[1][4].watered = true;

    grid[1][5].type = TileType.INDUSTRIAL;
    grid[1][5].jobs = 12;
    grid[1][5].powered = true;
    grid[1][5].watered = true;

    const trafficSys = new TrafficSubsystem();
    const result = trafficSys.simulate(grid, 10, []);

    // Road tiles along corridor should carry traffic
    expect(result.averageTraffic).toBeGreaterThan(0);
    expect(result.activeVehicles.length).toBeGreaterThan(0);
    expect(result.logisticsEfficiency).toBeGreaterThan(50);
    expect(result.goodsSupplyIndex).toBeGreaterThan(50);

    // Commercial tile at (1,4) should receive goods from Industrial at (1,5)
    expect(grid[1][4].goodsStock).toBeGreaterThanOrEqual(50);
    expect(grid[1][5].logisticsSatisfaction).toBeGreaterThanOrEqual(50);
    expect(grid[1][4].productivity).toBeGreaterThan(0);
  });

  it('should enforce capacity limits on city services and prioritize closer buildings along road networks', () => {
    const grid = createEmptyGrid();
    // Build a straight road line from (0,0) to (0,20)
    for (let y = 0; y <= 20; y++) {
      grid[y][0].type = TileType.ROAD;
      grid[y][0].powered = true;
      grid[y][0].watered = true;
    }

    // Place a Clinic at (0,1) with capacity = 140
    grid[0][1].type = TileType.CLINIC;
    grid[0][1].powered = true;
    grid[0][1].watered = true;

    // Place a dense residential building near the clinic at (2,1) with 100 population
    grid[2][1].type = TileType.RESIDENTIAL;
    grid[2][1].population = 100;
    grid[2][1].powered = true;
    grid[2][1].watered = true;

    // Place another dense residential building further down at (10,1) with 100 population (total 200 > 140 cap)
    grid[10][1].type = TileType.RESIDENTIAL;
    grid[10][1].population = 100;
    grid[10][1].powered = true;
    grid[10][1].watered = true;

    const trafficSys = new TrafficSubsystem();
    trafficSys.roadNetwork.rebuildFull(grid, []);
    const roadGraph = trafficSys.roadNetwork.getGraph();

    const servicesResult = simulateCityServices(grid, roadGraph, 200, 130, 50, 2, 9, []);

    // The closer building at (2,1) should get full healthcare coverage
    expect(grid[2][1].healthCovered).toBe(true);
    // The distant building at (10,1) has exhausted remaining capacity and gets partial/no coverage
    expect(grid[10][1].healthCovered).toBe(false);
    // Overall city coverage reflects the capacity constraint
    expect(servicesResult.healthcareCoverage).toBeLessThan(100);
    expect(servicesResult.healthcareCoverage).toBeGreaterThanOrEqual(50);
  });

  it('should trigger crime, sickness, and low land value when services are absent, and boost health, education, and land value when present', () => {
    const grid = createEmptyGrid();
    for (let y = 0; y <= 10; y++) {
      grid[y][0].type = TileType.ROAD;
      grid[y][0].powered = true;
      grid[y][0].watered = true;
    }

    // Unserviced residential at (2,1)
    grid[2][1].type = TileType.RESIDENTIAL;
    grid[2][1].population = 20;
    grid[2][1].powered = true;
    grid[2][1].watered = true;

    const trafficSys = new TrafficSubsystem();
    trafficSys.roadNetwork.rebuildFull(grid, []);
    let roadGraph = trafficSys.roadNetwork.getGraph();

    // 1. Without services
    simulateCityServices(grid, roadGraph, 20, 13, 50, 2, 9, []);
    simulateCityDepthAndEnvironment(grid, roadGraph, []);

    expect(grid[2][1].policeCovered).toBe(false);
    expect(grid[2][1].healthCovered).toBe(false);
    expect(grid[2][1].crime).toBeGreaterThan(40); // High crime without police
    expect(grid[2][1].health).toBeLessThan(50);   // Sickness without clinic & waste

    // 2. Now add Police Station, Clinic, School, and Waste Management
    grid[0][1].type = TileType.POLICE_STATION;
    grid[0][1].powered = true;
    grid[0][1].watered = true;

    grid[1][1].type = TileType.CLINIC;
    grid[1][1].powered = true;
    grid[1][1].watered = true;

    grid[3][1].type = TileType.SCHOOL;
    grid[3][1].powered = true;
    grid[3][1].watered = true;

    grid[4][1].type = TileType.WASTE_MANAGEMENT;
    grid[4][1].powered = true;
    grid[4][1].watered = true;

    trafficSys.roadNetwork.rebuildFull(grid, []);
    roadGraph = trafficSys.roadNetwork.getGraph();

    simulateCityServices(grid, roadGraph, 20, 13, 50, 2, 9, []);
    simulateCityDepthAndEnvironment(grid, roadGraph, []);

    expect(grid[2][1].policeCovered).toBe(true);
    expect(grid[2][1].healthCovered).toBe(true);
    expect(grid[2][1].schoolCovered).toBe(true);
    expect(grid[2][1].wasteCovered).toBe(true);
    expect(grid[2][1].crime).toBeLessThanOrEqual(15); // Suppressed by police
    expect(grid[2][1].health).toBeGreaterThanOrEqual(80); // Health boosted by clinic & waste
    expect(grid[2][1].landValue).toBeGreaterThanOrEqual(60); // High land value from all services
  });

  it('should penalize municipal budget with maintenance costs when spamming unutilized service facilities', () => {
    const grid = createEmptyGrid();
    grid[0][0].type = TileType.ROAD;

    // Build 5 Fire Stations and 5 Police Stations without any population
    for (let x = 1; x <= 5; x++) {
      grid[1][x].type = TileType.FIRE_STATION;
      grid[2][x].type = TileType.POLICE_STATION;
    }

    const economy = calculateEconomy(grid, 0, 0, 0, 0, [], 9, 9, 9, [], []);

    // Service maintenance should be significant (5 * 35 + 5 * 30 = $325/tick)
    expect(economy.serviceMaint).toBeGreaterThanOrEqual(300);
    // Since there are 0 residents/businesses, income is $0 and netIncome is negative (deficit)
    expect(economy.income).toBe(0);
    expect(economy.netIncome).toBeLessThan(-300);
  });
});

