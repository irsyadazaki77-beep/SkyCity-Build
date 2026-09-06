import { CityState } from '../../types';
import { simulateTick } from './SimulationEngine';

let currentState: CityState | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data || {};

  if (type === 'INIT') {
    currentState = payload;
    self.postMessage({ type: 'INIT_ACK' });
  } else if (type === 'SYNC') {
    currentState = payload;
  } else if (type === 'TICK') {
    const inputState = payload || currentState;
    if (!inputState) return;

    const t0 = performance.now();
    const nextState = simulateTick(inputState);
    const durationMs = performance.now() - t0;
    currentState = nextState;

    self.postMessage({
      type: 'TICK_RESULT',
      state: nextState,
      durationMs,
    });
  }
};
