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
  dispatchCommand: (cmd: SimulationCommand) => void;
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
    visibleChunks: 25,
    fps: 60,
  });

  const workerRef = useRef<Worker | null>(null);
  const isBusyRef = useRef<boolean>(false);
  const fallbackSimRef = useRef<AuthoritativeSimulation | null>(null);

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

          // Apply changed tiles directly to gameState.grid in-place
          setGameState((prev) => {
            if (delta.changedTiles && delta.changedTiles.length > 0) {
              for (const update of delta.changedTiles) {
                const t = prev.grid[update.y]?.[update.x];
                if (t) {
                  if (update.type !== undefined) t.type = update.type;
                  if (update.level !== undefined) t.level = update.level;
                  if (update.abandoned !== undefined) t.abandoned = update.abandoned;
                  if (update.powered !== undefined) t.powered = update.powered;
                  if (update.watered !== undefined) t.watered = update.watered;
                  if (update.population !== undefined) t.population = update.population;
                  if (update.jobs !== undefined) t.jobs = update.jobs;
                }
              }
            }

            // Merge stats delta
            return {
              ...prev,
              ...delta.stats,
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

          setSimulationTimeMs(delta.durationMs);
          setMetrics((prev) => ({
            ...prev,
            simulationTickTime: delta.durationMs,
            workerMessageSize: delta.payloadSizeBytes,
            changedChunksPerTick: delta.changedChunksCount,
          }));

          isBusyRef.current = false;
        } else if (data.type === 'COMMAND_RESULT') {
          if (data.stats) {
            setGameState((prev) => ({ ...prev, ...data.stats }));
          }
          if (data.revisions) {
            setRevisions(data.revisions);
          }
          if (data.dirtyTerrain && data.dirtyTerrain.length > 0) {
            setDirtyTerrainChunks((prev) => new Set([...prev, ...data.dirtyTerrain]));
          }
          if (data.dirtyRoads && data.dirtyRoads.length > 0) {
            setDirtyRoadChunks((prev) => new Set([...prev, ...data.dirtyRoads]));
          }
          if (data.dirtyBuildings && data.dirtyBuildings.length > 0) {
            setDirtyBuildingChunks((prev) => new Set([...prev, ...data.dirtyBuildings]));
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
    (cmd: SimulationCommand) => {
      // Optimistically apply to local gameState grid so visual interactions respond at 60 FPS
      if (cmd.type === 'BUILD_ROAD') {
        const { tiles } = cmd.payload as { tiles: [number, number][] };
        for (const [x, y] of tiles) {
          if (gameState.grid[y]?.[x]) {
            gameState.grid[y][x].type = TileType.ROAD;
            gameState.grid[y][x].level = 1;
            gameState.grid[y][x].abandoned = false;
          }
        }
      } else if (cmd.type === 'BUILD_ZONE') {
        const { tiles, type } = cmd.payload as { tiles: [number, number][]; type: TileType };
        for (const [x, y] of tiles) {
          if (gameState.grid[y]?.[x]) {
            gameState.grid[y][x].type = type;
            gameState.grid[y][x].level = 1;
            gameState.grid[y][x].abandoned = false;
          }
        }
      } else if (cmd.type === 'BULLDOZE') {
        const { tiles } = cmd.payload as { tiles: [number, number][] };
        for (const [x, y] of tiles) {
          if (gameState.grid[y]?.[x]) {
            gameState.grid[y][x].type = TileType.EMPTY;
          }
        }
      } else if (cmd.type === 'TERRAFORM') {
        const { tiles, tool, centerElevation } = cmd.payload as {
          tiles: [number, number][];
          tool: string;
          centerElevation?: number;
        };
        for (const [tx, ty] of tiles) {
          const t = gameState.grid[ty]?.[tx];
          if (t) {
            const oldEl = t.elevation || 0;
            if (tool === 'RAISE_TERRAIN') {
              t.elevation = Math.min(10, oldEl + 1);
              if (t.elevation > 0) t.water = false;
            } else if (tool === 'LOWER_TERRAIN') {
              t.elevation = Math.max(0, oldEl - 1);
              if (t.elevation === 0) {
                t.water = true;
                t.type = TileType.EMPTY;
              }
            } else if (tool === 'LEVEL_TERRAIN') {
              t.elevation = centerElevation ?? oldEl;
              if (t.elevation === 0) {
                t.water = true;
                t.type = TileType.EMPTY;
              } else {
                t.water = false;
              }
            }
          }
        }
      }

      if (workerRef.current && isWorkerActive) {
        workerRef.current.postMessage({ type: 'COMMAND', payload: cmd });
      } else {
        if (!fallbackSimRef.current) {
          fallbackSimRef.current = new AuthoritativeSimulation(gameState);
        }
        const res = fallbackSimRef.current.executeCommand(cmd);
        setGameState({ ...fallbackSimRef.current.getState() });
        setRevisions(res.revisions);
        if (res.dirtyTerrain.length > 0) {
          setDirtyTerrainChunks((prev) => new Set([...prev, ...res.dirtyTerrain]));
        }
        if (res.dirtyRoads.length > 0) {
          setDirtyRoadChunks((prev) => new Set([...prev, ...res.dirtyRoads]));
        }
        if (res.dirtyBuildings.length > 0) {
          setDirtyBuildingChunks((prev) => new Set([...prev, ...res.dirtyBuildings]));
        }
      }
    },
    [isWorkerActive, gameState]
  );

  const triggerManualTick = useCallback(() => {
    if (workerRef.current && isWorkerActive) {
      if (!isBusyRef.current) {
        isBusyRef.current = true;
        workerRef.current.postMessage({ type: 'TICK' });
      }
    } else {
      if (!fallbackSimRef.current) {
        fallbackSimRef.current = new AuthoritativeSimulation(gameState);
      }
      const delta = fallbackSimRef.current.stepTick();
      setGameState({ ...fallbackSimRef.current.getState() });
      setRevisions(delta.revisions);
      setActiveVehicles(delta.vehicles);
      setActivePedestrians(delta.pedestrians);
      setSimulationTimeMs(delta.durationMs);
      setMetrics((prev) => ({
        ...prev,
        simulationTickTime: delta.durationMs,
        changedChunksPerTick: delta.changedChunksCount,
      }));
    }
  }, [isWorkerActive, gameState]);

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
          fallbackSimRef.current = new AuthoritativeSimulation(gameState);
        }
        const delta = fallbackSimRef.current.stepTick();
        setGameState({ ...fallbackSimRef.current.getState() });
        setRevisions(delta.revisions);
        setActiveVehicles(delta.vehicles);
        setActivePedestrians(delta.pedestrians);
        setSimulationTimeMs(delta.durationMs);
        setMetrics((prev) => ({
          ...prev,
          simulationTickTime: delta.durationMs,
          changedChunksPerTick: delta.changedChunksCount,
        }));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [speed, isWorkerActive, gameState]);

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
