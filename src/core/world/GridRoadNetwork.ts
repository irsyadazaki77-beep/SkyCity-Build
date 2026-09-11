import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { gridToWorld, TILE_SIZE } from '../../components/world/types3D';

export interface RoadGeometryBatch {
  asphaltGeo: THREE.BufferGeometry;
  markingsGeo: THREE.BufferGeometry;
  curbGeo: THREE.BufferGeometry;
  bridgeGeo: THREE.BufferGeometry;
  debugGeo: THREE.BufferGeometry;
}

// Single unified road width across all templates, straight, corner, T-junction, 4-way, and bridge
export const ROAD_WIDTH = 0.72;
export const HALF_ROAD_WIDTH = ROAD_WIDTH / 2; // 0.36
export const LANE_WIDTH = ROAD_WIDTH / 2; // 0.36 (two equal lanes)
export const LANE_OFFSET = LANE_WIDTH / 2; // 0.18 (lane center from road centerline)
export const HALF_TILE = TILE_SIZE / 2; // 0.50

// Vertical height offsets to strictly prevent z-fighting:
// asphalt Y (0.060) < marking Y (0.065) < vehicle wheel contact (0.075)
export const TERRAIN_LAND_OFFSET = 0.04;
export const ASPHALT_OFFSET = 0.02;
export const ROAD_ASPHALT_Y_OFFSET = TERRAIN_LAND_OFFSET + ASPHALT_OFFSET; // 0.060
export const ROAD_MARKING_Y_OFFSET = ROAD_ASPHALT_Y_OFFSET + 0.005; // 0.065
export const VEHICLE_Y_OFFSET = ROAD_ASPHALT_Y_OFFSET + 0.015; // 0.075

/**
 * Computes road surface Y for any grid cell (x, y).
 * If the road spans water (bridge), matches the elevation of connected land road neighbors
 * so bridges never dip into the riverbed or water surface.
 */
export function getRoadSurfaceY(grid: TileData[][], x: number, y: number): number {
  if (!grid || y < 0 || y >= grid.length || x < 0 || x >= (grid[0]?.length || 0)) {
    return ROAD_ASPHALT_Y_OFFSET;
  }
  const tile = grid[y]?.[x];
  let el = (tile?.elevation || 0) * 0.45;
  if (tile?.water) {
    // Determine bridge deck elevation from connected road neighbors
    const neighbors = [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
    let maxAdj = el;
    for (const [nx, ny] of neighbors) {
      if (grid[ny]?.[nx]?.type === TileType.ROAD) {
        maxAdj = Math.max(maxAdj, (grid[ny]?.[nx]?.elevation || 0) * 0.45);
      }
    }
    el = maxAdj;
  }
  return el + ROAD_ASPHALT_Y_OFFSET;
}

export class GridRoadNetwork {
  public static generateChunkRoadGeometry(
    grid: TileData[][],
    gridWidth: number,
    gridHeight: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): RoadGeometryBatch {
    const asphaltGeos: THREE.BufferGeometry[] = [];
    const markingsGeos: THREE.BufferGeometry[] = [];
    const curbGeos: THREE.BufferGeometry[] = [];
    const bridgeGeos: THREE.BufferGeometry[] = [];

    // Debug line buffers: [pos...] and [col...]
    const debugPositions: number[] = [];
    const debugColors: number[] = [];

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return grid[y]?.[x]?.type === TileType.ROAD;
    };

    const isWater = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return !!grid[y]?.[x]?.water;
    };

    const getElevation = (x: number, y: number): number => {
      return getRoadSurfaceY(grid, x, y) - ROAD_ASPHALT_Y_OFFSET;
    };

    // Helper: add horizontal plane facing +Y with exact bounds
    const addRectPlane = (
      geos: THREE.BufferGeometry[],
      minXW: number,
      maxXW: number,
      minZW: number,
      maxZW: number,
      y: number
    ) => {
      const w = Math.max(0.001, maxXW - minXW);
      const d = Math.max(0.001, maxZW - minZW);
      const cx = (minXW + maxXW) / 2;
      const cz = (minZW + maxZW) / 2;
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      geo.translate(cx, y, cz);
      geos.push(geo);
    };

    // Helper: add axis-aligned 3D box
    const addBox3D = (
      geos: THREE.BufferGeometry[],
      minXW: number,
      maxXW: number,
      minYW: number,
      maxYW: number,
      minZW: number,
      maxZW: number
    ) => {
      const w = Math.max(0.001, maxXW - minXW);
      const h = Math.max(0.001, maxYW - minYW);
      const d = Math.max(0.001, maxZW - minZW);
      const cx = (minXW + maxXW) / 2;
      const cy = (minYW + maxYW) / 2;
      const cz = (minZW + maxZW) / 2;
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(cx, cy, cz);
      geos.push(geo);
    };

    // Helper: add cylinder
    const addCylinder = (
      geos: THREE.BufferGeometry[],
      radiusTop: number,
      radiusBottom: number,
      height: number,
      cx: number,
      cy: number,
      cz: number,
      radialSegments = 16
    ) => {
      const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
      geo.translate(cx, cy, cz);
      geos.push(geo);
    };

    // Helper: add debug line segment
    const addDebugLine = (
      x1: number,
      y1: number,
      z1: number,
      x2: number,
      y2: number,
      z2: number,
      r: number,
      g: number,
      b: number
    ) => {
      debugPositions.push(x1, y1, z1, x2, y2, z2);
      debugColors.push(r, g, b, r, g, b);
    };

    const hw = HALF_ROAD_WIDTH; // 0.36
    const ht = HALF_TILE;       // 0.50
    const MARKING_W = 0.025;
    const halfMark = MARKING_W / 2;
    const curbHeight = 0.032;
    const curbWidth = 0.035;

    // Track straight road tiles that have been merged into continuous strips
    const processedStraightNS = new Set<string>();
    const processedStraightEW = new Set<string>();

    // =========================================================================
    // STEP 1: Process Continuous Straight Road Strips (NS and EW)
    // Straight roads are rendered as single continuous strips to eliminate internal seams.
    // =========================================================================

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isRoad(x, y)) continue;

        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);
        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);

        const isStraightNS = (nN && nS && !nE && !nW);
        const isStraightEW = (nE && nW && !nN && !nS);
        const water = isWater(x, y);
        const elevation = getElevation(x, y);

        // Continuous NS Straight
        if (isStraightNS && !processedStraightNS.has(`${x},${y}`)) {
          let endY = y;
          // Extend along straight NS tiles with same elevation and water status
          while (endY + 1 <= maxY && isRoad(x, endY + 1)) {
            const nextNN = isRoad(x, endY);
            const nextNS = isRoad(x, endY + 2);
            const nextNE = isRoad(x + 1, endY + 1);
            const nextNW = isRoad(x - 1, endY + 1);
            if (nextNN && nextNS && !nextNE && !nextNW && isWater(x, endY + 1) === water && Math.abs(getElevation(x, endY + 1) - elevation) < 0.001) {
              endY++;
            } else {
              break;
            }
          }

          const [wxStart, , wzStart] = gridToWorld(x, y, gridWidth, gridHeight);
          const [, , wzEnd] = gridToWorld(x, endY, gridWidth, gridHeight);
          const minZW = wzStart - ht;
          const maxZW = wzEnd + ht;
          const asphaltY = elevation + ROAD_ASPHALT_Y_OFFSET;
          const markY = elevation + ROAD_MARKING_Y_OFFSET;

          // Continuous Asphalt strip
          addRectPlane(asphaltGeos, wxStart - hw, wxStart + hw, minZW, maxZW, asphaltY);

          // Continuous Centerline
          addRectPlane(markingsGeos, wxStart - halfMark, wxStart + halfMark, minZW, maxZW, markY);

          // Curbs on land
          if (!water) {
            const curbY = elevation + TERRAIN_LAND_OFFSET;
            addBox3D(curbGeos, wxStart - hw - curbWidth, wxStart - hw, curbY, curbY + curbHeight, minZW, maxZW);
            addBox3D(curbGeos, wxStart + hw, wxStart + hw + curbWidth, curbY, curbY + curbHeight, minZW, maxZW);
          }

          // Debug overlay
          const dbgY = asphaltY + 0.004;
          // Road Edges (Amber)
          addDebugLine(wxStart - hw, dbgY + 0.002, minZW, wxStart - hw, dbgY + 0.002, maxZW, 1.0, 0.55, 0.0);
          addDebugLine(wxStart + hw, dbgY + 0.002, minZW, wxStart + hw, dbgY + 0.002, maxZW, 1.0, 0.55, 0.0);
          // Road Centerline (Sky Blue)
          addDebugLine(wxStart, dbgY + 0.004, minZW, wxStart, dbgY + 0.004, maxZW, 0.1, 0.85, 1.0);
          // Vehicle Lane Centerlines (Neon Green)
          addDebugLine(wxStart + LANE_OFFSET, dbgY + 0.006, minZW, wxStart + LANE_OFFSET, dbgY + 0.006, maxZW, 0.2, 1.0, 0.2);
          addDebugLine(wxStart - LANE_OFFSET, dbgY + 0.006, minZW, wxStart - LANE_OFFSET, dbgY + 0.006, maxZW, 0.2, 1.0, 0.2);

          for (let cy = y; cy <= endY; cy++) {
            processedStraightNS.add(`${x},${cy}`);
            // Tile Bounds (Cyan)
            const [, , curWz] = gridToWorld(x, cy, gridWidth, gridHeight);
            addDebugLine(wxStart - ht, dbgY, curWz - ht, wxStart + ht, dbgY, curWz - ht, 0.2, 0.65, 0.85);
            addDebugLine(wxStart + ht, dbgY, curWz - ht, wxStart + ht, dbgY, curWz + ht, 0.2, 0.65, 0.85);
            addDebugLine(wxStart + ht, dbgY, curWz + ht, wxStart - ht, dbgY, curWz + ht, 0.2, 0.65, 0.85);
            addDebugLine(wxStart - ht, dbgY, curWz + ht, wxStart - ht, dbgY, curWz - ht, 0.2, 0.65, 0.85);
          }
        }

        // Continuous EW Straight
        if (isStraightEW && !processedStraightEW.has(`${x},${y}`)) {
          let endX = x;
          while (endX + 1 <= maxX && isRoad(endX + 1, y)) {
            const nextNE = isRoad(endX + 2, y);
            const nextNW = isRoad(endX, y);
            const nextNN = isRoad(endX + 1, y - 1);
            const nextNS = isRoad(endX + 1, y + 1);
            if (nextNE && nextNW && !nextNN && !nextNS && isWater(endX + 1, y) === water && Math.abs(getElevation(endX + 1, y) - elevation) < 0.001) {
              endX++;
            } else {
              break;
            }
          }

          const [wxStart, , wzStart] = gridToWorld(x, y, gridWidth, gridHeight);
          const [wxEnd, , ] = gridToWorld(endX, y, gridWidth, gridHeight);
          const minXW = wxStart - ht;
          const maxXW = wxEnd + ht;
          const asphaltY = elevation + ROAD_ASPHALT_Y_OFFSET;
          const markY = elevation + ROAD_MARKING_Y_OFFSET;

          // Continuous Asphalt strip
          addRectPlane(asphaltGeos, minXW, maxXW, wzStart - hw, wzStart + hw, asphaltY);

          // Continuous Centerline
          addRectPlane(markingsGeos, minXW, maxXW, wzStart - halfMark, wzStart + halfMark, markY);

          // Curbs on land
          if (!water) {
            const curbY = elevation + TERRAIN_LAND_OFFSET;
            addBox3D(curbGeos, minXW, maxXW, curbY, curbY + curbHeight, wzStart - hw - curbWidth, wzStart - hw);
            addBox3D(curbGeos, minXW, maxXW, curbY, curbY + curbHeight, wzStart + hw, wzStart + hw + curbWidth);
          }

          // Debug overlay
          const dbgY = asphaltY + 0.004;
          // Road Edges (Amber)
          addDebugLine(minXW, dbgY + 0.002, wzStart - hw, maxXW, dbgY + 0.002, wzStart - hw, 1.0, 0.55, 0.0);
          addDebugLine(minXW, dbgY + 0.002, wzStart + hw, maxXW, dbgY + 0.002, wzStart + hw, 1.0, 0.55, 0.0);
          // Road Centerline (Sky Blue)
          addDebugLine(minXW, dbgY + 0.004, wzStart, maxXW, dbgY + 0.004, wzStart, 0.1, 0.85, 1.0);
          // Vehicle Lane Centerlines (Neon Green)
          addDebugLine(minXW, dbgY + 0.006, wzStart + LANE_OFFSET, maxXW, dbgY + 0.006, wzStart + LANE_OFFSET, 0.2, 1.0, 0.2);
          addDebugLine(minXW, dbgY + 0.006, wzStart - LANE_OFFSET, maxXW, dbgY + 0.006, wzStart - LANE_OFFSET, 0.2, 1.0, 0.2);

          for (let cx = x; cx <= endX; cx++) {
            processedStraightEW.add(`${cx},${y}`);
            // Tile Bounds (Cyan)
            const [curWx, , ] = gridToWorld(cx, y, gridWidth, gridHeight);
            addDebugLine(curWx - ht, dbgY, wzStart - ht, curWx + ht, dbgY, wzStart - ht, 0.2, 0.65, 0.85);
            addDebugLine(curWx + ht, dbgY, wzStart - ht, curWx + ht, dbgY, wzStart + ht, 0.2, 0.65, 0.85);
            addDebugLine(curWx + ht, dbgY, wzStart + ht, curWx - ht, dbgY, wzStart + ht, 0.2, 0.65, 0.85);
            addDebugLine(curWx - ht, dbgY, wzStart + ht, curWx - ht, dbgY, wzStart - ht, 0.2, 0.65, 0.85);
          }
        }
      }
    }

    // =========================================================================
    // STEP 2: Process All Other Connectivity Templates
    // - isolated
    // - dead-end (N, S, E, W)
    // - corner (NE, NW, SE, SW)
    // - T-junction (NSE, NSW, EWN, EWS)
    // - cross intersection
    // Every template has edge coordinates that IDENTICALLY match adjacent tile edges!
    // =========================================================================

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isRoad(x, y)) continue;

        // Skip if already processed in continuous straights
        if (processedStraightNS.has(`${x},${y}`) || processedStraightEW.has(`${x},${y}`)) continue;

        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);
        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);

        const water = isWater(x, y);
        const elevation = getElevation(x, y);
        const [wx, , wz] = gridToWorld(x, y, gridWidth, gridHeight);

        const asphaltY = elevation + ROAD_ASPHALT_Y_OFFSET;
        const markY = elevation + ROAD_MARKING_Y_OFFSET;
        const curbY = elevation + TERRAIN_LAND_OFFSET;
        const dbgY = asphaltY + 0.004;

        // Tile Bounds Debug Line (Cyan)
        addDebugLine(wx - ht, dbgY, wz - ht, wx + ht, dbgY, wz - ht, 0.2, 0.65, 0.85);
        addDebugLine(wx + ht, dbgY, wz - ht, wx + ht, dbgY, wz + ht, 0.2, 0.65, 0.85);
        addDebugLine(wx + ht, dbgY, wz + ht, wx - ht, dbgY, wz + ht, 0.2, 0.65, 0.85);
        addDebugLine(wx - ht, dbgY, wz + ht, wx - ht, dbgY, wz - ht, 0.2, 0.65, 0.85);

        // Helper to add asphalt sub-rectangle in local coordinates
        const addLocalRect = (lx1: number, lx2: number, lz1: number, lz2: number) => {
          addRectPlane(asphaltGeos, wx + lx1, wx + lx2, wz + lz1, wz + lz2, asphaltY);
        };

        // Helper to add marking sub-rectangle in local coordinates
        const addLocalMarking = (lx1: number, lx2: number, lz1: number, lz2: number) => {
          addRectPlane(markingsGeos, wx + lx1, wx + lx2, wz + lz1, wz + lz2, markY);
        };

        // Helper to add debug edge segment in local coordinates (Amber)
        const addEdgeLine = (lx1: number, lz1: number, lx2: number, lz2: number) => {
          addDebugLine(wx + lx1, dbgY + 0.002, wz + lz1, wx + lx2, dbgY + 0.002, wz + lz2, 1.0, 0.55, 0.0);
        };

        // Helper to add debug centerline in local coordinates (Sky Blue)
        const addCenterLine = (lx1: number, lz1: number, lx2: number, lz2: number) => {
          addDebugLine(wx + lx1, dbgY + 0.004, wz + lz1, wx + lx2, dbgY + 0.004, wz + lz2, 0.1, 0.85, 1.0);
        };

        // Helper to add debug lane centerline in local coordinates (Neon Green)
        const addLaneLine = (lx1: number, lz1: number, lx2: number, lz2: number) => {
          addDebugLine(wx + lx1, dbgY + 0.006, wz + lz1, wx + lx2, dbgY + 0.006, wz + lz2, 0.2, 1.0, 0.2);
        };

        // Helper to add curb in local coordinates
        const addLocalCurb = (lx1: number, lx2: number, lz1: number, lz2: number) => {
          if (!water) {
            addBox3D(curbGeos, wx + lx1, wx + lx2, curbY, curbY + curbHeight, wz + lz1, wz + lz2);
          }
        };

        const connCount = (nN ? 1 : 0) + (nS ? 1 : 0) + (nE ? 1 : 0) + (nW ? 1 : 0);

        if (connCount === 0) {
          // --- ISOLATED ROAD TILE ---
          addLocalRect(-hw, hw, -hw, hw);
          addEdgeLine(-hw, -hw, hw, -hw);
          addEdgeLine(hw, -hw, hw, hw);
          addEdgeLine(hw, hw, -hw, hw);
          addEdgeLine(-hw, hw, -hw, -hw);

          addLocalCurb(-hw - curbWidth, hw + curbWidth, -hw - curbWidth, -hw);
          addLocalCurb(-hw - curbWidth, hw + curbWidth, hw, hw + curbWidth);
          addLocalCurb(-hw - curbWidth, -hw, -hw, hw);
          addLocalCurb(hw, hw + curbWidth, -hw, hw);

        } else if (connCount === 1) {
          // --- DEAD-END TILES ---
          if (nN) {
            addLocalRect(-hw, hw, -ht, hw);
            addLocalMarking(-halfMark, halfMark, -ht, 0);

            addEdgeLine(-hw, -ht, -hw, hw);
            addEdgeLine(-hw, hw, hw, hw);
            addEdgeLine(hw, hw, hw, -ht);

            addCenterLine(0, -ht, 0, 0);
            addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, 0);
            addLaneLine(-LANE_OFFSET, -ht, -LANE_OFFSET, 0);

            addLocalCurb(-hw - curbWidth, -hw, -ht, hw);
            addLocalCurb(hw, hw + curbWidth, -ht, hw);
            addLocalCurb(-hw - curbWidth, hw + curbWidth, hw, hw + curbWidth);
          } else if (nS) {
            addLocalRect(-hw, hw, -hw, ht);
            addLocalMarking(-halfMark, halfMark, 0, ht);

            addEdgeLine(-hw, ht, -hw, -hw);
            addEdgeLine(-hw, -hw, hw, -hw);
            addEdgeLine(hw, -hw, hw, ht);

            addCenterLine(0, 0, 0, ht);
            addLaneLine(LANE_OFFSET, 0, LANE_OFFSET, ht);
            addLaneLine(-LANE_OFFSET, 0, -LANE_OFFSET, ht);

            addLocalCurb(-hw - curbWidth, -hw, -hw, ht);
            addLocalCurb(hw, hw + curbWidth, -hw, ht);
            addLocalCurb(-hw - curbWidth, hw + curbWidth, -hw - curbWidth, -hw);
          } else if (nW) {
            addLocalRect(-ht, hw, -hw, hw);
            addLocalMarking(-ht, 0, -halfMark, halfMark);

            addEdgeLine(-ht, -hw, hw, -hw);
            addEdgeLine(hw, -hw, hw, hw);
            addEdgeLine(hw, hw, -ht, hw);

            addCenterLine(-ht, 0, 0, 0);
            addLaneLine(-ht, LANE_OFFSET, 0, LANE_OFFSET);
            addLaneLine(-ht, -LANE_OFFSET, 0, -LANE_OFFSET);

            addLocalCurb(-ht, hw, -hw - curbWidth, -hw);
            addLocalCurb(-ht, hw, hw, hw + curbWidth);
            addLocalCurb(hw, hw + curbWidth, -hw - curbWidth, hw + curbWidth);
          } else if (nE) {
            addLocalRect(-hw, ht, -hw, hw);
            addLocalMarking(0, ht, -halfMark, halfMark);

            addEdgeLine(ht, -hw, -hw, -hw);
            addEdgeLine(-hw, -hw, -hw, hw);
            addEdgeLine(-hw, hw, ht, hw);

            addCenterLine(0, 0, ht, 0);
            addLaneLine(0, LANE_OFFSET, ht, LANE_OFFSET);
            addLaneLine(0, -LANE_OFFSET, ht, -LANE_OFFSET);

            addLocalCurb(-hw, ht, -hw - curbWidth, -hw);
            addLocalCurb(-hw, ht, hw, hw + curbWidth);
            addLocalCurb(-hw - curbWidth, -hw, -hw - curbWidth, hw + curbWidth);
          }

        } else if (connCount === 2) {
          // --- STRAIGHT OR CORNER TILES ---
          if (nN && nS) {
            // Single straight NS tile (when not merged)
            addLocalRect(-hw, hw, -ht, ht);
            addLocalMarking(-halfMark, halfMark, -ht, ht);

            addEdgeLine(-hw, -ht, -hw, ht);
            addEdgeLine(hw, -ht, hw, ht);

            addCenterLine(0, -ht, 0, ht);
            addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, ht);
            addLaneLine(-LANE_OFFSET, -ht, -LANE_OFFSET, ht);

            addLocalCurb(-hw - curbWidth, -hw, -ht, ht);
            addLocalCurb(hw, hw + curbWidth, -ht, ht);

          } else if (nE && nW) {
            // Single straight EW tile (when not merged)
            addLocalRect(-ht, ht, -hw, hw);
            addLocalMarking(-ht, ht, -halfMark, halfMark);

            addEdgeLine(-ht, -hw, ht, -hw);
            addEdgeLine(-ht, hw, ht, hw);

            addCenterLine(-ht, 0, ht, 0);
            addLaneLine(-ht, LANE_OFFSET, ht, LANE_OFFSET);
            addLaneLine(-ht, -LANE_OFFSET, ht, -LANE_OFFSET);

            addLocalCurb(-ht, ht, -hw - curbWidth, -hw);
            addLocalCurb(-ht, ht, hw, hw + curbWidth);

          } else if (nN && nE) {
            // CORNER NE: connects North boundary to East boundary
            addLocalRect(-hw, hw, -ht, hw); // North arm + center
            addLocalRect(hw, ht, -hw, hw);  // East extension

            addLocalMarking(-halfMark, halfMark, -ht, 0); // North marking
            addLocalMarking(0, ht, -halfMark, halfMark);  // East marking

            // Outer and inner edges
            addEdgeLine(-hw, -ht, -hw, hw); // West edge
            addEdgeLine(-hw, hw, ht, hw);   // South edge
            addEdgeLine(hw, -ht, hw, -hw);  // Inner North edge
            addEdgeLine(hw, -hw, ht, -hw);  // Inner East edge

            addCenterLine(0, -ht, 0, 0);
            addCenterLine(0, 0, ht, 0);
            addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, -LANE_OFFSET);
            addLaneLine(LANE_OFFSET, -LANE_OFFSET, ht, -LANE_OFFSET);
            addLaneLine(-LANE_OFFSET, -ht, -LANE_OFFSET, LANE_OFFSET);
            addLaneLine(-LANE_OFFSET, LANE_OFFSET, ht, LANE_OFFSET);

            addLocalCurb(-hw - curbWidth, -hw, -ht, hw + curbWidth);
            addLocalCurb(-hw - curbWidth, ht, hw, hw + curbWidth);
            addLocalCurb(hw, hw + curbWidth, -ht, -hw);
            addLocalCurb(hw, ht, -hw - curbWidth, -hw);

          } else if (nN && nW) {
            // CORNER NW: connects North boundary to West boundary
            addLocalRect(-hw, hw, -ht, hw);  // North arm + center
            addLocalRect(-ht, -hw, -hw, hw); // West extension

            addLocalMarking(-halfMark, halfMark, -ht, 0);
            addLocalMarking(-ht, 0, -halfMark, halfMark);

            addEdgeLine(hw, -ht, hw, hw);    // East edge
            addEdgeLine(hw, hw, -ht, hw);   // South edge
            addEdgeLine(-hw, -ht, -hw, -hw);// Inner North edge
            addEdgeLine(-hw, -hw, -ht, -hw);// Inner West edge

            addCenterLine(0, -ht, 0, 0);
            addCenterLine(0, 0, -ht, 0);
            addLaneLine(-LANE_OFFSET, -ht, -LANE_OFFSET, -LANE_OFFSET);
            addLaneLine(-LANE_OFFSET, -LANE_OFFSET, -ht, -LANE_OFFSET);
            addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, LANE_OFFSET);
            addLaneLine(LANE_OFFSET, LANE_OFFSET, -ht, LANE_OFFSET);

            addLocalCurb(hw, hw + curbWidth, -ht, hw + curbWidth);
            addLocalCurb(-ht, hw + curbWidth, hw, hw + curbWidth);
            addLocalCurb(-hw - curbWidth, -hw, -ht, -hw);
            addLocalCurb(-ht, -hw, -hw - curbWidth, -hw);

          } else if (nS && nE) {
            // CORNER SE: connects South boundary to East boundary
            addLocalRect(-hw, hw, -hw, ht); // South arm + center
            addLocalRect(hw, ht, -hw, hw);  // East extension

            addLocalMarking(-halfMark, halfMark, 0, ht);
            addLocalMarking(0, ht, -halfMark, halfMark);

            addEdgeLine(-hw, ht, -hw, -hw); // West edge
            addEdgeLine(-hw, -hw, ht, -hw); // North edge
            addEdgeLine(hw, ht, hw, hw);    // Inner South edge
            addEdgeLine(hw, hw, ht, hw);    // Inner East edge

            addCenterLine(0, 0, 0, ht);
            addCenterLine(0, 0, ht, 0);
            addLaneLine(LANE_OFFSET, 0, LANE_OFFSET, ht);
            addLaneLine(0, LANE_OFFSET, ht, LANE_OFFSET);

            addLocalCurb(-hw - curbWidth, -hw, -hw - curbWidth, ht);
            addLocalCurb(-hw - curbWidth, ht, -hw - curbWidth, -hw);
            addLocalCurb(hw, hw + curbWidth, hw, ht);
            addLocalCurb(hw, ht, hw, hw + curbWidth);

          } else if (nS && nW) {
            // CORNER SW: connects South boundary to West boundary
            addLocalRect(-hw, hw, -hw, ht);  // South arm + center
            addLocalRect(-ht, -hw, -hw, hw); // West extension

            addLocalMarking(-halfMark, halfMark, 0, ht);
            addLocalMarking(-ht, 0, -halfMark, halfMark);

            addEdgeLine(hw, ht, hw, -hw);    // East edge
            addEdgeLine(hw, -hw, -ht, -hw);  // North edge
            addEdgeLine(-hw, ht, -hw, hw);   // Inner South edge
            addEdgeLine(-hw, hw, -ht, hw);   // Inner West edge

            addCenterLine(0, 0, 0, ht);
            addCenterLine(0, 0, -ht, 0);
            addLaneLine(-LANE_OFFSET, 0, -LANE_OFFSET, ht);
            addLaneLine(0, LANE_OFFSET, -ht, LANE_OFFSET);

            addLocalCurb(hw, hw + curbWidth, -hw - curbWidth, ht);
            addLocalCurb(-ht, hw + curbWidth, -hw - curbWidth, -hw);
            addLocalCurb(-hw - curbWidth, -hw, hw, ht);
            addLocalCurb(-ht, -hw, hw, hw + curbWidth);
          }

        } else if (connCount === 3) {
          // --- T-JUNCTION TILES ---
          if (nN && nS && nE) {
            // T-junction NSE: continuous vertical strip + East branch
            addLocalRect(-hw, hw, -ht, ht);
            addLocalRect(hw, ht, -hw, hw);

            addLocalMarking(-halfMark, halfMark, -ht, ht);
            addLocalMarking(0, ht, -halfMark, halfMark);

            addEdgeLine(-hw, -ht, -hw, ht); // West outer edge
            addEdgeLine(hw, -ht, hw, -hw);  // North-East corner edge
            addEdgeLine(hw, -hw, ht, -hw);
            addEdgeLine(hw, ht, hw, hw);    // South-East corner edge
            addEdgeLine(hw, hw, ht, hw);

            addCenterLine(0, -ht, 0, ht);
            addCenterLine(0, 0, ht, 0);
            addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, ht);
            addLaneLine(-LANE_OFFSET, -ht, -LANE_OFFSET, ht);
            addLaneLine(0, LANE_OFFSET, ht, LANE_OFFSET);

            addLocalCurb(-hw - curbWidth, -hw, -ht, ht);
            addLocalCurb(hw, hw + curbWidth, -ht, -hw);
            addLocalCurb(hw, ht, -hw - curbWidth, -hw);
            addLocalCurb(hw, hw + curbWidth, hw, ht);
            addLocalCurb(hw, ht, hw, hw + curbWidth);

          } else if (nN && nS && nW) {
            // T-junction NSW: continuous vertical strip + West branch
            addLocalRect(-hw, hw, -ht, ht);
            addLocalRect(-ht, -hw, -hw, hw);

            addLocalMarking(-halfMark, halfMark, -ht, ht);
            addLocalMarking(-ht, 0, -halfMark, halfMark);

            addEdgeLine(hw, -ht, hw, ht);     // East outer edge
            addEdgeLine(-hw, -ht, -hw, -hw);  // North-West corner edge
            addEdgeLine(-hw, -hw, -ht, -hw);
            addEdgeLine(-hw, ht, -hw, hw);    // South-West corner edge
            addEdgeLine(-hw, hw, -ht, hw);

            addCenterLine(0, -ht, 0, ht);
            addCenterLine(0, 0, -ht, 0);
            addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, ht);
            addLaneLine(-LANE_OFFSET, -ht, -LANE_OFFSET, ht);
            addLaneLine(-ht, LANE_OFFSET, 0, LANE_OFFSET);

            addLocalCurb(hw, hw + curbWidth, -ht, ht);
            addLocalCurb(-hw - curbWidth, -hw, -ht, -hw);
            addLocalCurb(-ht, -hw, -hw - curbWidth, -hw);
            addLocalCurb(-hw - curbWidth, -hw, hw, ht);
            addLocalCurb(-ht, -hw, hw, hw + curbWidth);

          } else if (nE && nW && nN) {
            // T-junction EWN: continuous horizontal strip + North branch
            addLocalRect(-ht, ht, -hw, hw);
            addLocalRect(-hw, hw, -ht, -hw);

            addLocalMarking(-ht, ht, -halfMark, halfMark);
            addLocalMarking(-halfMark, halfMark, -ht, 0);

            addEdgeLine(-ht, hw, ht, hw);     // South outer edge
            addEdgeLine(-ht, -hw, -hw, -hw);  // West-North corner edge
            addEdgeLine(-hw, -hw, -hw, -ht);
            addEdgeLine(ht, -hw, hw, -hw);    // East-North corner edge
            addEdgeLine(hw, -hw, hw, -ht);

            addCenterLine(-ht, 0, ht, 0);
            addCenterLine(0, -ht, 0, 0);
            addLaneLine(-ht, LANE_OFFSET, ht, LANE_OFFSET);
            addLaneLine(-ht, -LANE_OFFSET, ht, -LANE_OFFSET);
            addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, 0);

            addLocalCurb(-ht, ht, hw, hw + curbWidth);
            addLocalCurb(-ht, -hw, -hw - curbWidth, -hw);
            addLocalCurb(-hw - curbWidth, -hw, -ht, -hw);
            addLocalCurb(hw, ht, -hw - curbWidth, -hw);
            addLocalCurb(hw, hw + curbWidth, -ht, -hw);

          } else if (nE && nW && nS) {
            // T-junction EWS: continuous horizontal strip + South branch
            addLocalRect(-ht, ht, -hw, hw);
            addLocalRect(-hw, hw, hw, ht);

            addLocalMarking(-ht, ht, -halfMark, halfMark);
            addLocalMarking(-halfMark, halfMark, 0, ht);

            addEdgeLine(-ht, -hw, ht, -hw);  // North outer edge
            addEdgeLine(-ht, hw, -hw, hw);   // West-South corner edge
            addEdgeLine(-hw, hw, -hw, ht);
            addEdgeLine(ht, hw, hw, hw);     // East-South corner edge
            addEdgeLine(hw, hw, hw, ht);

            addCenterLine(-ht, 0, ht, 0);
            addCenterLine(0, 0, 0, ht);
            addLaneLine(-ht, LANE_OFFSET, ht, LANE_OFFSET);
            addLaneLine(-ht, -LANE_OFFSET, ht, -LANE_OFFSET);
            addLaneLine(LANE_OFFSET, 0, LANE_OFFSET, ht);

            addLocalCurb(-ht, ht, -hw - curbWidth, -hw);
            addLocalCurb(-ht, -hw, hw, hw + curbWidth);
            addLocalCurb(-hw - curbWidth, -hw, hw, ht);
            addLocalCurb(hw, ht, hw, hw + curbWidth);
            addLocalCurb(hw, hw + curbWidth, hw, ht);
          }

        } else if (connCount === 4) {
          // --- 4-WAY CROSS INTERSECTION ---
          // Non-overlapping partitioning: vertical continuous strip + West arm + East arm
          addLocalRect(-hw, hw, -ht, ht);
          addLocalRect(-ht, -hw, -hw, hw);
          addLocalRect(hw, ht, -hw, hw);

          addLocalMarking(-halfMark, halfMark, -ht, ht);
          addLocalMarking(-ht, ht, -halfMark, halfMark);

          // 4 Corner boundary edges
          addEdgeLine(-hw, -ht, -hw, -hw);
          addEdgeLine(-hw, -hw, -ht, -hw);

          addEdgeLine(hw, -ht, hw, -hw);
          addEdgeLine(hw, -hw, ht, -hw);

          addEdgeLine(-hw, ht, -hw, hw);
          addEdgeLine(-hw, hw, -ht, hw);

          addEdgeLine(hw, ht, hw, hw);
          addEdgeLine(hw, hw, ht, hw);

          addCenterLine(0, -ht, 0, ht);
          addCenterLine(-ht, 0, ht, 0);
          addLaneLine(LANE_OFFSET, -ht, LANE_OFFSET, ht);
          addLaneLine(-LANE_OFFSET, -ht, -LANE_OFFSET, ht);
          addLaneLine(-ht, LANE_OFFSET, ht, LANE_OFFSET);
          addLaneLine(-ht, -LANE_OFFSET, ht, -LANE_OFFSET);

          addLocalCurb(-hw - curbWidth, -hw, -ht, -hw);
          addLocalCurb(-ht, -hw, -hw - curbWidth, -hw);

          addLocalCurb(hw, hw + curbWidth, -ht, -hw);
          addLocalCurb(hw, ht, -hw - curbWidth, -hw);

          addLocalCurb(-hw - curbWidth, -hw, hw, ht);
          addLocalCurb(-ht, -hw, hw, hw + curbWidth);

          addLocalCurb(hw, hw + curbWidth, hw, ht);
          addLocalCurb(hw, ht, hw, hw + curbWidth);
        }
      }
    }

    // =========================================================================
    // STEP 3: CONTINUOUS BRIDGE STRUCTURE GENERATION (Requirement 8)
    // - Deck is continuous along connected water road tiles (no separate boxes per tile)
    // - Railings follow bridge sides continuously
    // - Piers spaced every 3-4 tiles (NOT on every tile)
    // - Seamless abutment transition onto adjacent land tiles
    // =========================================================================

    const processedBridgeEW = new Set<string>();
    const processedBridgeNS = new Set<string>();
    const deckThickness = 0.08;
    const bridgeWidth = ROAD_WIDTH + 0.12; // 0.84
    const halfBridgeW = bridgeWidth / 2;   // 0.42
    const railingHeight = 0.14;
    const railingThickness = 0.03;

    // Scan for continuous EW Bridge Runs
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isRoad(x, y) || !isWater(x, y) || processedBridgeEW.has(`${x},${y}`) || processedBridgeNS.has(`${x},${y}`)) continue;

        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);
        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);

        const isEWBridge = (nE || nW) && !nN && !nS;
        const isNSBridge = (nN || nS) && !nE && !nW;

        if (isEWBridge) {
          // Find start and end of this EW bridge run on water
          let startX = x;
          while (startX - 1 >= 0 && isRoad(startX - 1, y) && isWater(startX - 1, y)) {
            startX--;
          }
          let endX = x;
          while (endX + 1 < gridWidth && isRoad(endX + 1, y) && isWater(endX + 1, y)) {
            endX++;
          }

          const elevation = getElevation(startX, y);
          const [wxStart, , wzStart] = gridToWorld(startX, y, gridWidth, gridHeight);
          const [wxEnd, , ] = gridToWorld(endX, y, gridWidth, gridHeight);

          // Extend slightly onto land abutments if land road neighbors exist
          const extendWest = isRoad(startX - 1, y) && !isWater(startX - 1, y) ? 0.06 : 0.0;
          const extendEast = isRoad(endX + 1, y) && !isWater(endX + 1, y) ? 0.06 : 0.0;

          const minXW = wxStart - ht - extendWest;
          const maxXW = wxEnd + ht + extendEast;
          const deckTopY = elevation + ROAD_ASPHALT_Y_OFFSET - 0.002;
          const deckCenterY = deckTopY - deckThickness / 2;

          // Continuous Bridge Deck Box
          addBox3D(bridgeGeos, minXW, maxXW, deckCenterY - deckThickness / 2, deckCenterY + deckThickness / 2, wzStart - halfBridgeW, wzStart + halfBridgeW);

          // Continuous Railings (North and South sides)
          const railCenterY = deckTopY + railingHeight / 2;
          addBox3D(bridgeGeos, minXW, maxXW, railCenterY - railingHeight / 2, railCenterY + railingHeight / 2, wzStart - halfBridgeW + railingThickness / 2, wzStart - halfBridgeW + railingThickness * 1.5);
          addBox3D(bridgeGeos, minXW, maxXW, railCenterY - railingHeight / 2, railCenterY + railingHeight / 2, wzStart + halfBridgeW - railingThickness * 1.5, wzStart + halfBridgeW - railingThickness / 2);

          // Piers spaced every 3 tiles along the span (NOT on every tile)
          const runLen = endX - startX + 1;
          const riverbedBottomY = -0.38;
          const pierHeight = Math.max(0.15, deckCenterY - deckThickness / 2 - riverbedBottomY);
          const pierCenterY = deckCenterY - deckThickness / 2 - pierHeight / 2;

          for (let px = startX; px <= endX; px++) {
            // Place pier every 3 tiles, or in middle if length < 3
            const offset = px - startX;
            const shouldPlacePier = (runLen <= 2 && offset === 0 && runLen === 1) ||
                                   (runLen === 2 && offset === 0) ||
                                   (runLen >= 3 && (offset % 3 === 1 || offset === Math.floor(runLen / 2)));
            if (shouldPlacePier) {
              const [pwx, , ] = gridToWorld(px, y, gridWidth, gridHeight);
              // Pier Cap Beam
              addBox3D(bridgeGeos, pwx - 0.12, pwx + 0.12, deckCenterY - deckThickness / 2 - 0.08, deckCenterY - deckThickness / 2, wzStart - halfBridgeW + 0.04, wzStart + halfBridgeW - 0.04);
              // Pier Cylindrical Column down to riverbed
              addCylinder(bridgeGeos, 0.09, 0.11, pierHeight, pwx, pierCenterY, wzStart, 16);
            }
          }

          for (let cx = startX; cx <= endX; cx++) processedBridgeEW.add(`${cx},${y}`);

        } else if (isNSBridge) {
          // Find start and end of this NS bridge run on water
          let startY = y;
          while (startY - 1 >= 0 && isRoad(x, startY - 1) && isWater(x, startY - 1)) {
            startY--;
          }
          let endY = y;
          while (endY + 1 < gridHeight && isRoad(x, endY + 1) && isWater(x, endY + 1)) {
            endY++;
          }

          const elevation = getElevation(x, startY);
          const [wxStart, , wzStart] = gridToWorld(x, startY, gridWidth, gridHeight);
          const [, , wzEnd] = gridToWorld(x, endY, gridWidth, gridHeight);

          const extendNorth = isRoad(x, startY - 1) && !isWater(x, startY - 1) ? 0.06 : 0.0;
          const extendSouth = isRoad(x, endY + 1) && !isWater(x, endY + 1) ? 0.06 : 0.0;

          const minZW = wzStart - ht - extendNorth;
          const maxZW = wzEnd + ht + extendSouth;
          const deckTopY = elevation + ROAD_ASPHALT_Y_OFFSET - 0.002;
          const deckCenterY = deckTopY - deckThickness / 2;

          // Continuous Bridge Deck Box
          addBox3D(bridgeGeos, wxStart - halfBridgeW, wxStart + halfBridgeW, deckCenterY - deckThickness / 2, deckCenterY + deckThickness / 2, minZW, maxZW);

          // Continuous Railings (West and East sides)
          const railCenterY = deckTopY + railingHeight / 2;
          addBox3D(bridgeGeos, wxStart - halfBridgeW + railingThickness / 2, wxStart - halfBridgeW + railingThickness * 1.5, railCenterY - railingHeight / 2, railCenterY + railingHeight / 2, minZW, maxZW);
          addBox3D(bridgeGeos, wxStart + halfBridgeW - railingThickness * 1.5, wxStart + halfBridgeW - railingThickness / 2, railCenterY - railingHeight / 2, railCenterY + railingHeight / 2, minZW, maxZW);

          // Piers spaced every 3 tiles
          const runLen = endY - startY + 1;
          const riverbedBottomY = -0.38;
          const pierHeight = Math.max(0.15, deckCenterY - deckThickness / 2 - riverbedBottomY);
          const pierCenterY = deckCenterY - deckThickness / 2 - pierHeight / 2;

          for (let py = startY; py <= endY; py++) {
            const offset = py - startY;
            const shouldPlacePier = (runLen <= 2 && offset === 0 && runLen === 1) ||
                                   (runLen === 2 && offset === 0) ||
                                   (runLen >= 3 && (offset % 3 === 1 || offset === Math.floor(runLen / 2)));
            if (shouldPlacePier) {
              const [, , pwz] = gridToWorld(x, py, gridWidth, gridHeight);
              // Pier Cap Beam
              addBox3D(bridgeGeos, wxStart - halfBridgeW + 0.04, wxStart + halfBridgeW - 0.04, deckCenterY - deckThickness / 2 - 0.08, deckCenterY - deckThickness / 2, pwz - 0.12, pwz + 0.12);
              // Pier Cylindrical Column down to riverbed
              addCylinder(bridgeGeos, 0.09, 0.11, pierHeight, wxStart, pierCenterY, pwz, 16);
            }
          }

          for (let cy = startY; cy <= endY; cy++) processedBridgeNS.add(`${x},${cy}`);

        } else {
          // Bridge intersection, corner, or isolated water road tile
          const elevation = getElevation(x, y);
          const [wx, , wz] = gridToWorld(x, y, gridWidth, gridHeight);
          const deckTopY = elevation + ROAD_ASPHALT_Y_OFFSET - 0.002;
          const deckCenterY = deckTopY - deckThickness / 2;

          // Single deck block matching intersection bounds
          addBox3D(bridgeGeos, wx - halfBridgeW, wx + halfBridgeW, deckCenterY - deckThickness / 2, deckCenterY + deckThickness / 2, wz - halfBridgeW, wz + halfBridgeW);

          // Single pier for water intersection
          const riverbedBottomY = -0.38;
          const pierHeight = Math.max(0.15, deckCenterY - deckThickness / 2 - riverbedBottomY);
          const pierCenterY = deckCenterY - deckThickness / 2 - pierHeight / 2;
          addCylinder(bridgeGeos, 0.12, 0.15, pierHeight, wx, pierCenterY, wz, 16);
        }
      }
    }

    // =========================================================================
    // STEP 4: Merge Geometries Cleanly
    // =========================================================================

    const mergeBufferGeometries = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry => {
      if (geos.length === 0) return new THREE.BufferGeometry();
      if (geos.length === 1) return geos[0];

      let vertexCount = 0;
      let indexCount = 0;

      for (let i = 0; i < geos.length; i++) {
        const g = geos[i];
        vertexCount += g.attributes.position.count;
        if (g.index) indexCount += g.index.count;
        else indexCount += g.attributes.position.count;
      }

      const mergedPos = new Float32Array(vertexCount * 3);
      const mergedNorm = new Float32Array(vertexCount * 3);
      const mergedUv = new Float32Array(vertexCount * 2);
      const mergedIndex = new Uint32Array(indexCount);

      let vOffset = 0;
      let iOffset = 0;

      for (let i = 0; i < geos.length; i++) {
        const g = geos[i];
        const pAttr = g.attributes.position;
        const nAttr = g.attributes.normal;
        const uvAttr = g.attributes.uv;
        const vCount = pAttr.count;

        mergedPos.set(pAttr.array, vOffset * 3);
        if (nAttr) mergedNorm.set(nAttr.array, vOffset * 3);
        if (uvAttr) mergedUv.set(uvAttr.array, vOffset * 2);

        if (g.index) {
          for (let j = 0; j < g.index.count; j++) {
            mergedIndex[iOffset + j] = g.index.array[j] + vOffset;
          }
          iOffset += g.index.count;
        } else {
          for (let j = 0; j < vCount; j++) {
            mergedIndex[iOffset + j] = vOffset + j;
          }
          iOffset += vCount;
        }
        vOffset += vCount;
      }

      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
      if (mergedNorm.length > 0) merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
      if (mergedUv.length > 0) merged.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
      merged.setIndex(new THREE.BufferAttribute(mergedIndex, 1));

      return merged;
    };

    const finalAsphalt = mergeBufferGeometries(asphaltGeos);
    const finalMarkings = mergeBufferGeometries(markingsGeos);
    const finalCurb = mergeBufferGeometries(curbGeos);
    const finalBridge = mergeBufferGeometries(bridgeGeos);

    // Build debug line geometry from line segments
    const finalDebug = new THREE.BufferGeometry();
    if (debugPositions.length > 0) {
      finalDebug.setAttribute('position', new THREE.Float32BufferAttribute(debugPositions, 3));
      finalDebug.setAttribute('color', new THREE.Float32BufferAttribute(debugColors, 3));
    }

    asphaltGeos.forEach((g) => g.dispose());
    markingsGeos.forEach((g) => g.dispose());
    curbGeos.forEach((g) => g.dispose());
    bridgeGeos.forEach((g) => g.dispose());

    return {
      asphaltGeo: finalAsphalt,
      markingsGeo: finalMarkings,
      curbGeo: finalCurb,
      bridgeGeo: finalBridge,
      debugGeo: finalDebug,
    };
  }
}

