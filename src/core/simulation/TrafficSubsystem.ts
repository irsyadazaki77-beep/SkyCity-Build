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
  elevation: number;
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
  logisticsEfficiency: number; // 0 to 100%
  goodsSupplyIndex: number;    // 0 to 100%
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

          const elevation = grid[y][x].elevation || 0;

          this.graph.nodes.set(key, {
            x, y, key, neighbors,
            degree: neighbors.length,
            isIntersection,
            capacity: baseCapacity,
            elevation,
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

    const elevation = grid[y]?.[x]?.elevation || 0;

    this.graph.nodes.set(key, {
      x, y, key, neighbors,
      degree: neighbors.length,
      isIntersection,
      capacity: baseCapacity,
      elevation,
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
      this.pathCache.delete(key);
      this.pathCache.set(key, entry);
      return entry;
    }
    this.cacheMisses++;
    return null;
  }

  public setCachedPath(startKey: string, targetKey: string, result: { path: string[]; travelTime: number }): void {
    const key = `${startKey}->${targetKey}`;
    if (this.pathCache.size >= 3000) {
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
    roadLoadMap: Map<string, number>,
    vehicleWeight: number = 1.0
  ): { path: string[]; travelTime: number } | null {
    if (startKey === targetKey) {
      return { path: [startKey], travelTime: 0.5 };
    }

    const startNode = this.graph.nodes.get(startKey);
    const targetNode = this.graph.nodes.get(targetKey);
    if (!startNode || !targetNode) return null;

    // Fast cache lookup when road load is low/moderate
    const cached = this.getCachedPath(startKey, targetKey);
    if (cached) {
      // Calculate dynamic travel time based on current road loads along cached path
      let dynamicTime = 0;
      let hasSevereGridlock = false;
      for (const rk of cached.path) {
        const node = this.graph.nodes.get(rk);
        if (!node) {
          this.pathCache.delete(`${startKey}->${targetKey}`);
          break;
        }
        const load = roadLoadMap.get(rk) || 0;
        const ratio = load / (node.capacity || 20);
        if (ratio > 1.4) {
          hasSevereGridlock = true;
        }
        dynamicTime += 1.0 + (node.isIntersection ? 0.4 : 0) + Math.pow(Math.max(0, ratio), 2) * 2.0;
      }

      // If no sudden severe gridlock on cached path, use cached path with dynamic travel time
      if (!hasSevereGridlock) {
        return { path: cached.path, travelTime: dynamicTime };
      }
    }

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
        const totalTravelTime = gScore.get(targetKey) || path.length;
        const result = { path, travelTime: totalTravelTime };
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
        const congestionRatio = currentLoad / (neighborNode.capacity || 20);

        // Realistic non-linear BPR congestion cost: edgeCost = base + intersection + congestion penalty
        const congestionCost = Math.pow(Math.max(0, congestionRatio), 2.2) * 2.5;
        const edgeCost = baseSpeedMult + (neighborNode.isIntersection ? intersectionPenalty : 0) + congestionCost;

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
    unlockedUpgrades: string[] = [],
    roadBudgetPercent = 100,
    roadCondition = 100
  ): TrafficSimulationResult {
    const height = grid.length;
    const width = grid[0]?.length || 0;

    this.roadNetwork.rebuildFull(grid, unlockedUpgrades);
    const graph = this.roadNetwork.getGraph();

    // Road Condition & Maintenance Quality impact on capacity & travel speed
    const roadQualityMult = Math.max(0.5, Math.min(1.2, (roadCondition / 100) * (0.8 + 0.2 * (roadBudgetPercent / 100))));
    for (const node of graph.nodes.values()) {
      node.capacity = Math.max(8, Math.round(node.capacity * roadQualityMult));
    }

    const roadLoadMap = new Map<string, number>();
    const connectedZoneAccess = new Map<string, boolean>();
    const workplaceProductivity = new Map<string, number>();
    const simulatedVehicles: SimulatedVehicle[] = [];
    const simulatedPedestrians: SimulatedPedestrian[] = [];

    // If no roads exist in the city
    if (graph.roadCount === 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = grid[y][x];
          tile.traffic = 0;
          tile.commuteTime = 0;
          tile.goodsStock = 0;
          tile.logisticsSatisfaction = 0;
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
        logisticsEfficiency: 0,
        goodsSupplyIndex: 0,
        workplaceProductivity: new Map(),
        connectedZoneAccess: new Map(),
        activeVehicles: [],
        activePedestrians: [],
      };
    }

    // 1. Gather Residential Origins
    interface ResidentialOrigin {
      x: number;
      y: number;
      roadKey: string;
      commuters: number;
      zoneKey: string;
    }
    const residentialOrigins: ResidentialOrigin[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const zoneKey = `${x},${y}`;

        if (tile.type === TileType.RESIDENTIAL) {
          const roadKey = getAdjacentRoadNodeKey(x, y, graph);
          if (roadKey && !tile.abandoned && (tile.population || 0) > 0 && tile.powered && tile.watered) {
            connectedZoneAccess.set(zoneKey, true);
            const commuters = Math.max(1, Math.round((tile.population || 0) * GAME_CONFIG.WORKING_AGE_RATIO));
            residentialOrigins.push({ x, y, roadKey, commuters, zoneKey });
          } else {
            connectedZoneAccess.set(zoneKey, false);
            tile.commuteTime = 0;
          }
        }
      }
    }

    // 2. Gather Workplace Destinations
    interface WorkplaceDestination {
      x: number;
      y: number;
      roadKey: string;
      totalJobs: number;
      remainingJobs: number;
      workersFilled: number;
      zoneKey: string;
      type: TileType;
      level: number;
      totalCommuteTime: number;
    }
    const workplaceDestinations: WorkplaceDestination[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const zoneKey = `${x},${y}`;

        if (tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL) {
          const roadKey = getAdjacentRoadNodeKey(x, y, graph);
          if (roadKey && !tile.abandoned && tile.powered && tile.watered) {
            connectedZoneAccess.set(zoneKey, true);
            const jobs = tile.jobs || 0;
            if (jobs > 0) {
              workplaceDestinations.push({
                x,
                y,
                roadKey,
                totalJobs: jobs,
                remainingJobs: jobs,
                workersFilled: 0,
                zoneKey,
                type: tile.type,
                level: tile.level || 1,
                totalCommuteTime: 0,
              });
            }
          } else {
            connectedZoneAccess.set(zoneKey, false);
            tile.productivity = 0;
            tile.goodsStock = 0;
            tile.logisticsSatisfaction = 0;
            tile.commuteTime = 0;
            workplaceProductivity.set(zoneKey, 0);
          }
        }
      }
    }

    const hasBikeLanes = unlockedUpgrades.includes('bike_lanes');
    const hasBusNetwork = unlockedUpgrades.includes('bus_network');
    const hasTramSystem = unlockedUpgrades.includes('tram_system');

    let totalTripTime = 0;
    let totalRoutedCommuters = 0;

    // Refined, modern automotive color palette for believable city traffic
    const VEHICLE_COLORS = [
      '#f8fafc', // Glacier White Pearl
      '#334155', // Charcoal Slate Metallic
      '#1e293b', // Obsidian Black
      '#1d4ed8', // Royal Midnight Blue
      '#0284c7', // Ocean Metallic
      '#b91c1c', // Crimson Red
      '#991b1b', // Deep Burgundy
      '#15803d', // Racing Forest Green
      '#64748b', // Modern Steel Gray
      '#d97706', // Amber Bronze
      '#475569', // Pewter Titanium
      '#e2e8f0', // Crisp Silver
    ];

    // 3. Commuter Trip Routing (Residential -> Commercial / Industrial)
    if (residentialOrigins.length > 0 && workplaceDestinations.length > 0) {
      for (const origin of residentialOrigins) {
        let workersToRoute = origin.commuters;
        let originTripTime = 0;
        let originTripsCount = 0;

        while (workersToRoute > 0) {
          const availableDests = workplaceDestinations.filter((d) => d.remainingJobs > 0);
          if (availableDests.length === 0) break;

          // Rank destinations by Manhattan proximity to reduce search overhead
          availableDests.sort((a, b) => {
            const distA = Math.abs(origin.x - a.x) + Math.abs(origin.y - a.y);
            const distB = Math.abs(origin.x - b.x) + Math.abs(origin.y - b.y);
            return distA - distB;
          });

          let routeSuccess = false;
          // Check top 3 closest available workplaces
          const candidates = availableDests.slice(0, 3);
          for (const dest of candidates) {
            const pathRes = this.roadNetwork.findAStarRoadPath(origin.roadKey, dest.roadKey, roadLoadMap, 1.0);
            if (pathRes && pathRes.path.length > 0) {
              const batchSize = Math.min(workersToRoute, dest.remainingJobs);
              dest.remainingJobs -= batchSize;
              dest.workersFilled += batchSize;
              dest.totalCommuteTime += pathRes.travelTime * batchSize;
              workersToRoute -= batchSize;

              // Calculate traffic volume reduction from transit/bike lanes
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
              vehicleVolume = Math.max(0.4, vehicleVolume);

              for (const roadKey of pathRes.path) {
                const prev = roadLoadMap.get(roadKey) || 0;
                roadLoadMap.set(roadKey, prev + vehicleVolume);
              }

              totalTripTime += pathRes.travelTime * batchSize;
              totalRoutedCommuters += batchSize;
              originTripTime += pathRes.travelTime * batchSize;
              originTripsCount += batchSize;

              // Spawn representative visual commuter vehicles
              if (simulatedVehicles.length < 50 && pathRes.path.length >= 2) {
                const waypoints: [number, number, number][] = pathRes.path.map((key) => {
                  const [px, py] = key.split(',').map(Number);
                  const el = grid[py]?.[px]?.elevation || 0;
                  return [px, el * 0.45 + 0.1, py];
                });

                const isBus = hasBusNetwork && Math.random() < 0.25;
                simulatedVehicles.push({
                  id: this.vehicleIdCounter++,
                  type: isBus ? 'bus' : 'car',
                  path: waypoints,
                  currentWaypointIndex: 0,
                  progress: Math.random(),
                  speed: isBus ? 0.75 : 0.95 + Math.random() * 0.35,
                  color: isBus ? '#3b82f6' : VEHICLE_COLORS[this.vehicleIdCounter % VEHICLE_COLORS.length],
                  originKey: origin.zoneKey,
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

        // Set average commute time for residential origin
        const resTile = grid[origin.y][origin.x];
        resTile.commuteTime = originTripsCount > 0 ? Number((originTripTime / originTripsCount).toFixed(1)) : 0;
      }
    }

    // 4. Logistics & Goods Distribution (Industrial -> Commercial)
    // Industrial factories produce freight goods that must be distributed to commercial shops.
    interface IndustrialProducer {
      x: number;
      y: number;
      roadKey: string;
      zoneKey: string;
      goodsOutput: number;
      remainingGoods: number;
      shippedGoods: number;
      level: number;
    }
    const industrialProducers: IndustrialProducer[] = [];

    interface CommercialConsumer {
      x: number;
      y: number;
      roadKey: string;
      zoneKey: string;
      goodsDemand: number;
      goodsReceived: number;
      level: number;
    }
    const commercialConsumers: CommercialConsumer[] = [];

    for (const dest of workplaceDestinations) {
      if (dest.type === TileType.INDUSTRIAL) {
        const workerRatio = dest.totalJobs > 0 ? dest.workersFilled / dest.totalJobs : 0;
        const output = Math.max(1, Math.round(dest.totalJobs * (0.8 + dest.level * 0.3) * workerRatio));
        industrialProducers.push({
          x: dest.x,
          y: dest.y,
          roadKey: dest.roadKey,
          zoneKey: dest.zoneKey,
          goodsOutput: output,
          remainingGoods: output,
          shippedGoods: 0,
          level: dest.level,
        });
      } else if (dest.type === TileType.COMMERCIAL) {
        const demand = Math.max(1, Math.round(dest.totalJobs * (0.7 + dest.level * 0.4)));
        commercialConsumers.push({
          x: dest.x,
          y: dest.y,
          roadKey: dest.roadKey,
          zoneKey: dest.zoneKey,
          goodsDemand: demand,
          goodsReceived: 0,
          level: dest.level,
        });
      }
    }

    let totalGoodsDemanded = 0;
    let totalGoodsDelivered = 0;

    if (commercialConsumers.length > 0) {
      for (const com of commercialConsumers) {
        totalGoodsDemanded += com.goodsDemand;
        let demandRemaining = com.goodsDemand;

        if (industrialProducers.length > 0) {
          // Sort industrial producers by proximity
          const availableProducers = industrialProducers.filter((p) => p.remainingGoods > 0);
          availableProducers.sort((a, b) => {
            const distA = Math.abs(com.x - a.x) + Math.abs(com.y - a.y);
            const distB = Math.abs(com.x - b.x) + Math.abs(com.y - b.y);
            return distA - distB;
          });

          for (const ind of availableProducers) {
            if (demandRemaining <= 0) break;

            // Route freight delivery truck with heavier road load weight (1.5x)
            const pathRes = this.roadNetwork.findAStarRoadPath(ind.roadKey, com.roadKey, roadLoadMap, 1.5);
            if (pathRes && pathRes.path.length > 0) {
              const shipmentSize = Math.min(demandRemaining, ind.remainingGoods);
              ind.remainingGoods -= shipmentSize;
              ind.shippedGoods += shipmentSize;
              com.goodsReceived += shipmentSize;
              demandRemaining -= shipmentSize;
              totalGoodsDelivered += shipmentSize;

              // Heavy freight adds noticeable load to traversed roads
              const freightLoad = Math.max(0.6, shipmentSize * 1.3);
              for (const roadKey of pathRes.path) {
                const prev = roadLoadMap.get(roadKey) || 0;
                roadLoadMap.set(roadKey, prev + freightLoad);
              }

              // Spawn representative logistics freight trucks
              if (simulatedVehicles.length < 75 && pathRes.path.length >= 2) {
                const waypoints: [number, number, number][] = pathRes.path.map((key) => {
                  const [px, py] = key.split(',').map(Number);
                  const el = grid[py]?.[px]?.elevation || 0;
                  return [px, el * 0.45 + 0.1, py];
                });

                simulatedVehicles.push({
                  id: this.vehicleIdCounter++,
                  type: 'truck',
                  path: waypoints,
                  currentWaypointIndex: 0,
                  progress: Math.random(),
                  speed: 0.65 + Math.random() * 0.25,
                  color: '#f59e0b', // Amber freight truck
                  originKey: ind.zoneKey,
                  destinationKey: com.zoneKey,
                  purpose: 'freight',
                });
              }
            }
          }
        }
      }
    }

    // 5. Update Tile Productivities, Goods Stock, and Logistics Satisfaction
    let totalGoodsStockSum = 0;
    let commercialTilesCount = 0;

    for (const dest of workplaceDestinations) {
      const tile = grid[dest.y][dest.x];
      const workerFillRate = dest.totalJobs > 0 ? dest.workersFilled / dest.totalJobs : 0;
      const avgCommuteForTile = dest.workersFilled > 0 ? dest.totalCommuteTime / dest.workersFilled : 5;
      tile.commuteTime = Number(avgCommuteForTile.toFixed(1));

      // Commute delay factor: severe traffic delay lowers worker productivity
      let commuteFactor = 1.0;
      if (avgCommuteForTile > 12) {
        commuteFactor = Math.max(0.65, 1.0 - (avgCommuteForTile - 12) * 0.035);
      } else if (avgCommuteForTile > 6) {
        commuteFactor = Math.max(0.85, 1.0 - (avgCommuteForTile - 6) * 0.025);
      }

      if (dest.type === TileType.COMMERCIAL) {
        commercialTilesCount++;
        const comConsumer = commercialConsumers.find((c) => c.zoneKey === dest.zoneKey);
        const supplyRate = comConsumer && comConsumer.goodsDemand > 0
          ? comConsumer.goodsReceived / comConsumer.goodsDemand
          : 0;

        // Goods stock is replenished by supply rate, decaying if undersupplied
        const targetStock = Math.round(supplyRate * 100);
        const prevStock = tile.goodsStock ?? 80;
        const currentStock = Math.round(prevStock * 0.5 + targetStock * 0.5);
        tile.goodsStock = currentStock;
        totalGoodsStockSum += currentStock;

        tile.logisticsSatisfaction = Math.round(supplyRate * 100);

        // Commercial productivity depends on:
        // 1. Worker fill rate
        // 2. Commute punctuality
        // 3. Goods inventory available to sell (supply shortage causes drastic drop in store productivity)
        const goodsFactor = 0.35 + 0.65 * (currentStock / 100);
        const prod = Math.round(Math.min(100, Math.max(15, workerFillRate * 100 * commuteFactor * goodsFactor)));
        tile.productivity = prod;
        workplaceProductivity.set(dest.zoneKey, prod);

      } else if (dest.type === TileType.INDUSTRIAL) {
        const indProducer = industrialProducers.find((p) => p.zoneKey === dest.zoneKey);
        const shippingRate = indProducer && indProducer.goodsOutput > 0
          ? indProducer.shippedGoods / indProducer.goodsOutput
          : 0.5;

        const logisticsSatisfaction = Math.round(shippingRate * 100);
        tile.logisticsSatisfaction = logisticsSatisfaction;
        tile.goodsStock = Math.round((1 - shippingRate) * 100); // Raw/output storage

        // Industrial productivity depends on:
        // 1. Worker fill rate
        // 2. Commute punctuality
        // 3. Logistics distribution throughput (if unable to ship, warehouse congestion blocks production)
        const logisticsFactor = 0.45 + 0.55 * (logisticsSatisfaction / 100);
        const prod = Math.round(Math.min(100, Math.max(20, workerFillRate * 100 * commuteFactor * logisticsFactor)));
        tile.productivity = prod;
        workplaceProductivity.set(dest.zoneKey, prod);
      }
    }

    // 6. Generate Sidewalk Pedestrians along active roads
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type === TileType.ROAD && simulatedPedestrians.length < 45) {
          const traffic = roadLoadMap.get(`${x},${y}`) || 0;
          if (traffic > 1 && Math.random() < 0.28) {
            simulatedPedestrians.push({
              id: this.pedestrianIdCounter++,
              startX: x - 0.4 + Math.random() * 0.8,
              startZ: y - 0.4 + Math.random() * 0.8,
              targetX: x + (Math.random() < 0.5 ? 0.38 : -0.38),
              targetZ: y + (Math.random() < 0.5 ? 0.38 : -0.38),
              progress: Math.random(),
              speed: 0.22 + Math.random() * 0.15,
              color: VEHICLE_COLORS[this.pedestrianIdCounter % VEHICLE_COLORS.length],
            });
          }
        }
      }
    }

    // 7. Aggregate Road Network Statistics
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
            const capacity = node.capacity || 20;
            const ratio = volume / capacity;

            if (ratio > 0.80) {
              congestedRoadsCount++;
            }

            const trafficScore = Math.min(100, Math.round(ratio * 100));
            tile.traffic = trafficScore;
            totalTrafficSum += trafficScore;
          }
        }
      }
    }

    const roadCount = graph.roadCount || 1;
    const averageTraffic = Math.round(totalTrafficSum / roadCount);
    const averageCommuteTime = totalRoutedCommuters > 0 ? Number((totalTripTime / totalRoutedCommuters).toFixed(1)) : 0;
    const congestionIndex = Math.round((congestedRoadsCount / roadCount) * 100);

    const logisticsEfficiency = totalGoodsDemanded > 0
      ? Math.round((totalGoodsDelivered / totalGoodsDemanded) * 100)
      : (industrialProducers.length > 0 ? 100 : 50);

    const goodsSupplyIndex = commercialTilesCount > 0
      ? Math.round(totalGoodsStockSum / commercialTilesCount)
      : 80;

    return {
      roadTrafficMap: roadLoadMap,
      averageTraffic,
      averageCommuteTime,
      congestionIndex,
      logisticsEfficiency,
      goodsSupplyIndex,
      workplaceProductivity,
      connectedZoneAccess,
      activeVehicles: simulatedVehicles,
      activePedestrians: simulatedPedestrians,
    };
  }
}
