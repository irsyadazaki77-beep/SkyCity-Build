import { describe, it, expect } from 'vitest';
import { TileType, CityState, SimulationCommand } from './types';
import { createEmptyGrid } from './core/simulation/SimulationEngine';
import { AuthoritativeSimulation } from './core/simulation/AuthoritativeSimulation';
import { ChunkManager } from './core/simulation/ChunkManager';
import { SaveManager } from './core/storage/SaveManager';

describe('SkyCity Comprehensive Core Audit Tests', () => {
  it('should support dynamic map dimensions other than 60x60 (e.g. 40x40)', () => {
    const grid = createEmptyGrid(40, 40);
    expect(grid.length).toBe(40);
    expect(grid[0].length).toBe(40);
  });

  it('should handle SET_TAX command authoritatively and synchronize tax rates', () => {
    const state: CityState = {
      grid: createEmptyGrid(60, 60),
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
      buildingLevelCounts: { residential: [0,0,0,0,0], commercial: [0,0,0,0,0], industrial: [0,0,0,0,0] }
    };

    const sim = new AuthoritativeSimulation(state);
    const cmd: SimulationCommand = {
      type: 'SET_TAX',
      payload: { zoneType: 'residential', rate: 12 }
    };

    const result = sim.executeCommand(cmd);
    expect(sim.getState().residentialTaxRate).toBe(12);
    expect(result.revisions.simulationStatsRevision).toBeGreaterThan(0);
  });

  it('should implement CLAIM_REWARD authoritatively and increment money', () => {
    const state: CityState = {
      grid: createEmptyGrid(60, 60),
      money: 5000,
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
      buildingLevelCounts: { residential: [0,0,0,0,0], commercial: [0,0,0,0,0], industrial: [0,0,0,0,0] }
    };

    const sim = new AuthoritativeSimulation(state);
    
    // Set population to 50 to satisfy m_pop_50
    sim.getState().population = 50;
    
    const cmd: SimulationCommand = {
      type: 'CLAIM_REWARD',
      payload: { missionId: 'm_pop_50'}
    };

    sim.executeCommand(cmd);
    expect(sim.getState().money).toBe(10000);
    expect(sim.getState().completedMissions).toContain('m_pop_50');

    // Claiming again should not add duplicate reward
    sim.executeCommand(cmd);
    expect(sim.getState().money).toBe(10000);
  });

  it('should deduct money and unlock region on UNLOCK_REGION if balance is sufficient', () => {
    const state: CityState = {
      grid: createEmptyGrid(60, 60),
      money: 20000,
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
      unlockedRegions: ['1,1'],
      buildingLevelCounts: { residential: [0,0,0,0,0], commercial: [0,0,0,0,0], industrial: [0,0,0,0,0] }
    };

    const sim = new AuthoritativeSimulation(state);
    const cmd: SimulationCommand = {
      type: 'UNLOCK_REGION',
      payload: { rx: 0, ry: 1}
    };

    sim.executeCommand(cmd);
    expect(sim.getState().money).toBe(5000);
    expect(sim.getState().unlockedRegions).toContain('0,1');
  });

  it('should reject UNLOCK_REGION if money is insufficient', () => {
    const state: CityState = {
      grid: createEmptyGrid(60, 60),
      money: 5000, // less than 15000 cost
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
      unlockedRegions: ['1,1'],
      buildingLevelCounts: { residential: [0,0,0,0,0], commercial: [0,0,0,0,0], industrial: [0,0,0,0,0] }
    };

    const sim = new AuthoritativeSimulation(state);
    const cmd: SimulationCommand = {
      type: 'UNLOCK_REGION',
      payload: { rx: 0, ry: 1}
    };

    sim.executeCommand(cmd);
    expect(sim.getState().money).toBe(5000);
    expect(sim.getState().unlockedRegions).not.toContain('0,1');
  });

  it('should manage chunk dirty lifecycle correctly in ChunkManager', () => {
    const grid = createEmptyGrid(60, 60);
    const manager = new ChunkManager(60, 60);
    manager.initFromGrid(grid, ['1,1']);

    const initialDirty = manager.consumeDirtyChunks();
    expect(initialDirty.terrain.length).toBeGreaterThan(0);

    // After consuming, dirty sets should be cleared
    const secondConsume = manager.consumeDirtyChunks();
    expect(secondConsume.terrain.length).toBe(0);

    // Marking tile dirty should populate dirty sets again
    manager.markTileDirty(10, 10, TileType.ROAD);
    const markedDirty = manager.consumeDirtyChunks();
    expect(markedDirty.roads.length).toBeGreaterThan(0);
  });

  it('should save and load game state persistently via SaveManager', async () => {
    const state: CityState = {
      grid: createEmptyGrid(60, 60),
      money: 45000,
      population: 150,
      day: 5,
      powerCapacity: 100,
      powerDemand: 50,
      waterCapacity: 100,
      waterDemand: 50,
      trafficAverage: 12,
      averageCommuteTime: 5,
      congestionIndex: 10,
      income: 1000,
      expenses: 400,
      unlockedUpgrades: [],
      households: 40,
      workers: 100,
      employment: 95,
      unemploymentRate: 5,
      availableJobs: 110,
      residentialDemand: 50,
      commercialDemand: 40,
      industrialDemand: 30,
      desirability: 70,
      residentialTaxRate: 9,
      commercialTaxRate: 9,
      industrialTaxRate: 9,
      history: [],
      happiness: 80,
      healthcareCoverage: 90,
      educationCoverage: 85,
      fireSafety: 95,
      crimeRate: 10,
      wasteCapacity: 500,
      wasteProduction: 50,
      wasteCoverage: 100,
      milestoneLevel: 1,
      activePolicies: [],
      activeEvents: [],
      completedMissions: [],
      unlockedAchievements: [],
      landValueAverage: 50,
      pollutionAverage: 10,
      noiseAverage: 15,
      educationLevel: 1,
      healthIndex: 85,
      buildingLevelCounts: { residential: [10,5,0,0,0], commercial: [8,2,0,0,0], industrial: [5,1,0,0,0] }
    };

    const slotId = 'test_slot_1';
    await SaveManager.saveGame(slotId, state, 'Test Metropolis');

    const loaded = await SaveManager.loadGame(slotId);
    expect(loaded).not.toBeNull();
    expect(loaded?.cityName).toBe('Test Metropolis');
    expect(loaded?.gameState.money).toBe(45000);
    expect(loaded?.gameState.population).toBe(150);

    await SaveManager.deleteSave(slotId);
    const afterDelete = await SaveManager.loadGame(slotId);
    expect(afterDelete).toBeNull();
  });
});
