import { describe, it, expect } from 'vitest';
import { AuthoritativeSimulation } from './core/simulation/AuthoritativeSimulation';
import { ChunkManager } from './core/simulation/ChunkManager';
import { createEmptyGrid } from './engine';
import { TileType, CityState, SimulationCommand } from './types';
import { GAME_CONFIG } from './config';

function createMockInitialState(funds = 50000): CityState {
  const grid = createEmptyGrid();
  // Ensure center region (1,1) tiles are dry land for testing
  for (let y = 20; y < 40; y++) {
    for (let x = 20; x < 40; x++) {
      grid[y][x].water = false;
      grid[y][x].elevation = 1;
      grid[y][x].type = TileType.EMPTY;
    }
  }

  return {
    grid,
    money: funds,
    population: 0,
    milestoneLevel: 0,
    activePolicies: [],
    activeEvents: [],
    completedMissions: [],
    unlockedAchievements: [],
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
    residentialDemand: 50,
    commercialDemand: 40,
    industrialDemand: 40,
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
    unlockedRegions: ['1,1'],
    buildings: {},
  };
}

describe('Foundation Stability Tests', () => {
  it('1. Authoritative Validation: BUILD_ROAD should reject locked regions and insufficient funds', () => {
    const sim = new AuthoritativeSimulation(createMockInitialState(100));

    // Attempt to build in locked region (0,0) -> coordinates (5,5)
    const lockedRes = sim.executeCommand({
      type: 'BUILD_ROAD',
      payload: { tiles: [[5, 5]] },
    });
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.reason).toBe('LOCKED_REGION');

    // Build road in unlocked region (1,1) -> (25, 25)
    const validRes = sim.executeCommand({
      type: 'BUILD_ROAD',
      payload: { tiles: [[25, 25]] },
    });
    expect(validRes.success).toBe(true);
    expect(sim.getGrid()[25][25].type).toBe(TileType.ROAD);
    expect(sim.getState().money).toBe(75); // 100 - 25
  });

  it('2. Authoritative Validation: BUILD_ZONE requires road adjacency for RCI and checks funds & prereqs', () => {
    const sim = new AuthoritativeSimulation(createMockInitialState(5000));

    // Zone residential without adjacent road -> should fail invalid tile
    const noRoadRes = sim.executeCommand({
      type: 'BUILD_ZONE',
      payload: { tiles: [[30, 30]], type: TileType.RESIDENTIAL },
    });
    expect(noRoadRes.success).toBe(false);
    expect(noRoadRes.reason).toBe('INVALID_TILE');

    // Build road first at (30, 29)
    sim.executeCommand({
      type: 'BUILD_ROAD',
      payload: { tiles: [[30, 29]] },
    });

    // Zone residential adjacent to road -> should succeed
    const zoneRes = sim.executeCommand({
      type: 'BUILD_ZONE',
      payload: { tiles: [[30, 30]], type: TileType.RESIDENTIAL },
    });
    expect(zoneRes.success).toBe(true);
    expect(sim.getGrid()[30][30].type).toBe(TileType.RESIDENTIAL);
    expect(sim.getState().buildings?.['30,30']).toBeDefined();

    // High milestone tech building (e.g., WASTE_MANAGEMENT requires milestone 5)
    const techRes = sim.executeCommand({
      type: 'BUILD_ZONE',
      payload: { tiles: [[31, 30]], type: TileType.WASTE_MANAGEMENT },
    });
    expect(techRes.success).toBe(false);
    expect(techRes.reason).toBe('TECH_LOCKED');
  });

  it('3. Authoritative Validation: BULLDOZE cleans both grid and building entities', () => {
    const sim = new AuthoritativeSimulation(createMockInitialState(5000));

    // Build road and residential
    sim.executeCommand({ type: 'BUILD_ROAD', payload: { tiles: [[25, 24]] } });
    sim.executeCommand({ type: 'BUILD_ZONE', payload: { tiles: [[25, 25]], type: TileType.RESIDENTIAL } });
    expect(sim.getState().buildings?.['25,25']).toBeDefined();

    // Bulldoze residential
    const bulldozeRes = sim.executeCommand({
      type: 'BULLDOZE',
      payload: { tiles: [[25, 25]] },
    });
    expect(bulldozeRes.success).toBe(true);
    expect(sim.getGrid()[25][25].type).toBe(TileType.EMPTY);
    expect(sim.getState().buildings?.['25,25']).toBeUndefined();
  });

  it('4. Authoritative Validation: UNLOCK_REGION and UNLOCK_TECH prerequisites and funds', () => {
    const sim = new AuthoritativeSimulation(createMockInitialState(60000));

    // Unlock region (1,2)
    const unlockReg = sim.executeCommand({
      type: 'UNLOCK_REGION',
      payload: { rx: 1, ry: 2 },
    });
    expect(unlockReg.success).toBe(true);
    expect(sim.getState().unlockedRegions).toContain('1,2');
    expect(sim.getState().money).toBe(45000); // 60000 - 15000

    // Unlock tech with prerequisite not met
    const techPrereqFail = sim.executeCommand({
      type: 'UNLOCK_TECH',
      payload: { techId: 'smart_lights' }, // requires asphalt_roads & milestone 1
    });
    expect(techPrereqFail.success).toBe(false);
    expect(techPrereqFail.reason).toBe('TECH_LOCKED');

    // Unlock asphalt_roads first
    const techSuccess = sim.executeCommand({
      type: 'UNLOCK_TECH',
      payload: { techId: 'asphalt_roads' },
    });
    expect(techSuccess.success).toBe(true);
    expect(sim.getState().unlockedUpgrades).toContain('asphalt_roads');
  });

  it('5. Canonical SET_TAX schema and rate bounds', () => {
    const sim = new AuthoritativeSimulation(createMockInitialState(5000));

    sim.executeCommand({
      type: 'SET_TAX',
      payload: { residential: 12, commercial: 15, industrial: 8 },
    });
    expect(sim.getState().residentialTaxRate).toBe(12);
    expect(sim.getState().commercialTaxRate).toBe(15);
    expect(sim.getState().industrialTaxRate).toBe(8);

    // Clamping checks
    sim.executeCommand({
      type: 'SET_TAX',
      payload: { residential: -5, commercial: 35, industrial: 10 },
    });
    expect(sim.getState().residentialTaxRate).toBe(1);
    expect(sim.getState().commercialTaxRate).toBe(20);
    expect(sim.getState().industrialTaxRate).toBe(10);
  });

  it('6. Dirty Chunk Lifecycle: no persistent "all" and correct chunk clearing', () => {
    const chunkManager = new ChunkManager(60, 60);
    chunkManager.setRegionUnlocked(1, 1, true);

    chunkManager.markRoadDirty(25, 25);
    chunkManager.markBuildingDirty(26, 26);

    const dirty1 = chunkManager.consumeDirtyChunks();
    expect(dirty1.roads).toContain('2,2');
    expect(dirty1.buildings).toContain('2,2');
    expect(dirty1.terrain).toHaveLength(0);

    // After consume, subsequent read must be empty (no sticky 'all')
    const dirty2 = chunkManager.consumeDirtyChunks();
    expect(dirty2.roads).toHaveLength(0);
    expect(dirty2.buildings).toHaveLength(0);
    expect(dirty2.terrain).toHaveLength(0);
  });

  it('7. LOAD_STATE and New Game synchronization', () => {
    const sim = new AuthoritativeSimulation(createMockInitialState(10000));
    
    // Create new custom state with populated grid
    const freshState = createMockInitialState(25000);
    freshState.grid[25][24].type = TileType.ROAD;
    freshState.grid[25][25].type = TileType.COMMERCIAL;
    freshState.grid[25][25].level = 2;

    const loadRes = sim.executeCommand({
      type: 'LOAD_STATE',
      payload: freshState,
    });

    expect(loadRes.success).toBe(true);
    expect(loadRes.fullState).toBeDefined();
    expect(sim.getState().money).toBe(25000);
    expect(sim.getGrid()[25][25].type).toBe(TileType.COMMERCIAL);
    expect(sim.getState().buildings?.['25,25']).toBeDefined();
    expect(sim.getState().buildings?.['25,25'].level).toBe(2);
  });
});
