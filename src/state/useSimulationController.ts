import { useState, useEffect, useRef, useCallback } from 'react';
import { CityState } from '../types';
import { simulateTick } from '../core/simulation/SimulationEngine';

export interface SimulationController {
  gameState: CityState;
  setGameState: React.Dispatch<React.SetStateAction<CityState>>;
  speed: number;
  setSpeed: (spd: number) => void;
  simulationTimeMs: number;
  triggerManualTick: () => void;
  isWorkerActive: boolean;
}

export function useSimulationController(initialState: CityState): SimulationController {
  const [gameState, setGameState] = useState<CityState>(initialState);
  const [speed, setSpeed] = useState<number>(1);
  const [simulationTimeMs, setSimulationTimeMs] = useState<number>(1.5);
  const [isWorkerActive, setIsWorkerActive] = useState<boolean>(false);

  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  const workerRef = useRef<Worker | null>(null);
  const isBusyRef = useRef<boolean>(false);

  // Initialize Web Worker
  useEffect(() => {
    try {
      const worker = new Worker(new URL('../core/simulation/simulation.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e) => {
        const { type, state, durationMs } = e.data || {};
        if (type === 'TICK_RESULT' && state) {
          setGameState(state);
          if (typeof durationMs === 'number') {
            setSimulationTimeMs(durationMs);
          }
          isBusyRef.current = false;
        } else if (type === 'INIT_ACK') {
          setIsWorkerActive(true);
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
    }
  }, []);

  const triggerManualTick = useCallback(() => {
    if (workerRef.current && isWorkerActive) {
      if (!isBusyRef.current) {
        isBusyRef.current = true;
        workerRef.current.postMessage({ type: 'TICK', payload: stateRef.current });
      }
    } else {
      const t0 = performance.now();
      setGameState((prev) => {
        const next = simulateTick(prev);
        const t1 = performance.now();
        setSimulationTimeMs(t1 - t0);
        return next;
      });
    }
  }, [isWorkerActive]);

  useEffect(() => {
    if (speed === 0) return;
    const intervalMs = speed === 1 ? 1000 : speed === 2 ? 400 : 180;

    const timer = setInterval(() => {
      if (workerRef.current && isWorkerActive) {
        if (!isBusyRef.current) {
          isBusyRef.current = true;
          workerRef.current.postMessage({ type: 'TICK', payload: stateRef.current });
        }
      } else {
        const t0 = performance.now();
        setGameState((prev) => {
          const next = simulateTick(prev);
          const t1 = performance.now();
          setSimulationTimeMs(t1 - t0);
          return next;
        });
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [speed, isWorkerActive]);

  // Sync state changes from main thread UI actions (e.g. tile placement, bulldoze) to worker
  const setGameStateAndSync = useCallback((action: React.SetStateAction<CityState>) => {
    setGameState((prev) => {
      const next = typeof action === 'function' ? (action as (p: CityState) => CityState)(prev) : action;
      if (workerRef.current && isWorkerActive) {
        workerRef.current.postMessage({ type: 'SYNC', payload: next });
      }
      return next;
    });
  }, [isWorkerActive]);

  return {
    gameState,
    setGameState: setGameStateAndSync,
    speed,
    setSpeed,
    simulationTimeMs,
    triggerManualTick,
    isWorkerActive,
  };
}
