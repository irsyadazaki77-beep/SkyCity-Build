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

export type OverlayMode =
  | 'NONE'
  | 'TRAFFIC'
  | 'POWER'
  | 'WATER'
  | 'LAND_VALUE'
  | 'POLLUTION'
  | 'CRIME'
  | 'EDUCATION'
  | 'HAPPINESS'
  | 'NOISE'
  | 'HEALTH'
  | 'WASTE'
  | 'FIRE'
  | 'POLICE'
  | 'NATURAL_RESOURCES'
  | 'TRANSIT';

export type EventType =
  | 'boom'
  | 'recession'
  | 'heatwave'
  | 'power_shortage'
  | 'epidemic'
  | 'festival'
  | 'tech_inflow';

export interface ActiveEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  remainingDays: number;
}

import { BuildingEntity } from './core/simulation/entities/BuildingEntity';

export interface TileData {
  type: TileType;
  x: number;
  y: number;
  
  // Building Entity Reference (Incremental Migration)
  buildingId?: string; 
  
  // These are legacy fields, slowly being migrated to BuildingEntity
  level?: number;       // Level 1 to 5
  population?: number; 
  jobs?: number; 
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

  // Depth Simulation Fields
  landValue?: number;       // 0 to 100
  pollution?: number;       // 0 to 100
  noise?: number;           // 0 to 100
  crime?: number;           // 0 to 100
  health?: number;          // 0 to 100
  education?: number;       // 0 to 100
  upgradeProgress?: number; // 0 to 100 progress counter to level up

  // Terrain & Map System
  elevation?: number;       // Elevation level (0 to 10)
  resource?: 'none' | 'fertile' | 'ore' | 'oil' | 'forest'; // Natural resource
  water?: boolean;          // If this is a water body tile
  slope?: number;           // Calculated gradient for rendering
  treeType?: number;        // Nature variation
}

export interface HistoryRecord {
  day: number;
  money: number;
  income: number;
  expenses: number;
  population: number;
}

// -------------------------------------------------------------
// Citizen & Demographic Simulation Types
// -------------------------------------------------------------
export type EducationTier = 'uneducated' | 'educated' | 'highly_educated';
export type IncomeClass = 'low' | 'middle' | 'high';
export type TransportPreference = 'car' | 'transit' | 'walking' | 'bicycle';

export interface CitizenAgent {
  id: string;
  name: string;
  age: number;               // 0 to 85
  householdId: string;
  education: EducationTier;
  income: IncomeClass;
  employed: boolean;
  workplaceKey: string | null; // e.g. "x,y" or null
  homeKey: string;             // "x,y"
  health: number;              // 0 to 100
  happiness: number;           // 0 to 100
  transportPreference: TransportPreference;
  commuteTime: number;         // Ticks/minutes
}

export interface Household {
  id: string;
  homeKey: string;
  members: string[]; // Citizen IDs
  wealth: number;
  rent: number;
}

export interface Company {
  id: string;
  zoneKey: string;
  type: 'commercial' | 'industrial' | 'office';
  level: number;
  workers: string[]; // Citizen IDs
  maxWorkers: number;
  productivity: number;
  revenue: number;
  rent: number;
}

// -------------------------------------------------------------
// Road Network & Lane Graph 2.0 Types
// -------------------------------------------------------------
export type RoadHierarchy = 'two_lane' | 'avenue' | 'highway' | 'one_way' | 'service' | 'pedestrian';

export interface SplineRoadNode {
  id: string;
  x: number;
  y: number;
  elevation: number;
  connectedSegmentIds: string[];
}

export interface SplineRoadSegment {
  id: string;
  startNodeId: string;
  endNodeId: string;
  type: RoadHierarchy;
  speedLimit: number;
  lanes: number;
  curveControlPoints?: [number, number, number][]; // Bezier control points
  length: number;
  isBridge?: boolean;
  isTunnel?: boolean;
}

export interface SimulatedVehicle {
  id: number;
  type: 'car' | 'bus' | 'truck' | 'police' | 'fire' | 'ambulance';
  path: [number, number, number][]; // 3D waypoints
  currentWaypointIndex: number;
  progress: number;
  speed: number;
  color: string;
  originKey: string;
  destinationKey: string;
  purpose: 'work' | 'shopping' | 'school' | 'service' | 'freight';
}

export interface SimulatedPedestrian {
  id: number;
  startX: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  progress: number;
  speed: number;
  color: string;
}

// -------------------------------------------------------------
// Graphic Settings & Benchmarks
// -------------------------------------------------------------
export type GraphicsQualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsSettings {
  tier: GraphicsQualityTier;
  shadows: boolean;
  vegetationDensity: number; // 0 to 1
  vehicleDensity: number;    // 0 to 1
  pedestrianDensity: number; // 0 to 1
  renderDistance: number;    // Chunk radius
  lodDistance: number;       // Distance to drop LOD
  postProcessing: boolean;
  pixelRatio: number;        // 1 or window.devicePixelRatio
  edgeScrolling: boolean;
}

export interface BenchmarkMetrics {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  simTickMs: number;
  buildingCount: number;
  roadNodeCount: number;
  activeVehicles: number;
  activePedestrians: number;
  chunkCount: number;
}

// -------------------------------------------------------------
// City State Architecture
// -------------------------------------------------------------
export interface CityState {
  grid: TileData[][];
  buildings?: Record<string, BuildingEntity>;
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
  cityLoans?: { principal: number; interestRate: number; remainingDays: number }[];

  // City Services & Utilities 2.0
  happiness: number;           // 0 to 100% composite score
  healthcareCoverage: number;  // 0 to 100%
  educationCoverage: number;   // 0 to 100%
  fireSafety: number;          // 0 to 100%
  crimeRate: number;           // 0 to 100% (lower is better)
  wasteCapacity: number;       // total waste processing capacity
  wasteProduction: number;     // total waste produced
  wasteCoverage: number;       // 0 to 100%

  // Public Transit System
  busStopsCount?: number;
  transitRidership?: number;
  transitCapacity?: number;

  // Progression, Events, Policies, and Missions
  milestoneLevel: number;      // 0 to 5
  activePolicies: string[];    // policy IDs
  activeEvents: ActiveEvent[];
  completedMissions: string[]; // Mission IDs
  unlockedAchievements: string[]; // Achievement IDs

  // Depth & Evolution Metrics
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

  // Large World Expansion Systems
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

// ==========================================
// Performance & Incremental Architecture Types
// ==========================================

export interface WorldRevisions {
  terrainRevision: number;
  roadRevision: number;
  buildingRevision: number;
  vehicleRevision: number;
  pedestrianRevision: number;
  simulationStatsRevision: number;
}

export interface CompactTileUpdate {
  x: number;
  y: number;
  type?: TileType;
  buildingId?: string;
  level?: number;
  elevation?: number;
  water?: boolean;
  powered?: boolean;
  watered?: boolean;
  population?: number;
  jobs?: number;
  abandoned?: boolean;
  traffic?: number;
  landValue?: number;
  pollution?: number;
  noise?: number;
  crime?: number;
}

export interface SetTaxPayload {
  residential: number;
  commercial: number;
  industrial: number;
}

export type SimulationCommand =
  | { type: 'BUILD_ROAD'; payload: { tiles: [number, number][] } }
  | { type: 'BUILD_ZONE'; payload: { tiles: [number, number][]; type: TileType } }
  | { type: 'BULLDOZE'; payload: { tiles: [number, number][] } }
  | { type: 'TERRAFORM'; payload: { tiles: [number, number][]; tool: 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN'; centerElevation?: number } }
  | { type: 'SET_TAX'; payload: SetTaxPayload }
  | { type: 'SET_POLICY'; payload: { policyId: string; active: boolean } }
  | { type: 'UNLOCK_REGION'; payload: { rx: number; ry: number } }
  | { type: 'UNLOCK_TECH'; payload: { techId: string } }
  | { type: 'LOAD_STATE'; payload: CityState }
  | { type: 'CHANGE_SPEED'; payload: { speed: number } }
  | { type: 'CLAIM_REWARD'; payload: { missionId: string } };

export type SimulationCommandType = SimulationCommand['type'];

export type CommandFailureReason = 
  | 'INSUFFICIENT_FUNDS' 
  | 'INVALID_TILE' 
  | 'LOCKED_REGION' 
  | 'TECH_LOCKED' 
  | 'INVALID_COMMAND'
  | 'ALREADY_UNLOCKED'
  | 'MISSION_NOT_COMPLETED'
  | 'UNKNOWN';

export interface SimulationCommandResult {
  type: 'COMMAND_RESULT';
  commandId: number;
  commandType: SimulationCommandType;
  success: boolean;
  reason?: CommandFailureReason;
  stateVersion: number;
  stats?: Partial<CityState>;
  fullState?: CityState;
  changedTiles?: CompactTileUpdate[];
  dirtyTerrain?: string[];
  dirtyRoads?: string[];
  dirtyBuildings?: string[];
  revisions?: WorldRevisions;
}

export interface SimulationTickDelta {
  type: 'TICK_DELTA';
  stateVersion: number;
  stats: Partial<CityState>;
  changedTiles: CompactTileUpdate[];
  changedBuildings?: BuildingEntity[];
  removedBuildings?: string[];
  dirtyTerrainChunkKeys: string[];
  dirtyRoadChunkKeys: string[];
  dirtyBuildingChunkKeys: string[];
  revisions: WorldRevisions;
  vehicles: SimulatedVehicle[];
  pedestrians: SimulatedPedestrian[];
  durationMs: number;
  payloadSizeBytes: number;
  changedChunksCount: number;
}

export interface EngineProfilerMetrics {
  terrainRebuildCount: number;
  roadRebuildCount: number;
  buildingBatchUpdateCount: number;
  workerMessageSize: number;
  changedChunksPerTick: number;
  simulationTickTime: number;
  renderFrameTime: number;
  drawCalls: number;
  triangles: number;
  visibleChunks: number;
  fps: number;
}


