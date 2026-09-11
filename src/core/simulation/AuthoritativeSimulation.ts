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
  SetTaxPayload,
} from '../../types';
import { ChunkManager, CHUNK_SIZE } from './ChunkManager';
import { SimulationEngine, mulberry32 } from './SimulationEngine';
import { SimulatedVehicle, SimulatedPedestrian } from '../../types';
import { GAME_CONFIG } from '../../config';
import { MISSIONS, TECH_NODES, isBuildingUnlocked } from '../../progression';

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
    this.state = {
      ...initialState,
      serviceBudgets: initialState.serviceBudgets || { ...GAME_CONFIG.DEFAULT_SERVICE_BUDGETS },
      cityLoans: initialState.cityLoans || [],
      creditRating: initialState.creditRating || 'AAA',
      fiscalCrisis: initialState.fiscalCrisis || {
        isInCrisis: false,
        isCrisis: false,
        daysInCrisis: 0,
        severity: 0,
        consecutiveDeficitDays: 0,
        creditRating: 'AAA',
        borrowingLimit: 20000,
        strikingSectors: [],
      },
      consecutiveDeficitDays: initialState.consecutiveDeficitDays || 0,
      totalDebt: initialState.totalDebt || 0,
      borrowingCapacity: initialState.borrowingCapacity ?? 20000,
      dailyDebtService: initialState.dailyDebtService || 0,
      roadConditionAverage: initialState.roadConditionAverage ?? 100,
    };
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
    const unlocked = this.state.unlockedRegions || ['1,1'];

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
        
        const validPlacements: [number, number][] = [];
        for (const [x, y] of tiles) {
          if (x < 0 || x >= width || y < 0 || y >= height) {
            continue;
          }
          const regKey = `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
          if (!unlocked.includes(regKey)) {
            return fail('LOCKED_REGION');
          }
          const tile = grid[y][x];
          if (tile.water) {
            continue;
          }
          if (tile.type === TileType.ROAD) {
            continue;
          }
          if (tile.type !== TileType.EMPTY) {
            continue;
          }
          validPlacements.push([x, y]);
        }

        if (validPlacements.length === 0) {
          return fail('INVALID_TILE');
        }

        const totalCost = validPlacements.length * roadCost;
        if (this.state.money < totalCost) {
          return fail('INSUFFICIENT_FUNDS');
        }

        for (const [x, y] of validPlacements) {
          const tile = grid[y][x];
          tile.type = TileType.ROAD;
          tile.level = 1;
          tile.abandoned = false;
          tile.population = 0;
          tile.jobs = 0;
          tile.traffic = 0;
          tile.upgradeProgress = 0;
          this.chunkManager.markRoadDirty(x, y);
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

        this.revisions.roadRevision++;
        this.revisions.simulationStatsRevision++;
        this.state.money -= totalCost;
        this.stateVersion++;
        break;
      }

      case 'BUILD_ZONE': {
        const { tiles, type } = cmd.payload as { tiles: [number, number][]; type: TileType };
        const zoneCost = BUILD_COSTS[type] || 50;
        const milestoneLevel = this.state.milestoneLevel ?? 0;

        if (!isBuildingUnlocked(type, milestoneLevel)) {
          return fail('TECH_LOCKED');
        }

        const isRCI = (type === TileType.RESIDENTIAL || type === TileType.COMMERCIAL || type === TileType.INDUSTRIAL);
        const validPlacements: [number, number][] = [];

        for (const [x, y] of tiles) {
          if (x < 0 || x >= width || y < 0 || y >= height) {
            continue;
          }
          const regKey = `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
          if (!unlocked.includes(regKey)) {
            return fail('LOCKED_REGION');
          }
          const tile = grid[y][x];
          if (tile.water) {
            continue;
          }
          if (tile.type === type) {
            continue;
          }
          if (tile.type !== TileType.EMPTY) {
            continue;
          }

          if (isRCI) {
            let hasRoad = false;
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of dirs) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (grid[ny][nx].type === TileType.ROAD) {
                  hasRoad = true;
                  break;
                }
              }
            }
            if (!hasRoad) {
              continue;
            }
          }

          validPlacements.push([x, y]);
        }

        if (validPlacements.length === 0) {
          return fail('INVALID_TILE');
        }

        const totalCost = validPlacements.length * zoneCost;
        if (this.state.money < totalCost) {
          return fail('INSUFFICIENT_FUNDS');
        }

        if (!this.state.buildings) {
          this.state.buildings = {};
        }

        for (const [x, y] of validPlacements) {
          const tile = grid[y][x];
          tile.type = type;
          tile.level = 1;
          tile.abandoned = false;
          tile.population = 0;
          tile.jobs = 0;
          tile.traffic = 0;
          tile.powered = false;
          tile.watered = false;
          tile.upgradeProgress = 0;
          this.chunkManager.markBuildingDirty(x, y);

          const bId = `${x},${y}`;
          this.state.buildings[bId] = {
            id: bId,
            originX: x,
            originY: y,
            footprintW: 1,
            footprintL: 1,
            type,
            level: 1,
            population: 0,
            jobs: 0,
            powered: false,
            watered: false,
            abandoned: false,
            upgradeProgress: 0,
          };

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

        this.revisions.buildingRevision++;
        this.revisions.simulationStatsRevision++;
        this.state.money -= totalCost;
        this.stateVersion++;
        break;
      }

      case 'BULLDOZE': {
        const { tiles } = cmd.payload as { tiles: [number, number][] };
        let roadDirty = false;
        let buildingDirty = false;
        let changed = false;

        for (const [x, y] of tiles) {
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          const regKey = `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
          if (!unlocked.includes(regKey)) {
            return fail('LOCKED_REGION');
          }

          const tile = grid[y][x];
          if (tile.type !== TileType.EMPTY) {
            if (tile.type === TileType.ROAD) {
              roadDirty = true;
              this.chunkManager.markRoadDirty(x, y);
            } else {
              buildingDirty = true;
              this.chunkManager.markBuildingDirty(x, y);
            }

            const bId = `${x},${y}`;
            if (this.state.buildings && this.state.buildings[bId]) {
              delete this.state.buildings[bId];
            }

            tile.type = TileType.EMPTY;
            tile.level = 1;
            tile.population = 0;
            tile.jobs = 0;
            tile.traffic = 0;
            tile.powered = false;
            tile.watered = false;
            tile.abandoned = false;
            tile.upgradeProgress = 0;
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

        const validTiles: [number, number][] = [];
        for (const [tx, ty] of tiles) {
          if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
          const regKey = `${Math.floor(tx / 20)},${Math.floor(ty / 20)}`;
          if (!unlocked.includes(regKey)) {
            return fail('LOCKED_REGION');
          }
          validTiles.push([tx, ty]);
        }

        if (validTiles.length === 0) {
          return fail('INVALID_TILE');
        }

        const totalCost = validTiles.length * 15;
        if (this.state.money < totalCost) {
          return fail('INSUFFICIENT_FUNDS');
        }

        let terrainChanged = false;

        for (const [tx, ty] of validTiles) {
          const tile = grid[ty][tx];
          const oldEl = tile.elevation || 0;
          const oldWater = tile.water;
          const oldType = tile.type;

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

            if (tile.water && oldType !== TileType.EMPTY) {
              tile.type = TileType.EMPTY;
              const bId = `${tx},${ty}`;
              if (this.state.buildings && this.state.buildings[bId]) {
                delete this.state.buildings[bId];
              }
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

        if (terrainChanged) {
          this.revisions.terrainRevision++;
          this.revisions.simulationStatsRevision++;
          this.state.money -= totalCost;
          this.stateVersion++;
        }
        break;
      }

      case 'SET_TAX': {
        const payload = cmd.payload as SetTaxPayload;
        if (typeof payload?.residential === 'number') {
          this.state.residentialTaxRate = Math.max(1, Math.min(20, Math.round(payload.residential)));
        }
        if (typeof payload?.commercial === 'number') {
          this.state.commercialTaxRate = Math.max(1, Math.min(20, Math.round(payload.commercial)));
        }
        if (typeof payload?.industrial === 'number') {
          this.state.industrialTaxRate = Math.max(1, Math.min(20, Math.round(payload.industrial)));
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
        if (rx < 0 || rx >= 3 || ry < 0 || ry >= 3) {
          return fail('INVALID_COMMAND');
        }
        const cost = GAME_CONFIG.REGION_UNLOCK_COST;
        const regKey = `${rx},${ry}`;
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

      case 'SET_BUDGET': {
        const payload = cmd.payload as { sector: keyof import('../../types').ServiceBudgets; percentage: number };
        if (payload?.sector && typeof payload.percentage === 'number') {
          const currentBudgets = this.state.serviceBudgets || { ...GAME_CONFIG.DEFAULT_SERVICE_BUDGETS };
          this.state.serviceBudgets = {
            ...currentBudgets,
            [payload.sector]: Math.max(50, Math.min(150, Math.round(payload.percentage))),
          };
          this.revisions.simulationStatsRevision++;
          this.stateVersion++;
        }
        break;
      }

      case 'TAKE_LOAN': {
        const payload = cmd.payload as {
          presetId?: string;
          amount?: number;
          durationDays?: number;
          dailyInterestRate?: number;
        };

        let amount = payload.amount || 5000;
        let termDays = payload.durationDays || 30;
        let loanName = 'Municipal Bond';

        if (payload.presetId) {
          const preset = GAME_CONFIG.LOAN_PRESETS.find((p) => p.id === payload.presetId);
          if (preset) {
            amount = preset.amount;
            termDays = preset.termDays;
            loanName = preset.name;
          }
        }

        const rating = this.state.creditRating || 'AAA';
        const ratingConfig = GAME_CONFIG.CREDIT_RATINGS[rating as keyof typeof GAME_CONFIG.CREDIT_RATINGS] || GAME_CONFIG.CREDIT_RATINGS.AAA;
        const totalDebt = this.state.totalDebt || 0;
        const maxCapacity = Math.max(5000, (this.state.population || 0) * 40 + (this.state.income || 0) * 15) * ratingConfig.maxBorrowMultiplier;

        if (totalDebt + amount > maxCapacity && rating === 'D') {
          return fail('CREDIT_LIMIT_EXCEEDED');
        }

        const effectiveInterestRate = payload.dailyInterestRate || ratingConfig.dailyInterestRate;
        const totalInterest = amount * effectiveInterestRate * termDays;
        const dailyPayment = Math.ceil((amount + totalInterest) / termDays);

        const newLoan: import('../../types').CityLoan = {
          id: `loan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: loanName,
          principal: amount,
          initialAmount: amount,
          dailyInterestRate: effectiveInterestRate,
          remainingDays: termDays,
          dailyPayment,
        };

        this.state.cityLoans = [...(this.state.cityLoans || []), newLoan];
        this.state.money += amount;
        this.state.totalDebt = (this.state.totalDebt || 0) + amount;
        this.state.dailyDebtService = (this.state.dailyDebtService || 0) + dailyPayment;
        this.revisions.simulationStatsRevision++;
        this.stateVersion++;
        break;
      }

      case 'REPAY_LOAN': {
        const { loanId } = cmd.payload as { loanId: string };
        const currentLoans = this.state.cityLoans || [];
        const loanIndex = currentLoans.findIndex((l) => l.id === loanId);
        if (loanIndex === -1) {
          return fail('INVALID_COMMAND');
        }

        const loan = currentLoans[loanIndex];
        const payoffAmount = loan.principal;

        if (this.state.money < payoffAmount) {
          return fail('INSUFFICIENT_FUNDS');
        }

        this.state.money -= payoffAmount;
        this.state.cityLoans = currentLoans.filter((l) => l.id !== loanId);
        this.state.totalDebt = Math.max(0, (this.state.totalDebt || 0) - payoffAmount);
        this.state.dailyDebtService = Math.max(0, (this.state.dailyDebtService || 0) - loan.dailyPayment);
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

        if (tech.requiredMilestoneLevel > (this.state.milestoneLevel ?? 0)) {
          return fail('TECH_LOCKED');
        }

        if (tech.prerequisiteId && !current.includes(tech.prerequisiteId)) {
          return fail('TECH_LOCKED');
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
        const loaded = cmd.payload as CityState;
        this.state = {
          ...loaded,
          unlockedRegions: loaded.unlockedRegions || ['1,1'],
          unlockedUpgrades: loaded.unlockedUpgrades || [],
          activePolicies: loaded.activePolicies || [],
          completedMissions: loaded.completedMissions || [],
          unlockedAchievements: loaded.unlockedAchievements || [],
          buildings: loaded.buildings || {},
        };

        if (Object.keys(this.state.buildings).length === 0) {
          for (let y = 0; y < this.state.grid.length; y++) {
            for (let x = 0; x < this.state.grid[0].length; x++) {
              const tile = this.state.grid[y][x];
              if (tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD) {
                this.state.buildings[`${x},${y}`] = {
                  id: `${x},${y}`,
                  originX: x,
                  originY: y,
                  footprintW: 1,
                  footprintL: 1,
                  type: tile.type,
                  level: tile.level || 1,
                  population: tile.population || 0,
                  jobs: tile.jobs || 0,
                  powered: !!tile.powered,
                  watered: !!tile.watered,
                  abandoned: !!tile.abandoned,
                  upgradeProgress: tile.upgradeProgress || 0,
                };
              }
            }
          }
        }

        const w = this.state.grid[0]?.length || 60;
        const h = this.state.grid.length || 60;
        this.chunkManager = new ChunkManager(w, h);
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
      fullState: cmd.type === 'LOAD_STATE' ? this.state : undefined,
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

    // Snapshot buildings & roads state before tick to detect building evolution / abandonment / occupancy / traffic / logistics changes
    const buildingPrevState = new Map<string, {
      level: number;
      abandoned: boolean;
      powered: boolean;
      watered: boolean;
      population: number;
      jobs: number;
      traffic: number;
      productivity: number;
      goodsStock: number;
      logisticsSatisfaction: number;
    }>();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type !== TileType.EMPTY) {
          buildingPrevState.set(`${x},${y}`, {
            level: tile.level || 1,
            abandoned: !!tile.abandoned,
            powered: !!tile.powered,
            watered: !!tile.watered,
            population: tile.population || 0,
            jobs: tile.jobs || 0,
            traffic: tile.traffic || 0,
            productivity: tile.productivity ?? 100,
            goodsStock: tile.goodsStock ?? 100,
            logisticsSatisfaction: tile.logisticsSatisfaction ?? 100,
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
          const levelChanged = prevB.level !== (tile.level || 1);
          const abandonChanged = prevB.abandoned !== !!tile.abandoned;
          const powerChanged = prevB.powered !== !!tile.powered;
          const waterChanged = prevB.watered !== !!tile.watered;
          const popChanged = prevB.population !== (tile.population || 0);
          const jobsChanged = prevB.jobs !== (tile.jobs || 0);
          const trafficChanged = Math.abs(prevB.traffic - (tile.traffic || 0)) >= 1;
          const prodChanged = Math.abs(prevB.productivity - (tile.productivity ?? 100)) >= 2;
          const goodsChanged = Math.abs(prevB.goodsStock - (tile.goodsStock ?? 100)) >= 2;
          const logSatChanged = Math.abs(prevB.logisticsSatisfaction - (tile.logisticsSatisfaction ?? 100)) >= 2;

          if (levelChanged || abandonChanged) {
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
              traffic: tile.traffic,
              productivity: tile.productivity,
              goodsStock: tile.goodsStock,
              logisticsSatisfaction: tile.logisticsSatisfaction,
              commuteTime: tile.commuteTime,
            });
          } else if (
            powerChanged ||
            waterChanged ||
            popChanged ||
            jobsChanged ||
            trafficChanged ||
            prodChanged ||
            goodsChanged ||
            logSatChanged
          ) {
            changedTiles.push({
              x,
              y,
              powered: tile.powered,
              watered: tile.watered,
              population: tile.population,
              jobs: tile.jobs,
              traffic: tile.traffic,
              productivity: tile.productivity,
              goodsStock: tile.goodsStock,
              logisticsSatisfaction: tile.logisticsSatisfaction,
              commuteTime: tile.commuteTime,
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
    const trafficResult = this.engine.getLastTrafficResult();
    if (trafficResult && trafficResult.activeVehicles && trafficResult.activeVehicles.length > 0) {
      this.vehicles = trafficResult.activeVehicles;
      this.pedestrians = trafficResult.activePedestrians || [];
      return;
    }

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
