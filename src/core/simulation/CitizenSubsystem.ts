import { TileData, TileType, CitizenAgent, Household, EducationTier, IncomeClass, TransportPreference } from '../../types';

export interface CitizenSimulationResult {
  totalPop: number;
  households: number;
  workers: number;
  citizens: CitizenAgent[];
  householdList: Household[];
  averageHappiness: number;
  averageHealth: number;
  averageEducation: number;
  unemploymentCount: number;
}

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Sam', 'Chris', 'Casey', 'Riley', 'Avery', 'Jamie', 'Logan', 'Dakota', 'Skyler', 'Cameron', 'Rowan'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];

export class CitizenSubsystem {
  private citizens: Map<string, CitizenAgent> = new Map();
  private households: Map<string, Household> = new Map();
  private nextCitizenId = 1;
  private nextHouseholdId = 1;

  public simulate(
    grid: TileData[][],
    residentialDemand: number,
    cityHappiness: number,
    unlockedUpgrades: string[],
    activePolicies: string[] = []
  ): CitizenSimulationResult {
    const height = grid.length;
    const width = grid[0]?.length || 0;

    let totalCap = 0;
    const residentialTiles: { x: number; y: number; tile: TileData; cap: number }[] = [];

    // Capacity lookup by level
    const LEVEL_CAPACITIES = [0, 4, 12, 30, 75, 180];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type === TileType.RESIDENTIAL) {
          const lvl = Math.max(1, Math.min(5, tile.level || 1));
          const maxCap = LEVEL_CAPACITIES[lvl] || 4;
          totalCap += maxCap;

          if (!tile.abandoned && tile.powered && tile.watered) {
            residentialTiles.push({ x, y, tile, cap: maxCap });
          }
        }
      }
    }

    // Determine target population based on capacity & residential demand
    const demandRatio = Math.max(0, Math.min(1, (residentialDemand + 100) / 200));
    const targetPopulation = Math.round(totalCap * demandRatio * (cityHappiness / 100));

    // Update existing residential tiles population
    let currentPop = 0;
    let totalWorkers = 0;
    let totalHealthSum = 0;
    let totalHappinessSum = 0;
    let totalEduSum = 0;

    for (const item of residentialTiles) {
      const { tile, cap } = item;
      const targetForTile = Math.min(cap, Math.round(cap * demandRatio));

      // Gradual population adjustment
      if (tile.population < targetForTile) {
        tile.population = Math.min(cap, tile.population + Math.max(1, Math.ceil((targetForTile - tile.population) * 0.2)));
      } else if (tile.population > targetForTile) {
        tile.population = Math.max(0, tile.population - Math.max(1, Math.ceil((tile.population - targetForTile) * 0.2)));
      }

      currentPop += tile.population;
      const workersOnTile = Math.round(tile.population * 0.65);
      totalWorkers += workersOnTile;

      const health = tile.healthCovered ? Math.min(100, (tile.health || 50) + 10) : Math.max(20, (tile.health || 50) - 5);
      const edu = tile.schoolCovered ? Math.min(100, (tile.education || 40) + 10) : Math.max(10, (tile.education || 40) - 2);
      const happy = tile.abandoned ? 0 : Math.min(100, Math.max(10, cityHappiness + (tile.landValue || 35) * 0.2 - (tile.pollution || 0) * 0.5));

      tile.health = health;
      tile.education = edu;
      totalHealthSum += health * tile.population;
      totalHappinessSum += happy * tile.population;
      totalEduSum += edu * tile.population;
    }

    // Maintain representative agents pool (up to 120 agents for smooth rendering & detailed queries)
    const targetAgentCount = Math.min(120, currentPop);
    this.updateRepresentativeAgents(residentialTiles, targetAgentCount, activePolicies);

    const totalHouseholds = Math.ceil(currentPop / 2.8);
    const avgHealth = currentPop > 0 ? Math.round(totalHealthSum / currentPop) : 50;
    const avgHappy = currentPop > 0 ? Math.round(totalHappinessSum / currentPop) : 50;
    const avgEdu = currentPop > 0 ? Math.round(totalEduSum / currentPop) : 40;

    return {
      totalPop: currentPop,
      households: totalHouseholds,
      workers: totalWorkers,
      citizens: Array.from(this.citizens.values()),
      householdList: Array.from(this.households.values()),
      averageHappiness: avgHappy,
      averageHealth: avgHealth,
      averageEducation: avgEdu,
      unemploymentCount: 0,
    };
  }

  private updateRepresentativeAgents(
    residentialTiles: { x: number; y: number; tile: TileData; cap: number }[],
    targetCount: number,
    activePolicies: string[]
  ): void {
    if (residentialTiles.length === 0) {
      this.citizens.clear();
      this.households.clear();
      return;
    }

    // Trim or spawn representative agents
    const citizenKeys = Array.from(this.citizens.keys());
    if (citizenKeys.length > targetCount) {
      for (let i = targetCount; i < citizenKeys.length; i++) {
        this.citizens.delete(citizenKeys[i]);
      }
    }

    const freeTransit = activePolicies.includes('FREE_TRANSIT');
    const preferences: TransportPreference[] = freeTransit
      ? ['transit', 'transit', 'car', 'walking', 'bicycle']
      : ['car', 'car', 'transit', 'walking', 'bicycle'];

    while (this.citizens.size < targetCount) {
      const tileIndex = Math.floor(Math.random() * residentialTiles.length);
      const res = residentialTiles[tileIndex];
      const id = `cit_${this.nextCitizenId++}`;
      const householdId = `hh_${this.nextHouseholdId++}`;
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

      const age = Math.floor(Math.random() * 65) + 18;
      const edu: EducationTier = Math.random() < 0.25 ? 'highly_educated' : Math.random() < 0.6 ? 'educated' : 'uneducated';
      const inc: IncomeClass = edu === 'highly_educated' ? 'high' : edu === 'educated' ? 'middle' : 'low';
      const pref = preferences[Math.floor(Math.random() * preferences.length)];

      const agent: CitizenAgent = {
        id,
        name: `${firstName} ${lastName}`,
        age,
        householdId,
        education: edu,
        income: inc,
        employed: age < 65,
        workplaceKey: null,
        homeKey: `${res.x},${res.y}`,
        health: res.tile.health || 80,
        happiness: res.tile.landValue || 65,
        transportPreference: pref,
        commuteTime: 0,
      };

      this.citizens.set(id, agent);

      const household: Household = {
        id: householdId,
        homeKey: `${res.x},${res.y}`,
        members: [id],
        wealth: inc === 'high' ? 8000 : inc === 'middle' ? 4000 : 1500,
        rent: 200 * (res.tile.level || 1),
      };
      this.households.set(householdId, household);
    }
  }
}
