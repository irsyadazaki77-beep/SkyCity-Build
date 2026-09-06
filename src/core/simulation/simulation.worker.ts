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
    const result = simulation.executeCommand(cmd);
    const fullState = simulation.getState();

    // Compact stats delta (omit grid for minimal message size)
    const { grid: _omit, ...statsDelta } = fullState;

    self.postMessage({
      type: 'COMMAND_RESULT',
      commandType: cmd.type,
      revisions: result.revisions,
      dirtyTerrain: result.dirtyTerrain,
      dirtyRoads: result.dirtyRoads,
      dirtyBuildings: result.dirtyBuildings,
      stats: statsDelta,
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
