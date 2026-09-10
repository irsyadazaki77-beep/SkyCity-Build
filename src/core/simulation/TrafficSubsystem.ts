import { TileData, TileType, SimulatedVehicle, SimulatedPedestrian } from '../../types';
import { GAME_CONFIG } from '../../config';

export interface RoadNode {
  x: number;
  y: number;
  key: string;
  neighbors: string[];
  degree: number;
  isIntersection: boolean;
  capacity: number;
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  roadCount: number;
  intersectionCount: number;
  signature: string;
}

export interface TrafficSimulationResult {
  roadTrafficMap: Map<string, number>;
  averageTraffic: number;
  averageCommuteTime: number;
  congestionIndex: number;
  workplaceProductivity: Map<string, number>;
  connectedZoneAccess: Map<string, boolean>;
  activeVehicles: SimulatedVehicle[];
  activePedestrians: SimulatedPedestrian[];
}

interface PQNode {
  key: string;
  cost: number;
  priority: number;
}

class MinPriorityQueue {
  private heap: PQNode[] = [];

  push(item: PQNode) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): PQNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(n: number) {
    const element = this.heap[n];
    while (n > 0) {
      const parentN = Math.floor((n - 1) / 2);
      const parent = this.heap[parentN];
      if (element.priority >= parent.priority) break;
      this.heap[parentN] = element;
      this.heap[n] = parent;
      n = parentN;
    }
  }

  private sinkDown(n: number) {
    const length = this.heap.length;
    const element = this.heap[n];

    while (true) {
      const leftChildN = 2 * n + 1;
      const rightChildN = 2 * n + 2;
      let swap: number | null = null;

      if (leftChildN < length) {
        if (this.heap[leftChildN].priority < element.priority) {
          swap = leftChildN;
        }
      }

      if (rightChildN < length) {
        if (
          (swap === null && this.heap[rightChildN].priority < element.priority) ||
          (swap !== null && this.heap[rightChildN].priority < this.heap[leftChildN].priority)
        ) {
          swap = rightChildN;
        }
      }

      if (swap === null) break;
      this.heap[n] = this.heap[swap];
      this.heap[swap] = element;
      n = swap;
    }
  }
}

export class RoadNetwork {
  private graph: RoadGraph = {
    nodes: new Map(),
    roadCount: 0,
    intersectionCount: 0,
    signature: 'INITIAL'
  };
  private pathCache = new Map<string, { path: string[]; travelTime: number }>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;
  private revision = 0;
  private unlockedUpgrades: string[] = [];

  constructor() {}

  public getGraph(): RoadGraph {
    return this.graph;
  }

  public getRevision(): number {
    return this.revision;
  }

  public clearCache(): void {
    this.pathCache.clear();
  }

  public rebuildFull(grid: TileData[][], unlockedUpgrades: string[] = []): void {
    this.unlockedUpgrades = unlockedUpgrades;
    const height = grid.length;
    const width = grid[0]?.length || 0;
    
    this.graph.nodes.clear();
    this.graph.roadCount = 0;
    this.graph.intersectionCount = 0;
    this.revision++;
    this.graph.signature = `REV:${this.revision}`;

    const hasAsphalt = unlockedUpgrades.includes('asphalt_roads');
    const baseCapacity = hasAsphalt
      ? GAME_CONFIG.ROAD_NETWORK.BASE_CAPACITY + GAME_CONFIG.ROAD_NETWORK.ASPHALT_CAPACITY_BONUS
      : GAME_CONFIG.ROAD_NETWORK.BASE_CAPACITY;

    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].type === TileType.ROAD) {
          const key = `${x},${y}`;
          const neighbors: string[] = [];
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (grid[ny][nx].type === TileType.ROAD) {
                neighbors.push(`${nx},${ny}`);
              }
            }
          }
          
          const isIntersection = neighbors.length >= 3;
          if (isIntersection) this.graph.intersectionCount++;

          this.graph.nodes.set(key, {
            x, y, key, neighbors,
            degree: neighbors.length,
            isIntersection,
            capacity: baseCapacity
          });
          this.graph.roadCount++;
        }
      }
    }
    
    this.clearCache();
  }

  public addRoadNode(x: number, y: number, grid: TileData[][], unlockedUpgrades: string[] = []): void {
    this.unlockedUpgrades = unlockedUpgrades;
    const height = grid.length;
    const width = grid[0]?.length || 0;
    
    const hasAsphalt = unlockedUpgrades.includes('asphalt_roads');
    const baseCapacity = hasAsphalt
      ? GAME_CONFIG.ROAD_NETWORK.BASE_CAPACITY + GAME_CONFIG.ROAD_NETWORK.ASPHALT_CAPACITY_BONUS
      : GAME_CONFIG.ROAD_NETWORK.BASE_CAPACITY;

    const key = `${x},${y}`;
    if (this.graph.nodes.has(key)) return;

    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const neighbors: string[] = [];
    
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (grid[ny][nx].type === TileType.ROAD) {
          const nKey = `${nx},${ny}`;
          neighbors.push(nKey);
          
          // Update neighbor
          const neighborNode = this.graph.nodes.get(nKey);
          if (neighborNode) {
            if (!neighborNode.neighbors.includes(key)) {
              neighborNode.neighbors.push(key);
              neighborNode.degree = neighborNode.neighbors.length;
              if (neighborNode.degree === 3) {
                neighborNode.isIntersection = true;
                this.graph.intersectionCount++;
              }
            }
          }
        }
      }
    }
    
    const isIntersection = neighbors.length >= 3;
    if (isIntersection) this.graph.intersectionCount++;

    this.graph.nodes.set(key, {
      x, y, key, neighbors,
      degree: neighbors.length,
      isIntersection,
      capacity: baseCapacity
    });
    this.graph.roadCount++;
    
    this.revision++;
    this.graph.signature = `REV:${this.revision}`;
    this.clearCache();
  }

  public removeRoadNode(x: number, y: number, grid: TileData[][]): void {
    const key = `${x},${y}`;
    const node = this.graph.nodes.get(key);
    if (!node) return;

    if (node.isIntersection) this.graph.intersectionCount--;
    
    for (const nKey of node.neighbors) {
      const neighborNode = this.graph.nodes.get(nKey);
      if (neighborNode) {
        neighborNode.neighbors = neighborNode.neighbors.filter(k => k !== key);
        neighborNode.degree = neighborNode.neighbors.length;
        if (neighborNode.degree === 2 && neighborNode.isIntersection) {
          neighborNode.isIntersection = false;
          this.graph.intersectionCount--;
        }
      }
    }
    
    this.graph.nodes.delete(key);
    this.graph.roadCount--;
    
    this.revision++;
    this.graph.signature = `REV:${this.revision}`;
    this.clearCache();
  }

  public getCachedPath(startKey: string, targetKey: string): { path: string[]; travelTime: number } | null {
    const key = `${startKey}->${targetKey}`;
    const entry = this.pathCache.get(key);
    if (entry) {
      this.cacheHits++;
      // Move to back (LRU)
      this.pathCache.delete(key);
      this.pathCache.set(key, entry);
      return entry;
    }
    this.cacheMisses++;
    return null;
  }

  public setCachedPath(startKey: string, targetKey: string, result: { path: string[]; travelTime: number }): void {
    const key = `${startKey}->${targetKey}`;
    if (this.pathCache.size >= 2000) {
      const firstKey = this.pathCache.keys().next().value;
      if (firstKey) {
         this.pathCache.delete(firstKey);
         this.cacheEvictions++;
      }
    }
    this.pathCache.set(key, result);
  }
  public findAStarRoadPath(
    startKey: string,
    targetKey: string,
    roadLoadMap: Map<string, number>
  ): { path: string[]; travelTime: number } | null {
    if (startKey === targetKey) {
      return { path: [startKey], travelTime: 0.5 };
    }

    const cached = this.getCachedPath(startKey, targetKey);
    if (cached) return cached;

    const startNode = this.graph.nodes.get(startKey);
    const targetNode = this.graph.nodes.get(targetKey);
    if (!startNode || !targetNode) return null;

    const hasAsphalt = this.unlockedUpgrades.includes('asphalt_roads');
    const hasSmartLights = this.unlockedUpgrades.includes('smart_lights');
    const baseSpeedMult = hasAsphalt ? GAME_CONFIG.ROAD_NETWORK.ASPHALT_SPEED_MULT : 1.0;
    const intersectionPenalty = hasSmartLights
      ? GAME_CONFIG.ROAD_NETWORK.SMART_LIGHTS_PENALTY
      : GAME_CONFIG.ROAD_NETWORK.BASE_INTERSECTION_PENALTY;

    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const cameFrom = new Map<string, string>();

    const manhattan = (n: RoadNode) => Math.abs(n.x - targetNode.x) + Math.abs(n.y - targetNode.y);

    gScore.set(startKey, 0);
    fScore.set(startKey, manhattan(startNode));

    const pq = new MinPriorityQueue();
    pq.push({ key: startKey, cost: 0, priority: manhattan(startNode) });

    const visited = new Set<string>();

    while (!pq.isEmpty()) {
      const current = pq.pop()!;
      if (current.key === targetKey) {
        const path: string[] = [];
        let curr: string | undefined = targetKey;
        while (curr) {
          path.unshift(curr);
          curr = cameFrom.get(curr);
        }
        const result = { path, travelTime: gScore.get(targetKey) || path.length };
        this.setCachedPath(startKey, targetKey, result);
        return result;
      }

      if (visited.has(current.key)) continue;
      visited.add(current.key);

      const currNode = this.graph.nodes.get(current.key)!;
      const currentG = gScore.get(current.key) ?? Infinity;

      for (const neighborKey of currNode.neighbors) {
        if (visited.has(neighborKey)) continue;

        const neighborNode = this.graph.nodes.get(neighborKey)!;
        const currentLoad = roadLoadMap.get(neighborKey) || 0;
        const congestionRatio = currentLoad / neighborNode.capacity;

        const edgeCost =
          baseSpeedMult +
          (neighborNode.isIntersection ? intersectionPenalty : 0) +
          Math.pow(congestionRatio, 1.5) * 1.5;

        const tentativeG = currentG + edgeCost;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, current.key);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + manhattan(neighborNode);
          fScore.set(neighborKey, f);
          pq.push({ key: neighborKey, cost: tentativeG, priority: f });
        }
      }
    }

    return null;
  }
}

export function getAdjacentRoadNodeKey(x: number, y: number, graph: RoadGraph): string | null {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    const key = `${nx},${ny}`;
    if (graph.nodes.has(key)) {
      return key;
    }
  }
  return null;
}



export class TrafficSubsystem {
  private vehicleIdCounter = 1;
  private pedestrianIdCounter = 1;
  public roadNetwork = new RoadNetwork();

  public simulate(
    grid: TileData[][],
    employedCitizens: number,
    unlockedUpgrades: string[] = []
  ): TrafficSimulationResult {
    const height = grid.length;
    const width = grid[0]?.length || 0;

    // TODO: Ideally we only update incrementally when commands happen, but for now we'll rebuild full
    // to keep existing functionality working until incremental command is wired.
    this.roadNetwork.rebuildFull(grid, unlockedUpgrades);
    const graph = this.roadNetwork.getGraph();

    const roadLoadMap = new Map<string, number>();
    const connectedZoneAccess = new Map<string, boolean>();
    const workplaceProductivity = new Map<string, number>();
    const simulatedVehicles: SimulatedVehicle[] = [];
    const simulatedPedestrians: SimulatedPedestrian[] = [];

    if (graph.roadCount === 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = grid[y][x];
          tile.traffic = 0;
          if (tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL) {
            tile.productivity = 0;
          }
        }
      }

      return {
        roadTrafficMap: new Map(),
        averageTraffic: 0,
        averageCommuteTime: 0,
        congestionIndex: 0,
        workplaceProductivity: new Map(),
        connectedZoneAccess: new Map(),
        activeVehicles: [],
        activePedestrians: [],
      };
    }

    // 1. Gather Residential Origins
    const residentialOrigins: { x: number; y: number; roadKey: string; workers: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const zoneKey = `${x},${y}`;

        if (tile.type === TileType.RESIDENTIAL) {
          const roadKey = getAdjacentRoadNodeKey(x, y, graph);
          if (roadKey && !tile.abandoned && tile.population > 0) {
            connectedZoneAccess.set(zoneKey, true);
            const commuters = Math.max(1, Math.round(tile.population * 0.65));
            residentialOrigins.push({ x, y, roadKey, workers: commuters });
          } else {
            connectedZoneAccess.set(zoneKey, false);
          }
        }
      }
    }

    // 2. Gather Workplace Destinations
    const workplaceDestinations: {
      x: number;
      y: number;
      roadKey: string;
      totalJobs: number;
      remainingJobs: number;
      zoneKey: string;
      type: TileType;
    }[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const zoneKey = `${x},${y}`;

        if (tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL) {
          const roadKey = getAdjacentRoadNodeKey(x, y, graph);
          if (roadKey && !tile.abandoned) {
            connectedZoneAccess.set(zoneKey, true);
            if (tile.jobs > 0) {
              workplaceDestinations.push({
                x,
                y,
                roadKey,
                totalJobs: tile.jobs,
                remainingJobs: tile.jobs,
                zoneKey,
                type: tile.type,
              });
            }
          } else {
            connectedZoneAccess.set(zoneKey, false);
            tile.productivity = 0;
            workplaceProductivity.set(zoneKey, 0);
          }
        }
      }
    }

    const hasBikeLanes = unlockedUpgrades.includes('bike_lanes');
    const hasBusNetwork = unlockedUpgrades.includes('bus_network');
    const hasTramSystem = unlockedUpgrades.includes('tram_system');

    let totalTripTime = 0;
    let totalRoutedTrips = 0;

    const VEHICLE_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#f8fafc', '#6366f1', '#06b6d4'];

    // 3. Commuter Routing
    if (residentialOrigins.length > 0 && workplaceDestinations.length > 0) {
      for (const origin of residentialOrigins) {
        let workersToRoute = origin.workers;

        while (workersToRoute > 0) {
          const availableDests = workplaceDestinations.filter((d) => d.remainingJobs > 0);
          if (availableDests.length === 0) break;

          availableDests.sort((a, b) => {
            const distA = Math.abs(origin.x - a.x) + Math.abs(origin.y - a.y);
            const distB = Math.abs(origin.x - b.x) + Math.abs(origin.y - b.y);
            return distA - distB;
          });

          let routeSuccess = false;
          for (const dest of availableDests) {
            const pathRes = this.roadNetwork.findAStarRoadPath(origin.roadKey, dest.roadKey, roadLoadMap);
            if (pathRes) {
              const batchSize = Math.min(workersToRoute, dest.remainingJobs);
              dest.remainingJobs -= batchSize;
              workersToRoute -= batchSize;

              let vehicleVolume = batchSize;
              if (hasBikeLanes && pathRes.path.length <= GAME_CONFIG.ROAD_NETWORK.BIKE_LANE_MAX_DIST) {
                vehicleVolume *= 1 - GAME_CONFIG.ROAD_NETWORK.BIKE_LANE_ABSORPTION;
              }
              if (hasBusNetwork) {
                vehicleVolume *= 1 - GAME_CONFIG.ROAD_NETWORK.BUS_NETWORK_REDUCTION;
              }
              if (hasTramSystem) {
                vehicleVolume *= 1 - GAME_CONFIG.ROAD_NETWORK.TRAM_SYSTEM_REDUCTION;
              }
              vehicleVolume = Math.max(0.5, vehicleVolume);

              for (const roadKey of pathRes.path) {
                const prev = roadLoadMap.get(roadKey) || 0;
                roadLoadMap.set(roadKey, prev + vehicleVolume);
              }

              totalTripTime += pathRes.travelTime * batchSize;
              totalRoutedTrips += batchSize;

              if (simulatedVehicles.length < 80) {
                const waypoints: [number, number, number][] = pathRes.path.map((key) => {
                  const [px, py] = key.split(',').map(Number);
                  const el = grid[py]?.[px]?.elevation || 0;
                  return [px, el * 0.45 + 0.1, py];
                });

                simulatedVehicles.push({
                  id: this.vehicleIdCounter++,
                  type: dest.type === TileType.INDUSTRIAL ? 'truck' : hasBusNetwork && Math.random() < 0.2 ? 'bus' : 'car',
                  path: waypoints,
                  currentWaypointIndex: 0,
                  progress: Math.random(),
                  speed: 0.35 + Math.random() * 0.3,
                  color: VEHICLE_COLORS[this.vehicleIdCounter % VEHICLE_COLORS.length],
                  originKey: `${origin.x},${origin.y}`,
                  destinationKey: dest.zoneKey,
                  purpose: 'work',
                });
              }

              routeSuccess = true;
              break;
            }
          }

          if (!routeSuccess) break;
        }
      }
    }

    // 4. Update Workplace Productivities
    for (const dest of workplaceDestinations) {
      const workersFilled = dest.totalJobs - dest.remainingJobs;
      const fillRate = dest.totalJobs > 0 ? workersFilled / dest.totalJobs : 0;
      const prod = Math.round(Math.min(100, Math.max(20, fillRate * 100)));
      workplaceProductivity.set(dest.zoneKey, prod);
      grid[dest.y][dest.x].productivity = prod;
    }

    // 5. Generate Sidewalk Pedestrians
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type === TileType.ROAD && simulatedPedestrians.length < 50) {
          const traffic = roadLoadMap.get(`${x},${y}`) || 0;
          if (traffic > 1 && Math.random() < 0.25) {
            simulatedPedestrians.push({
              id: this.pedestrianIdCounter++,
              startX: x - 0.4 + Math.random() * 0.8,
              startZ: y - 0.4 + Math.random() * 0.8,
              targetX: x + (Math.random() < 0.5 ? 0.4 : -0.4),
              targetZ: y + (Math.random() < 0.5 ? 0.4 : -0.4),
              progress: Math.random(),
              speed: 0.2 + Math.random() * 0.15,
              color: VEHICLE_COLORS[this.pedestrianIdCounter % VEHICLE_COLORS.length],
            });
          }
        }
      }
    }

    // 6. Aggregate Road Network Statistics
    let totalTrafficSum = 0;
    let congestedRoadsCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const key = `${x},${y}`;

        if (tile.type === TileType.ROAD) {
          const node = graph.nodes.get(key);
          if (node) {
            const volume = roadLoadMap.get(key) || 0;
            const capacity = node.capacity;
            const ratio = volume / capacity;

            if (ratio > 0.85) {
              congestedRoadsCount++;
            }

            const trafficScore = Math.min(100, Math.round((volume / capacity) * 20));
            tile.traffic = trafficScore;
            totalTrafficSum += trafficScore;
          }
        }
      }
    }

    const roadCount = graph.roadCount || 1;
    const averageTraffic = Math.round(totalTrafficSum / roadCount);
    const averageCommuteTime = totalRoutedTrips > 0 ? Number((totalTripTime / totalRoutedTrips).toFixed(1)) : 0;
    const congestionIndex = Math.round((congestedRoadsCount / roadCount) * 100);

    return {
      roadTrafficMap: roadLoadMap,
      averageTraffic,
      averageCommuteTime,
      congestionIndex,
      workplaceProductivity,
      connectedZoneAccess,
      activeVehicles: simulatedVehicles,
      activePedestrians: simulatedPedestrians,
    };
  }
}
