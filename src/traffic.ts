import { TileData, TileType } from './types';
import { GAME_CONFIG } from './config';

export interface RoadNode {
  x: number;
  y: number;
  key: string;
  neighbors: string[];
  degree: number;
  isIntersection: boolean; // 3-way or 4-way junction
  capacity: number;
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  roadCount: number;
  intersectionCount: number;
  signature: string;
}

export interface CommuterTripResult {
  roadTrafficMap: Map<string, number>;
  averageTraffic: number;
  averageCommuteTime: number;
  congestionIndex: number;
  workplaceProductivity: Map<string, number>;
  connectedZoneAccess: Map<string, boolean>;
}

// Priority Queue item for A*
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

// Graph cache
let cachedGraph: RoadGraph | null = null;

export function buildRoadGraph(grid: TileData[][], unlockedUpgrades: string[]): RoadGraph {
  const height = grid.length;
  const width = grid[0].length;
  const hasAsphalt = unlockedUpgrades.includes('asphalt_roads');

  // Compute road signature for cache invalidation
  let signature = hasAsphalt ? 'ASPHALT:' : 'STD:';
  const roadCoords: [number, number][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x].type === TileType.ROAD) {
        roadCoords.push([x, y]);
        signature += `${x},${y};`;
      }
    }
  }

  if (cachedGraph && cachedGraph.signature === signature) {
    return cachedGraph;
  }

  const nodes = new Map<string, RoadNode>();
  let intersectionCount = 0;

  const baseCapacity = hasAsphalt
    ? GAME_CONFIG.ROAD_NETWORK.BASE_CAPACITY + GAME_CONFIG.ROAD_NETWORK.ASPHALT_CAPACITY_BONUS
    : GAME_CONFIG.ROAD_NETWORK.BASE_CAPACITY;

  // First pass: create nodes
  for (const [x, y] of roadCoords) {
    const key = `${x},${y}`;
    nodes.set(key, {
      x,
      y,
      key,
      neighbors: [],
      degree: 0,
      isIntersection: false,
      capacity: baseCapacity,
    });
  }

  // Second pass: establish orthogonal connections
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (const [x, y] of roadCoords) {
    const key = `${x},${y}`;
    const node = nodes.get(key)!;

    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const neighborKey = `${nx},${ny}`;
      if (nodes.has(neighborKey)) {
        node.neighbors.push(neighborKey);
      }
    }

    node.degree = node.neighbors.length;
    // 3-way (T-junction) or 4-way crossroad
    node.isIntersection = node.degree >= 3;
    if (node.isIntersection) {
      intersectionCount++;
    }
  }

  const graph: RoadGraph = {
    nodes,
    roadCount: nodes.size,
    intersectionCount,
    signature,
  };

  cachedGraph = graph;
  return graph;
}

// Find adjacent road access for any tile
export function getAdjacentRoadNodeKey(x: number, y: number, graph: RoadGraph): string | null {
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

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

// A* Shortest Path search on Road Graph
export function findAStarRoadPath(
  startKey: string,
  targetKey: string,
  graph: RoadGraph,
  roadLoadMap: Map<string, number>,
  unlockedUpgrades: string[]
): { path: string[]; travelTime: number } | null {
  if (startKey === targetKey) {
    return { path: [startKey], travelTime: 0.5 };
  }

  const startNode = graph.nodes.get(startKey);
  const targetNode = graph.nodes.get(targetKey);
  if (!startNode || !targetNode) return null;

  const hasAsphalt = unlockedUpgrades.includes('asphalt_roads');
  const hasSmartLights = unlockedUpgrades.includes('smart_lights');
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
      // Reconstruct path
      const path: string[] = [];
      let curr: string | undefined = targetKey;
      while (curr) {
        path.unshift(curr);
        curr = cameFrom.get(curr);
      }
      return { path, travelTime: gScore.get(targetKey) || path.length };
    }

    if (visited.has(current.key)) continue;
    visited.add(current.key);

    const currNode = graph.nodes.get(current.key)!;
    const currentG = gScore.get(current.key) ?? Infinity;

    for (const neighborKey of currNode.neighbors) {
      if (visited.has(neighborKey)) continue;

      const neighborNode = graph.nodes.get(neighborKey)!;
      const currentLoad = roadLoadMap.get(neighborKey) || 0;
      const congestionRatio = currentLoad / neighborNode.capacity;

      // Cost calculation considering distance, intersection delay, and congestion
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

  return null; // Target unreachable via road network
}

// Subsystem: Full Road Network & Traffic Engine 2.0
export function simulateRoadNetworkAndTraffic(
  grid: TileData[][],
  employedCitizens: number,
  unlockedUpgrades: string[]
): CommuterTripResult {
  const height = grid.length;
  const width = grid[0].length;

  const graph = buildRoadGraph(grid, unlockedUpgrades);
  const roadLoadMap = new Map<string, number>();
  const connectedZoneAccess = new Map<string, boolean>();
  const workplaceProductivity = new Map<string, number>();

  if (graph.roadCount === 0) {
    // No roads exist in the city
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
    };
  }

  // 1. Identify Residential Origins with population and road access
  const residentialOrigins: { x: number; y: number; roadKey: string; workers: number }[] = [];
  let totalCommuters = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      const zoneKey = `${x},${y}`;

      if (tile.type === TileType.RESIDENTIAL) {
        const roadKey = getAdjacentRoadNodeKey(x, y, graph);
        if (roadKey && !tile.abandoned && tile.population > 0) {
          connectedZoneAccess.set(zoneKey, true);
          // Fraction of workers seeking commute
          const commuters = Math.max(1, Math.round(tile.population * 0.65));
          residentialOrigins.push({ x, y, roadKey, workers: commuters });
          totalCommuters += commuters;
        } else {
          connectedZoneAccess.set(zoneKey, false);
        }
      }
    }
  }

  // 2. Identify Commercial and Industrial Destinations with available jobs
  const workplaceDestinations: { x: number; y: number; roadKey: string; jobs: number; zoneKey: string }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      const zoneKey = `${x},${y}`;

      if (tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL) {
        const roadKey = getAdjacentRoadNodeKey(x, y, graph);
        if (roadKey && !tile.abandoned) {
          connectedZoneAccess.set(zoneKey, true);
          if (tile.jobs > 0) {
            workplaceDestinations.push({ x, y, roadKey, jobs: tile.jobs, zoneKey });
          }
        } else {
          connectedZoneAccess.set(zoneKey, false);
          tile.productivity = 0;
          workplaceProductivity.set(zoneKey, 0);
        }
      }
    }
  }

  // Transit modifiers
  const hasBikeLanes = unlockedUpgrades.includes('bike_lanes');
  const hasBusNetwork = unlockedUpgrades.includes('bus_network');
  const hasTramSystem = unlockedUpgrades.includes('tram_system');

  let totalTripTime = 0;
  let totalRoutedTrips = 0;

  // 3. Route Commuters using A* Pathfinding
  if (residentialOrigins.length > 0 && workplaceDestinations.length > 0) {
    // Route from each residential neighborhood to suitable workplaces
    for (const origin of residentialOrigins) {
      // Find closest reachable workplace
      let bestPathResult: { path: string[]; travelTime: number; destKey: string } | null = null;
      
      // Sort destinations by manhattan distance
      const sortedDestinations = [...workplaceDestinations].sort((a, b) => {
        const distA = Math.abs(origin.x - a.x) + Math.abs(origin.y - a.y);
        const distB = Math.abs(origin.x - b.x) + Math.abs(origin.y - b.y);
        return distA - distB;
      });

      for (const dest of sortedDestinations) {
        const pathRes = findAStarRoadPath(origin.roadKey, dest.roadKey, graph, roadLoadMap, unlockedUpgrades);
        if (pathRes) {
          bestPathResult = { ...pathRes, destKey: dest.zoneKey };
          break; // Stop at first reachable destination, which is the closest by direct distance
        }
      }

      if (bestPathResult) {
        const path = bestPathResult.path;
        let vehicleVolume = origin.workers;

        // Apply transit upgrades
        if (hasBikeLanes && path.length <= GAME_CONFIG.ROAD_NETWORK.BIKE_LANE_MAX_DIST) {
          vehicleVolume *= (1 - GAME_CONFIG.ROAD_NETWORK.BIKE_LANE_ABSORPTION);
        }
        if (hasBusNetwork) {
          vehicleVolume *= (1 - GAME_CONFIG.ROAD_NETWORK.BUS_NETWORK_REDUCTION);
        }
        if (hasTramSystem) {
          vehicleVolume *= (1 - GAME_CONFIG.ROAD_NETWORK.TRAM_SYSTEM_REDUCTION);
        }

        vehicleVolume = Math.max(0.5, vehicleVolume);

        // Accumulate load on each road tile along the path
        for (const roadKey of path) {
          const prev = roadLoadMap.get(roadKey) || 0;
          roadLoadMap.set(roadKey, prev + vehicleVolume);
        }

        totalTripTime += bestPathResult.travelTime * origin.workers;
        totalRoutedTrips += origin.workers;
      }
    }
  }

  // 4. Calculate Road Congestion, Tile Traffic, and Average Statistics
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

          const congestionRatio = volume > capacity ? (volume - capacity) / capacity : 0;
          if (congestionRatio > 0.1) {
            congestedRoadsCount++;
          }

          // Compute traffic visual metric (0 to 100)
          // 0-50 represents volume up to capacity; 50-100 represents congestion
          const loadFraction = Math.min(1.0, volume / capacity);
          const trafficScore = Math.round(loadFraction * 50 + Math.min(50, congestionRatio * 50));
          tile.traffic = Math.max(0, Math.min(100, trafficScore));
          totalTrafficSum += tile.traffic;
        } else {
          tile.traffic = 0;
        }
      } else {
        tile.traffic = 0;
      }
    }
  }

  const averageTraffic = graph.roadCount > 0 ? totalTrafficSum / graph.roadCount : 0;
  const congestionIndex = graph.roadCount > 0 ? Math.round((congestedRoadsCount / graph.roadCount) * 100) : 0;
  const averageCommuteTime = totalRoutedTrips > 0 ? totalTripTime / totalRoutedTrips : 0;

  // 5. Evaluate Workplace Productivity based on road access and surrounding congestion
  for (const dest of workplaceDestinations) {
    const destRoadTraffic = grid[dest.y][dest.x]?.type === TileType.ROAD 
      ? grid[dest.y][dest.x].traffic 
      : (graph.nodes.get(dest.roadKey) ? (roadLoadMap.get(dest.roadKey) || 0) : 0);

    const roadNode = graph.nodes.get(dest.roadKey);
    const capacity = roadNode ? roadNode.capacity : 20;
    const destCongestion = Math.max(0, (destRoadTraffic - capacity) / capacity);

    // Productivity scales from 100% down to 30% under severe traffic gridlock
    const productivity = Math.max(30, Math.min(100, Math.round(100 - destCongestion * 40)));
    grid[dest.y][dest.x].productivity = productivity;
    workplaceProductivity.set(dest.zoneKey, productivity);
  }

  return {
    roadTrafficMap: roadLoadMap,
    averageTraffic: Number(averageTraffic.toFixed(1)),
    averageCommuteTime: Number(averageCommuteTime.toFixed(1)),
    congestionIndex,
    workplaceProductivity,
    connectedZoneAccess,
  };
}
