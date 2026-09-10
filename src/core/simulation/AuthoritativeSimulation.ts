import {
  CityState,
  TileData,
  TileType,
  WorldRevisions,
  SimulationCommand,
  SimulationTickDelta,
  CompactTileUpdate,
  BUILD_COSTS,
  SimulationCommandResult,
} from '../../types';
import { ChunkManager, CHUNK_SIZE } from './ChunkManager';
import { SimulationEngine, mulberry32 } from './SimulationEngine';
import { SimulatedVehicle, SimulatedPedestrian } from '../../types';
import { GAME_CONFIG } from '../../config';
import { MISSIONS, TECH_NODES } from '../../progression';

export class AuthoritativeSimulation {
  private state: CityState;
  private engine: SimulationEngine;
  private chunkManager: ChunkManager;
  private revisions: WorldRevisions;
  private vehicles: SimulatedVehicle[] = [];
  private pedestrians: SimulatedPedestrian[] = [];
  private stateVersion: number = 0;
  private commandCounter: number = 0;

  constructor(initialState: CityState) {
    this.state = initialState;
    this.engine = new SimulationEngine();
    const width = initialState.grid[0]?.length || 60;
    const height = initialState.grid.length || 60;
    this.chunkManager = new ChunkManager(width, height);
    this.chunkManager.initFromGrid(initialState.grid, initialState.unlockedRegions);

    this.revisions = {
      terrainRevision: 1,
      roadRevision: 1,
      buildingRevision: 1,
      vehicleRevision: 1,
      pedestrianRevision: 1,
      simulationStatsRevision: 1,
    };
  }

  public getState(): CityState {
    return this.state;
  }

  public getRevisions(): WorldRevisions {
    return { ...this.revisions };
  }

  public getGrid(): TileData[][] {
    return this.state.grid;
  }

  public getVehicles(): SimulatedVehicle[] {
    return this.vehicles;
  }

  public getPedestrians(): SimulatedPedestrian[] {
    return this.pedestrians;
  }
  
  public getStateVersion(): number {
    return this.stateVersion;
  }

  /**
   * Process incoming command incrementally without cloning the full grid
   */
  public executeCommand(cmd: SimulationCommand): SimulationCommandResult {
    this.commandCounter++;
    const currentCommandId = this.commandCounter;
    const grid = this.state.grid;
    const height = grid.length;
    const width = grid[0]?.length || 0;
    const changedTiles: CompactTileUpdate[] = [];

    const fail = (reason: any): SimulationCommandResult => ({
      type: 'COMMAND_RESULT',
      commandId: currentCommandId,
      commandType: cmd.type,
      success: false,
      reason,
      stateVersion: this.stateVersion,
    });

    switch (cmd.type) {
      case 'BUILD_ROAD': {
        const { tiles } = cmd.payload as { tiles: [number, number][] };
        const roadCost = BUILD_COSTS[TileType.ROAD] || 10;
        
        let validTiles = 0;
        for (const [x, y] of tiles) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
             if (grid[y][x].type !== TileType.ROAD && !grid[y][x].water) {
                 validTiles++;
             }
          }
        }
        
        const totalCost = validTiles * roadCost;
        if (totalCost > 0 && this.state.money < totalCost) {
           return fail('INSUFFICIENT_FUNDS');
        }

        let cost = 0;
        let roadsChanged = false;

        for (const [x, y] of tiles) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const tile = grid[y][x];
            if (tile.type !== TileType.ROAD && !tile.water) {
              tile.type = TileType.ROAD;
              tile.level = 1;
              tile.abandoned = false;
              tile.population = 0;
              tile.jobs = 0;
              this.chunkManager.markRoadDirty(x, y);
              cost += roadCost;
              roadsChanged = true;
              changedTiles.push({
                x,
                y,
                type: TileType.ROAD,
                level: 1,
                abandoned: false,
                population: 0,
                jobs: 0,
              });
            }
          }
        }

        if (roadsChanged) {
          this.revisions.roadRevision++;
          this.revisions.simulationStatsRevision++;
          this.state.money -= cost;
          this.stateVersion++;
        }
        break;
      }

      case 'BUILD_ZONE': {
        const { tiles, type } = cmd.payload as { tiles: [number, number][]; type: TileType };
        const zoneCost = BUILD_COSTS[type] || 50;
        
        let validTiles = 0;
        for (const [x, y] of tiles) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
             if (grid[y][x].type !== type && !grid[y][x].water && grid[y][x].type !== TileType.ROAD) {
                 validTiles++;
             }
          }
        }
        
        const totalCost = validTiles * zoneCost;
        if (totalCost > 0 && this.state.money < totalCost) {
           return fail('INSUFFICIENT_FUNDS');
        }

        let cost = 0;
        let buildingsChanged = false;

        for (const [x, y] of tiles) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const tile = grid[y][x];
            if (tile.type !== type && !tile.water && tile.type !== TileType.ROAD) {
              tile.type = type;
              tile.level = 1;
              tile.abandoned = false;
              tile.population = 0;
              tile.jobs = 0;
              tile.traffic = 0;
              tile.powered = false;
              tile.watered = false;
              this.chunkManager.markBuildingDirty(x, y);
              cost += zoneCost;
              buildingsChanged = true;
              changedTiles.push({
                x,
                y,
                type,
                level: 1,
                abandoned: false,
                population: 0,
                jobs: 0,
                traffic: 0,
                powered: false,
                watered: false,
              });
            }
          }
        }

        if (buildingsChanged) {
          this.revisions.buildingRevision++;
          this.revisions.simulationStatsRevision++;
          this.state.money -= cost;
          this.stateVersion++;
        }
        break;
      }

      case 'BULLDOZE': {
        const { tiles } = cmd.payload as { tiles: [number, number][] };
        let roadDirty = false;
        let buildingDirty = false;
        let changed = false;

        for (const [x, y] of tiles) {
          if (x >= 0 && x < width && y >= 0 && y < height) {
            const tile = grid[y][x];
            if (tile.type !== TileType.EMPTY) {
              if (tile.type === TileType.ROAD) {
                roadDirty = true;
                this.chunkManager.markRoadDirty(x, y);
              } else {
                buildingDirty = true;
                this.chunkManager.markBuildingDirty(x, y);
              }

              tile.type = TileType.EMPTY;
              tile.level = 1;
              tile.population = 0;
              tile.jobs = 0;
              tile.traffic = 0;
              tile.powered = false;
              tile.watered = false;
              tile.abandoned = false;
              changed = true;

              changedTiles.push({
                x,
                y,
                type: TileType.EMPTY,
                level: 1,
                population: 0,
                jobs: 0,
                traffic: 0,
                powered: false,
                watered: false,
                abandoned: false,
              });
            }
          }
        }

        if (changed) {
          if (roadDirty) this.revisions.roadRevision++;
          if (buildingDirty) this.revisions.buildingRevision++;
          this.revisions.simulationStatsRevision++;
          this.stateVersion++;
        }
        break;
      }

      case 'TERRAFORM': {
        const { tiles, tool, centerElevation } = cmd.payload as {
          tiles: [number, number][];
          tool: 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
          centerElevation?: number;
        };
        
        let validTiles = 0;
        for (const [tx, ty] of tiles) {
            if (tx >= 0 && tx < width && ty >= 0 && ty < height) validTiles++;
        }
        
        const totalCost = validTiles * 15;
        if (totalCost > 0 && this.state.money < totalCost) {
            return fail('INSUFFICIENT_FUNDS');
        }

        const cost = validTiles * 15;
        let terrainChanged = false;

        for (const [tx, ty] of tiles) {
          if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
            const tile = grid[ty][tx];
            const oldEl = tile.elevation || 0;
            const oldWater = tile.water;
            const oldType = tile.type; // Save old type to handle ghost objects properly!

            if (tool === 'RAISE_TERRAIN') {
              tile.elevation = Math.min(10, oldEl + 1);
              if (tile.elevation > 0) tile.water = false;
            } else if (tool === 'LOWER_TERRAIN') {
              tile.elevation = Math.max(0, oldEl - 1);
              if (tile.elevation === 0) {
                tile.water = true;
                tile.type = TileType.EMPTY;
              }
            } else if (tool === 'LEVEL_TERRAIN') {
              tile.elevation = centerElevation ?? oldEl;
              if (tile.elevation === 0) {
                tile.water = true;
                tile.type = TileType.EMPTY;
              } else {
                tile.water = false;
              }
            } else if (tool === 'SMOOTH_TERRAIN') {
              let sum = oldEl;
              let count = 1;
              const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
              for (const [dx, dy] of dirs) {
                const nx = tx + dx;
                const ny = ty + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  sum += grid[ny][nx].elevation || 0;
                  count++;
                }
              }
              tile.elevation = Math.round(sum / count);
              if (tile.elevation === 0) {
                tile.water = true;
                tile.type = TileType.EMPTY;
              }
            }

            if (tile.elevation !== oldEl || tile.water !== oldWater) {
              terrainChanged = true;
              this.chunkManager.markTerrainDirty(tx, ty, true);

              // Sync roads & buildings with terraforming elevation & water status.
              // If it turned into water, clear it.
              if (tile.water && oldType !== TileType.EMPTY) {
                  tile.type = TileType.EMPTY;
                  if (oldType === TileType.ROAD) {
                      this.chunkManager.markRoadDirty(tx, ty);
                      this.revisions.roadRevision++;
                  } else {
                      this.chunkManager.markBuildingDirty(tx, ty);
                      this.revisions.buildingRevision++;
                  }
              }

              changedTiles.push({
                x: tx,
                y: ty,
                elevation: tile.elevation,
                water: tile.water,
                type: tile.type,
              });
            }
          }
        }

        if (terrainChanged) {
          this.revisions.terrainRevision++;
          this.revisions.simulationStatsRevision++;
          this.state.money -= cost;
          this.stateVersion++;
        }
        break;
      }

      case 'SET_TAX': {
        const payload = cmd.payload as any;
        if (payload.zoneType && typeof payload.rate === 'number') {
          if (payload.zoneType === 'residential') this.state.residentialTaxRate = payload.rate;
          if (payload.zoneType === 'commercial') this.state.commercialTaxRate = payload.rate;
          if (payload.zoneType === 'industrial') this.state.industrialTaxRate = payload.rate;
        } else {
          const { res, com, ind, residential, commercial, industrial } = payload;
          if (res !== undefined) this.state.residentialTaxRate = res;
          if (com !== undefined) this.state.commercialTaxRate = com;
          if (ind !== undefined) this.state.industrialTaxRate = ind;
          if (residential !== undefined) this.state.residentialTaxRate = residential;
          if (commercial !== undefined) this.state.commercialTaxRate = commercial;
          if (industrial !== undefined) this.state.industrialTaxRate = industrial;
        }
        this.revisions.simulationStatsRevision++;
        this.stateVersion++;
        break;
      }

      case 'SET_POLICY': {
        const { policyId, active } = cmd.payload as { policyId: string; active: boolean };
        const current = this.state.activePolicies || [];
        if (active && !current.includes(policyId)) {
          this.state.activePolicies = [...current, policyId];
          this.revisions.simulationStatsRevision++;
          this.stateVersion++;
        } else if (!active && current.includes(policyId)) {
          this.state.activePolicies = current.filter((p) => p !== policyId);
          this.revisions.simulationStatsRevision++;
          this.stateVersion++;
        }
        break;
      }

      case 'UNLOCK_REGION': {
        const { rx, ry } = cmd.payload as { rx: number; ry: number };
        const cost = GAME_CONFIG.REGION_UNLOCK_COST;
        const regKey = `${rx},${ry}`;
        const unlocked = this.state.unlockedRegions || [];
        if (unlocked.includes(regKey)) {
            return fail('ALREADY_UNLOCKED');
        }
        if (this.state.money < cost) {
            return fail('INSUFFICIENT_FUNDS');
        }
        this.state.money -= cost;
        this.state.unlockedRegions = [...unlocked, regKey];
        this.chunkManager.setRegionUnlocked(rx, ry, true);
        this.revisions.terrainRevision++;
        this.revisions.simulationStatsRevision++;
        this.stateVersion++;
        break;
      }

      case 'CLAIM_REWARD': {
        const { missionId } = cmd.payload as { missionId: string };
        const completed = this.state.completedMissions || [];
        if (completed.includes(missionId)) {
            return fail('ALREADY_UNLOCKED');
        }
        
        const mission = MISSIONS.find(m => m.id === missionId);
        if (!mission) {
            return fail('INVALID_COMMAND');
        }
        
        if (!mission.check(this.state)) {
            return fail('MISSION_NOT_COMPLETED');
        }

        this.state.completedMissions = [...completed, missionId];
        this.state.money += mission.rewardMoney;
        this.revisions.simulationStatsRevision++;
        this.stateVersion++;
        break;
      }

      case 'UNLOCK_TECH': {
        const { techId } = cmd.payload as { techId: string };
        const current = this.state.unlockedUpgrades || [];
        if (current.includes(techId)) {
            return fail('ALREADY_UNLOCKED');
        }
        
        const tech = TECH_NODES.find(t => t.id === techId);
        if (!tech) {
            return fail('INVALID_COMMAND');
        }
        
        if (this.state.money < tech.cost) {
            return fail('INSUFFICIENT_FUNDS');
        }

        this.state.unlockedUpgrades = [...current, techId];
        this.state.money -= tech.cost;
        this.revisions.simulationStatsRevision++;
        this.stateVersion++;
        break;
      }

      case 'LOAD_STATE': {
        this.state = cmd.payload as CityState;
        this.chunkManager.initFromGrid(this.state.grid, this.state.unlockedRegions);
        this.revisions.terrainRevision++;
        this.revisions.roadRevision++;
        this.revisions.buildingRevision++;
        this.revisions.vehicleRevision++;
        this.revisions.pedestrianRevision++;
        this.revisions.simulationStatsRevision++;
        this.vehicles = [];
        this.pedestrians = [];
        this.stateVersion++;
        break;
      }
    }

    const dirty = this.chunkManager.consumeDirtyChunks();
    const { grid: _omitGrid, ...statsDelta } = this.state;
    return {
      type: 'COMMAND_RESULT',
      commandId: currentCommandId,
      commandType: cmd.type,
      success: true,
      stateVersion: this.stateVersion,
      stats: statsDelta,
      revisions: { ...this.revisions },
      dirtyTerrain: cmd.type === 'LOAD_STATE' ? ['all'] : dirty.terrain,
      dirtyRoads: cmd.type === 'LOAD_STATE' ? ['all'] : dirty.roads,
      dirtyBuildings: cmd.type === 'LOAD_STATE' ? ['all'] : dirty.buildings,
      changedTiles: cmd.type === 'LOAD_STATE' ? [] : changedTiles,
    };
  }

  /**
   * Run an incremental simulation tick on the authoritative grid without full-grid cloning!
   */
  public stepTick(): SimulationTickDelta {
    const t0 = performance.now();
    const grid = this.state.grid;
    const height = grid.length;
    const width = grid[0]?.length || 0;

    // Snapshot buildings state before tick to detect building evolution / abandonment
    const buildingPrevState = new Map<string, { level: number; abandoned: boolean; powered: boolean; watered: boolean }>();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD) {
          buildingPrevState.set(`${x},${y}`, {
            level: tile.level || 1,
            abandoned: !!tile.abandoned,
            powered: !!tile.powered,
            watered: !!tile.watered,
          });
        }
      }
    }

    // Run simulation tick using authoritative engine directly on existing grid
    const nextState = this.engine.simulateTickInPlace(this.state);
    this.state = nextState;

    // Detect tiles that changed during simulation
    const changedTiles: CompactTileUpdate[] = [];
    let buildingChanged = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = this.state.grid[y][x];
        const key = `${x},${y}`;
        const prevB = buildingPrevState.get(key);

        if (prevB) {
          // Check if building evolved level or abandonment status
          if (prevB.level !== (tile.level || 1) || prevB.abandoned !== !!tile.abandoned) {
            buildingChanged = true;
            this.chunkManager.markBuildingDirty(x, y);
            changedTiles.push({
              x,
              y,
              type: tile.type,
              level: tile.level,
              abandoned: tile.abandoned,
              powered: tile.powered,
              watered: tile.watered,
              population: tile.population,
              jobs: tile.jobs,
            });
          } else if (prevB.powered !== !!tile.powered || prevB.watered !== !!tile.watered) {
            changedTiles.push({
              x,
              y,
              powered: tile.powered,
              watered: tile.watered,
              population: tile.population,
              jobs: tile.jobs,
            });
          }
        }
      }
    }

    if (buildingChanged) {
      this.revisions.buildingRevision++;
    }

    // Simulation stats increment every tick
    this.revisions.simulationStatsRevision++;

    // Generate dynamic agents
    this.generateAgents();
    this.revisions.vehicleRevision++;
    this.revisions.pedestrianRevision++;
    
    this.stateVersion++;

    const dirty = this.chunkManager.consumeDirtyChunks();
    const t1 = performance.now();
    const durationMs = t1 - t0;

    // Compact stats delta (omit grid from stats payload to keep worker messages tiny!)
    const { grid: _omitGrid, ...statsDelta } = this.state;

    // Estimate payload size in bytes
    const estimatedSizeBytes = JSON.stringify(statsDelta).length + JSON.stringify(changedTiles).length + (this.vehicles.length * 40);

    return {
      type: 'TICK_DELTA',
      stats: statsDelta,
      changedTiles,
      dirtyTerrainChunkKeys: dirty.terrain,
      dirtyRoadChunkKeys: dirty.roads,
      dirtyBuildingChunkKeys: dirty.buildings,
      revisions: { ...this.revisions },
      vehicles: this.vehicles,
      pedestrians: this.pedestrians,
      durationMs,
      payloadSizeBytes: estimatedSizeBytes,
      changedChunksCount: dirty.terrain.length + dirty.roads.length + dirty.buildings.length,
      stateVersion: this.stateVersion,
    };
  }

  /**
   * Generate vehicle and pedestrian paths for traffic rendering
   */
  private generateAgents(): void {
    const grid = this.state.grid;
    const height = grid.length;
    const width = grid[0]?.length || 0;

    const roadTiles: [number, number][] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].type === TileType.ROAD) {
          roadTiles.push([x, y]);
        }
      }
    }

    if (roadTiles.length < 2) {
      this.vehicles = [];
      this.pedestrians = [];
      return;
    }

    // Target a sensible vehicle count based on employment and road network size
    const targetVehicles = Math.min(60, Math.max(4, Math.floor(roadTiles.length * 0.3)));
    const vehicles: SimulatedVehicle[] = [];

    for (let i = 0; i < targetVehicles; i++) {
      const startIdx = (i * 7) % roadTiles.length;
      const endIdx = (startIdx + 1 + Math.floor(roadTiles.length / 3)) % roadTiles.length;
      const [sx, sy] = roadTiles[startIdx];
      const [ex, ey] = roadTiles[endIdx];

      const midX = Math.floor((sx + ex) / 2);
      const midY = Math.floor((sy + ey) / 2);

      const elStart = (grid[sy]?.[sx]?.elevation || 0) * 0.45;
      const elMid = (grid[midY]?.[midX]?.elevation || 0) * 0.45;
      const elEnd = (grid[ey]?.[ex]?.elevation || 0) * 0.45;

      vehicles.push({
        id: i,
        type: i % 5 === 0 ? 'truck' : i % 8 === 0 ? 'bus' : 'car',
        path: [
          [sx, elStart, sy],
          [midX, elMid, midY],
          [ex, elEnd, ey],
        ],
        currentWaypointIndex: 0,
        progress: (i * 0.15 + (this.state.day % 100) * 0.05) % 1,
        speed: 0.8 + (i % 5) * 0.2,
        color: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ffffff'][i % 6],
        originKey: `${sx},${sy}`,
        destinationKey: `${ex},${ey}`,
        purpose: 'work',
      });
    }

    // Target pedestrians
    const targetPedestrians = Math.min(40, Math.floor(targetVehicles * 0.6));
    const pedestrians: SimulatedPedestrian[] = [];
    for (let i = 0; i < targetPedestrians; i++) {
      const idx = (i * 5) % roadTiles.length;
      const [rx, ry] = roadTiles[idx];
      pedestrians.push({
        id: i,
        startX: rx + 0.3,
        startZ: ry + 0.3,
        targetX: rx - 0.3,
        targetZ: ry - 0.3,
        progress: ((i * 0.2) + (this.state.day % 50) * 0.04) % 1,
        speed: 0.5 + (i % 3) * 0.15,
        color: '#f8fafc',
      });
    }

    this.vehicles = vehicles;
    this.pedestrians = pedestrians;
  }
}
