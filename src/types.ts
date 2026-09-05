import { GAME_CONFIG } from './config';

export enum TileType {
  EMPTY = 0,
  ROAD = 1,
  RESIDENTIAL = 2,
  COMMERCIAL = 3,
  INDUSTRIAL = 4,
  POWER_PLANT = 5,
  WATER_PUMP = 6,
  FIRE_STATION = 7,
  POLICE_STATION = 8,
  CLINIC = 9,
  SCHOOL = 10,
  WASTE_MANAGEMENT = 11,
  PARK = 12,
}

export type OverlayMode = 'NONE' | 'TRAFFIC' | 'POWER' | 'WATER' | 'LAND_VALUE' | 'POLLUTION' | 'CRIME' | 'EDUCATION' | 'HAPPINESS' | 'NOISE' | 'HEALTH' | 'WASTE' | 'FIRE' | 'POLICE' | 'NATURAL_RESOURCES';

export interface TileData {
  type: TileType;
  x: number;
  y: number;
  level: number;       // Level 1 to 5
  population: number; 
  jobs: number; 
  traffic: number;
  powered: boolean;
  watered: boolean;
  productivity: number; // 0 to 100
  abandoned: boolean;   // if utilities or road access is missing for a long time
  
  // Service coverage indicators
  fireCovered?: boolean;
  policeCovered?: boolean;
  healthCovered?: boolean;
  schoolCovered?: boolean;
  wasteCovered?: boolean;

  // Phase 6 Depth Simulation Fields
  landValue?: number;       // 0 to 100
  pollution?: number;       // 0 to 100
  noise?: number;           // 0 to 100
  crime?: number;           // 0 to 100
  health?: number;          // 0 to 100
  education?: number;       // 0 to 100
  upgradeProgress?: number; // 0 to 100 progress counter to level up

  // Phase 12 Terrain & Map Expansion System
  elevation?: number;       // Elevation level (0 to 10)
  resource?: 'none' | 'fertile' | 'ore' | 'oil' | 'forest'; // Natural resource
  water?: boolean;          // If this is a water body tile
}

export interface HistoryRecord {
  day: number;
  money: number;
  income: number;
  expenses: number;
  population: number;
}

export interface CityState {
  grid: TileData[][];
  money: number;
  population: number;
  day: number;
  powerCapacity: number;
  powerDemand: number;
  waterCapacity: number;
  waterDemand: number;
  trafficAverage: number;
  income: number;
  expenses: number;
  unlockedUpgrades: string[];

  // Simulation Engine Global Stats
  households: number;          
  workers: number;             
  employment: number;          
  unemploymentRate: number;    
  availableJobs: number;       
  residentialDemand: number;   
  commercialDemand: number;    
  industrialDemand: number;    
  desirability: number;        
  averageCommuteTime: number;  // Traffic 2.0 commute metric in minutes/ticks
  congestionIndex: number;     // Traffic 2.0 network congestion ratio (%)        

  // Economy & Tax System 3.0
  residentialTaxRate: number;  // 1% to 20% (default 9%)
  commercialTaxRate: number;   // 1% to 20% (default 9%)
  industrialTaxRate: number;   // 1% to 20% (default 9%)
  history: HistoryRecord[];    // last 10 ticks history

  // Phase 5 City Services & Utilities 2.0
  happiness: number;           // 0 to 100% composite score
  healthcareCoverage: number;  // 0 to 100%
  educationCoverage: number;   // 0 to 100%
  fireSafety: number;          // 0 to 100%
  crimeRate: number;           // 0 to 100% (lower is better)
  wasteCapacity: number;       // total waste processing capacity
  wasteProduction: number;     // total waste produced
  wasteCoverage: number;       // 0 to 100%

  // Phase 9 Progression, Events, Policies, and Missions
  milestoneLevel: number;      // 0 to 5
  activePolicies: string[];    // policy IDs
  activeEvents: any[];         // ActiveEvent[]
  completedMissions: string[]; // Mission IDs
  unlockedAchievements: string[]; // Achievement IDs

  // Phase 6 Depth & Evolution Metrics
  landValueAverage: number;    // 0 to 100
  pollutionAverage: number;    // 0 to 100
  noiseAverage: number;        // 0 to 100
  educationLevel: number;      // 0 to 100
  healthIndex: number;         // 0 to 100
  buildingLevelCounts: {
    residential: number[];     // [L1, L2, L3, L4, L5]
    commercial: number[];      // [L1, L2, L3, L4, L5]
    industrial: number[];      // [L1, L2, L3, L4, L5]
  };
  seed?: number;               // LCG seed for deterministic simulation

  // Phase 12 Large World Expansion Systems
  unlockedRegions?: string[];  // e.g. ["1,1"]
  mapSeed?: number;            // Terrain generation seed
  mapPreset?: string;          // e.g. "river_valley"
}

export const BUILD_COSTS: Record<TileType, number> = {
  [TileType.EMPTY]: GAME_CONFIG.BUILD_COSTS.EMPTY,
  [TileType.ROAD]: GAME_CONFIG.BUILD_COSTS.ROAD,
  [TileType.RESIDENTIAL]: GAME_CONFIG.BUILD_COSTS.RESIDENTIAL,
  [TileType.COMMERCIAL]: GAME_CONFIG.BUILD_COSTS.COMMERCIAL,
  [TileType.INDUSTRIAL]: GAME_CONFIG.BUILD_COSTS.INDUSTRIAL,
  [TileType.POWER_PLANT]: GAME_CONFIG.BUILD_COSTS.POWER_PLANT,
  [TileType.WATER_PUMP]: GAME_CONFIG.BUILD_COSTS.WATER_PUMP,
  [TileType.FIRE_STATION]: GAME_CONFIG.BUILD_COSTS.FIRE_STATION,
  [TileType.POLICE_STATION]: GAME_CONFIG.BUILD_COSTS.POLICE_STATION,
  [TileType.CLINIC]: GAME_CONFIG.BUILD_COSTS.CLINIC,
  [TileType.SCHOOL]: GAME_CONFIG.BUILD_COSTS.SCHOOL,
  [TileType.WASTE_MANAGEMENT]: GAME_CONFIG.BUILD_COSTS.WASTE_MANAGEMENT,
  [TileType.PARK]: GAME_CONFIG.BUILD_COSTS.PARK,
};

export const MAINTENANCE_COSTS: Record<TileType, number> = {
  [TileType.EMPTY]: GAME_CONFIG.MAINTENANCE_COSTS.EMPTY,
  [TileType.ROAD]: GAME_CONFIG.MAINTENANCE_COSTS.ROAD,
  [TileType.RESIDENTIAL]: GAME_CONFIG.MAINTENANCE_COSTS.RESIDENTIAL,
  [TileType.COMMERCIAL]: GAME_CONFIG.MAINTENANCE_COSTS.COMMERCIAL,
  [TileType.INDUSTRIAL]: GAME_CONFIG.MAINTENANCE_COSTS.INDUSTRIAL,
  [TileType.POWER_PLANT]: GAME_CONFIG.MAINTENANCE_COSTS.POWER_PLANT,
  [TileType.WATER_PUMP]: GAME_CONFIG.MAINTENANCE_COSTS.WATER_PUMP,
  [TileType.FIRE_STATION]: GAME_CONFIG.MAINTENANCE_COSTS.FIRE_STATION,
  [TileType.POLICE_STATION]: GAME_CONFIG.MAINTENANCE_COSTS.POLICE_STATION,
  [TileType.CLINIC]: GAME_CONFIG.MAINTENANCE_COSTS.CLINIC,
  [TileType.SCHOOL]: GAME_CONFIG.MAINTENANCE_COSTS.SCHOOL,
  [TileType.WASTE_MANAGEMENT]: GAME_CONFIG.MAINTENANCE_COSTS.WASTE_MANAGEMENT,
  [TileType.PARK]: GAME_CONFIG.MAINTENANCE_COSTS.PARK,
};
