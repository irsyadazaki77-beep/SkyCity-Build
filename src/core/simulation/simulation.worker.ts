import { CityState, SimulationCommand } from '../../types';
import { AuthoritativeSimulation } from './AuthoritativeSimulation';

let simulation: AuthoritativeSimulation | null = null;

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data || {};

  if (type === 'INIT') {
    simulation = new AuthoritativeSimulation(payload as CityState);
    self.postMessage({
      type: 'INIT_ACK',
      revisions: simulation.getRevisions(),
    });
  } else if (type === 'COMMAND') {
    if (!simulation) return;
    const cmd = payload as SimulationCommand;
    const clientCommandId = e.data.clientCommandId;
    const result = simulation.executeCommand(cmd);

    self.postMessage({
      ...result,
      clientCommandId,
    });
  } else if (type === 'TICK') {
    if (!simulation) return;
    const delta = simulation.stepTick();
    self.postMessage(delta);
  } else if (type === 'GET_FULL_STATE') {
    if (!simulation) return;
    self.postMessage({
      type: 'FULL_STATE_RESULT',
      state: simulation.getState(),
      revisions: simulation.getRevisions(),
    });
  }
};
