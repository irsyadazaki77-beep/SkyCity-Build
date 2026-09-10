import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CityState,
  WorldRevisions,
  SimulationCommand,
  SimulationTickDelta,
  EngineProfilerMetrics,
  SimulatedVehicle,
  SimulatedPedestrian,
  TileType,
  SimulationCommandResult,
} from '../types';
import { AuthoritativeSimulation } from '../core/simulation/AuthoritativeSimulation';

export interface SimulationController {
  gameState: CityState;
  setGameState: React.Dispatch<React.SetStateAction<CityState>>;
  revisions: WorldRevisions;
  dirtyTerrainChunks: Set<string>;
  dirtyRoadChunks: Set<string>;
  dirtyBuildingChunks: Set<string>;
  activeVehicles: SimulatedVehicle[];
  activePedestrians: SimulatedPedestrian[];
  metrics: EngineProfilerMetrics;
  speed: number;
  setSpeed: (spd: number) => void;
  simulationTimeMs: number;
  triggerManualTick: () => void;
  dispatchCommand: (cmd: SimulationCommand) => Promise<SimulationCommandResult>;
  isWorkerActive: boolean;
  clearDirtyTerrainChunks: () => void;
  clearDirtyRoadChunks: () => void;
  clearDirtyBuildingChunks: () => void;
  incrementTerrainRebuildCount: (count?: number) => void;
  incrementRoadRebuildCount: (count?: number) => void;
  incrementBuildingBatchCount: (count?: number) => void;
  setVisibleChunksCount: (count: number) => void;
  setDrawCallsCount: (count: number) => void;
  setRenderFrameTime: (ms: number) => void;
}

export function useSimulationController(initialState: CityState): SimulationController {
  const [gameState, setGameState] = useState<CityState>(initialState);
  const [speed, setSpeed] = useState<number>(1);
  const [simulationTimeMs, setSimulationTimeMs] = useState<number>(1.5);
  const [isWorkerActive, setIsWorkerActive] = useState<boolean>(false);

  const [revisions, setRevisions] = useState<WorldRevisions>({
    terrainRevision: 1,
    roadRevision: 1,
    buildingRevision: 1,
    vehicleRevision: 1,
    pedestrianRevision: 1,
    simulationStatsRevision: 1,
  });

  const [dirtyTerrainChunks, setDirtyTerrainChunks] = useState<Set<string>>(() => new Set(['all']));
  const [dirtyRoadChunks, setDirtyRoadChunks] = useState<Set<string>>(() => new Set(['all']));
  const [dirtyBuildingChunks, setDirtyBuildingChunks] = useState<Set<string>>(() => new Set(['all']));

  const [activeVehicles, setActiveVehicles] = useState<SimulatedVehicle[]>([]);
  const [activePedestrians, setActivePedestrians] = useState<SimulatedPedestrian[]>([]);

  const [metrics, setMetrics] = useState<EngineProfilerMetrics>({
    terrainRebuildCount: 0,
    roadRebuildCount: 0,
    buildingBatchUpdateCount: 0,
    workerMessageSize: 0,
    changedChunksPerTick: 0,
    simulationTickTime: 1.5,
    renderFrameTime: 16.6,
    drawCalls: 12,
    triangles: 0,
    visibleChunks: 25,
    fps: 60,
  });

  const workerRef = useRef<Worker | null>(null);
  const isBusyRef = useRef<boolean>(false);
  const fallbackSimRef = useRef<AuthoritativeSimulation | null>(null);
  const lastMetricsUpdateRef = useRef<number>(0);

  const clientCommandIdCounter = useRef<number>(0);
  const pendingCommands = useRef<Map<number, (res: SimulationCommandResult) => void>>(new Map());
  const stateVersionRef = useRef<number>(0);
  
  const gameStateRef = useRef<CityState>(initialState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Initialize Web Worker
  useEffect(() => {
    try {
      const worker = new Worker(new URL('../core/simulation/simulation.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e) => {
        const data = e.data || {};
        if (data.type === 'INIT_ACK') {
          setIsWorkerActive(true);
          if (data.revisions) {
            setRevisions(data.revisions);
          }
        } else if (data.type === 'TICK_DELTA') {
          const delta = data as SimulationTickDelta;
          
          if (delta.stateVersion < stateVersionRef.current) {
            // Stale tick, ignore
            isBusyRef.current = false;
            return;
          }
          stateVersionRef.current = delta.stateVersion;

          // Apply changed tiles directly to gameState.grid in-place
          setGameState((prev) => {
            // We create a shallow clone of the grid array rows that are modified
            // This satisfies React immutability for re-renders without full deep clone.
            const newGrid = [...prev.grid];
            
            if (delta.changedTiles && delta.changedTiles.length > 0) {
              for (const update of delta.changedTiles) {
                if (newGrid[update.y]) {
                  newGrid[update.y] = [...newGrid[update.y]];
                  const t = { ...newGrid[update.y][update.x] };
                  if (update.type !== undefined) t.type = update.type;
                  if (update.level !== undefined) t.level = update.level;
                  if (update.abandoned !== undefined) t.abandoned = update.abandoned;
                  if (update.powered !== undefined) t.powered = update.powered;
                  if (update.watered !== undefined) t.watered = update.watered;
                  if (update.population !== undefined) t.population = update.population;
                  if (update.jobs !== undefined) t.jobs = update.jobs;
                  if (update.elevation !== undefined) t.elevation = update.elevation;
                  if (update.water !== undefined) t.water = update.water;
                  newGrid[update.y][update.x] = t;
                }
              }
            }

            // Merge stats delta
            return {
              ...prev,
              ...delta.stats,
              grid: newGrid,
            };
          });

          // Revisions & agents
          setRevisions(delta.revisions);
          setActiveVehicles(delta.vehicles || []);
          setActivePedestrians(delta.pedestrians || []);

          if (delta.dirtyTerrainChunkKeys && delta.dirtyTerrainChunkKeys.length > 0) {
            setDirtyTerrainChunks((prev) => new Set([...prev, ...delta.dirtyTerrainChunkKeys]));
          }
          if (delta.dirtyRoadChunkKeys && delta.dirtyRoadChunkKeys.length > 0) {
            setDirtyRoadChunks((prev) => new Set([...prev, ...delta.dirtyRoadChunkKeys]));
          }
          if (delta.dirtyBuildingChunkKeys && delta.dirtyBuildingChunkKeys.length > 0) {
            setDirtyBuildingChunks((prev) => new Set([...prev, ...delta.dirtyBuildingChunkKeys]));
          }

          const now = performance.now();
          if (now - lastMetricsUpdateRef.current > 300) {
            lastMetricsUpdateRef.current = now;
            setSimulationTimeMs(delta.durationMs);
            setMetrics((prev) => ({
              ...prev,
              simulationTickTime: delta.durationMs,
              workerMessageSize: delta.payloadSizeBytes,
              changedChunksPerTick: delta.changedChunksCount,
            }));
          }

          isBusyRef.current = false;
        } else if (data.type === 'COMMAND_RESULT') {
          const res = data as SimulationCommandResult & { clientCommandId?: number };
          
          if (res.stateVersion >= stateVersionRef.current) {
            stateVersionRef.current = res.stateVersion;
          }

          if (res.success) {
            // Sync changed tiles authoritatively from worker command execution
            setGameState((prev) => {
              const newGrid = [...prev.grid];
              if (res.changedTiles && res.changedTiles.length > 0) {
                for (const update of res.changedTiles) {
                  if (newGrid[update.y]) {
                    newGrid[update.y] = [...newGrid[update.y]];
                    const t = { ...newGrid[update.y][update.x] };
                    if (update.type !== undefined) t.type = update.type;
                    if (update.level !== undefined) t.level = update.level;
                    if (update.abandoned !== undefined) t.abandoned = update.abandoned;
                    if (update.powered !== undefined) t.powered = update.powered;
                    if (update.watered !== undefined) t.watered = update.watered;
                    if (update.population !== undefined) t.population = update.population;
                    if (update.jobs !== undefined) t.jobs = update.jobs;
                    if (update.elevation !== undefined) t.elevation = update.elevation;
                    if (update.water !== undefined) t.water = update.water;
                    newGrid[update.y][update.x] = t;
                  }
                }
              }
              if (res.stats) {
                return { ...prev, ...res.stats, grid: newGrid };
              }
              return { ...prev, grid: newGrid };
            });

            if (res.revisions) {
              setRevisions(res.revisions);
            }

            if (res.commandType === 'LOAD_STATE') {
              setDirtyTerrainChunks(new Set(['all']));
              setDirtyRoadChunks(new Set(['all']));
              setDirtyBuildingChunks(new Set(['all']));
              setActiveVehicles([]);
              setActivePedestrians([]);
            } else {
              if (res.dirtyTerrain && res.dirtyTerrain.length > 0) {
                setDirtyTerrainChunks((prev) => new Set([...prev, ...res.dirtyTerrain]));
              }
              if (res.dirtyRoads && res.dirtyRoads.length > 0) {
                setDirtyRoadChunks((prev) => new Set([...prev, ...res.dirtyRoads]));
              }
              if (res.dirtyBuildings && res.dirtyBuildings.length > 0) {
                setDirtyBuildingChunks((prev) => new Set([...prev, ...res.dirtyBuildings]));
              }
            }
          }
          
          if (res.clientCommandId !== undefined) {
             const resolver = pendingCommands.current.get(res.clientCommandId);
             if (resolver) {
                 resolver(res);
                 pendingCommands.current.delete(res.clientCommandId);
             }
          }
        }
      };

      worker.postMessage({ type: 'INIT', payload: initialState });
      workerRef.current = worker;

      return () => {
        worker.terminate();
        workerRef.current = null;
        setIsWorkerActive(false);
      };
    } catch (err) {
      console.warn('Web Worker initialization fallback to main thread:', err);
      setIsWorkerActive(false);
      fallbackSimRef.current = new AuthoritativeSimulation(initialState);
    }
  }, []);

  // Dispatch high-performance simulation command
  const dispatchCommand = useCallback(
    (cmd: SimulationCommand): Promise<SimulationCommandResult> => {
      return new Promise((resolve) => {
          clientCommandIdCounter.current++;
          const cid = clientCommandIdCounter.current;
          pendingCommands.current.set(cid, resolve);
          
          if (cmd.type === 'CHANGE_SPEED') {
            setSpeed(cmd.payload.speed);
          }

          if (workerRef.current && isWorkerActive) {
            workerRef.current.postMessage({ type: 'COMMAND', payload: cmd, clientCommandId: cid });
          } else {
            if (!fallbackSimRef.current) {
              fallbackSimRef.current = new AuthoritativeSimulation(gameStateRef.current);
            }
            const res = fallbackSimRef.current.executeCommand(cmd);
            
            if (res.stateVersion >= stateVersionRef.current) {
              stateVersionRef.current = res.stateVersion;
            }
            
            if (res.success) {
                setGameState({ ...fallbackSimRef.current.getState() });
                if (res.revisions) setRevisions(res.revisions);
                
                if (cmd.type === 'LOAD_STATE') {
                  setDirtyTerrainChunks(new Set(['all']));
                  setDirtyRoadChunks(new Set(['all']));
                  setDirtyBuildingChunks(new Set(['all']));
                  setActiveVehicles([]);
                  setActivePedestrians([]);
                } else {
                  if (res.dirtyTerrain && res.dirtyTerrain.length > 0) {
                    setDirtyTerrainChunks((prev) => new Set([...prev, ...res.dirtyTerrain!]));
                  }
                  if (res.dirtyRoads && res.dirtyRoads.length > 0) {
                    setDirtyRoadChunks((prev) => new Set([...prev, ...res.dirtyRoads!]));
                  }
                  if (res.dirtyBuildings && res.dirtyBuildings.length > 0) {
                    setDirtyBuildingChunks((prev) => new Set([...prev, ...res.dirtyBuildings!]));
                  }
                }
            }
            resolve(res);
            pendingCommands.current.delete(cid);
          }
      });
    },
    [isWorkerActive]
  );

  const triggerManualTick = useCallback(() => {
    if (workerRef.current && isWorkerActive) {
      if (!isBusyRef.current) {
        isBusyRef.current = true;
        workerRef.current.postMessage({ type: 'TICK' });
      }
    } else {
      if (!fallbackSimRef.current) {
        fallbackSimRef.current = new AuthoritativeSimulation(gameStateRef.current);
      }
      const delta = fallbackSimRef.current.stepTick();
      setGameState({ ...fallbackSimRef.current.getState() });
      setRevisions(delta.revisions);
      setActiveVehicles(delta.vehicles);
      setActivePedestrians(delta.pedestrians);
      
      const now = performance.now();
      if (now - lastMetricsUpdateRef.current > 300) {
        lastMetricsUpdateRef.current = now;
        setSimulationTimeMs(delta.durationMs);
        setMetrics((prev) => ({
          ...prev,
          simulationTickTime: delta.durationMs,
          changedChunksPerTick: delta.changedChunksCount,
        }));
      }
    }
  }, [isWorkerActive]);

  // Simulation tick timer
  useEffect(() => {
    if (speed === 0) return;
    const intervalMs = speed === 1 ? 1000 : speed === 2 ? 400 : 180;

    const timer = setInterval(() => {
      if (workerRef.current && isWorkerActive) {
        if (!isBusyRef.current) {
          isBusyRef.current = true;
          workerRef.current.postMessage({ type: 'TICK' });
        }
      } else {
        if (!fallbackSimRef.current) {
          fallbackSimRef.current = new AuthoritativeSimulation(gameStateRef.current);
        }
        const delta = fallbackSimRef.current.stepTick();
        setGameState({ ...fallbackSimRef.current.getState() });
        setRevisions(delta.revisions);
        setActiveVehicles(delta.vehicles);
        setActivePedestrians(delta.pedestrians);
        
        const now = performance.now();
        if (now - lastMetricsUpdateRef.current > 300) {
          lastMetricsUpdateRef.current = now;
          setSimulationTimeMs(delta.durationMs);
          setMetrics((prev) => ({
            ...prev,
            simulationTickTime: delta.durationMs,
            changedChunksPerTick: delta.changedChunksCount,
          }));
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [speed, isWorkerActive]);

  const clearDirtyTerrainChunks = useCallback(() => {
    setDirtyTerrainChunks(new Set());
  }, []);

  const clearDirtyRoadChunks = useCallback(() => {
    setDirtyRoadChunks(new Set());
  }, []);

  const clearDirtyBuildingChunks = useCallback(() => {
    setDirtyBuildingChunks(new Set());
  }, []);

  const incrementTerrainRebuildCount = useCallback((count = 1) => {
    setMetrics((prev) => ({ ...prev, terrainRebuildCount: prev.terrainRebuildCount + count }));
  }, []);

  const incrementRoadRebuildCount = useCallback((count = 1) => {
    setMetrics((prev) => ({ ...prev, roadRebuildCount: prev.roadRebuildCount + count }));
  }, []);

  const incrementBuildingBatchCount = useCallback((count = 1) => {
    setMetrics((prev) => ({ ...prev, buildingBatchUpdateCount: prev.buildingBatchUpdateCount + count }));
  }, []);

  const setVisibleChunksCount = useCallback((count: number) => {
    setMetrics((prev) => (prev.visibleChunks === count ? prev : { ...prev, visibleChunks: count }));
  }, []);

  const setDrawCallsCount = useCallback((count: number) => {
    setMetrics((prev) => (prev.drawCalls === count ? prev : { ...prev, drawCalls: count }));
  }, []);

  const setRenderFrameTime = useCallback((ms: number) => {
    setMetrics((prev) => ({ ...prev, renderFrameTime: ms, fps: Math.round(1000 / Math.max(1, ms)) }));
  }, []);

  return {
    gameState,
    setGameState,
    revisions,
    dirtyTerrainChunks,
    dirtyRoadChunks,
    dirtyBuildingChunks,
    activeVehicles,
    activePedestrians,
    metrics,
    speed,
    setSpeed,
    simulationTimeMs,
    triggerManualTick,
    dispatchCommand,
    isWorkerActive,
    clearDirtyTerrainChunks,
    clearDirtyRoadChunks,
    clearDirtyBuildingChunks,
    incrementTerrainRebuildCount,
    incrementRoadRebuildCount,
    incrementBuildingBatchCount,
    setVisibleChunksCount,
    setDrawCallsCount,
    setRenderFrameTime,
  };
}
