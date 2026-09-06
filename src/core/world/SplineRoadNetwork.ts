import * as THREE from 'three';
import { SplineRoadNode, SplineRoadSegment, TileData, TileType } from '../../types';
import { gridToWorld, TILE_SIZE } from '../../components/world/types3D';

export interface RoadGeometryBatch {
  asphaltGeo: THREE.BufferGeometry;
  markingsGeo: THREE.BufferGeometry;
  curbGeo: THREE.BufferGeometry;
  bridgeGeo: THREE.BufferGeometry;
  debugGeo: THREE.BufferGeometry;
}

export class SplineRoadNetwork {
  public nodes: Map<string, SplineRoadNode> = new Map();
  public segments: Map<string, SplineRoadSegment> = new Map();

  public buildFromGrid(grid: TileData[][]): void {
    this.nodes.clear();
    this.segments.clear();
    const height = grid.length;
    const width = grid[0]?.length || 0;

    // 1. Identify road nodes
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].type === TileType.ROAD) {
          const id = `node_${x}_${y}`;
          const tile = grid[y][x];
          // Over water, lift road to bridge height
          const isWater = !!tile.water;
          const el = isWater ? Math.max(0.18, (tile.elevation || 0) * 0.45 + 0.18) : (tile.elevation || 0) * 0.45;
          this.nodes.set(id, {
            id,
            x,
            y,
            elevation: el,
            connectedSegmentIds: [],
          });
        }
      }
    }

    // 2. Identify road segments between adjacent road nodes
    let segmentCounter = 1;
    for (const node of this.nodes.values()) {
      const { x, y } = node;
      const rightKey = `node_${x + 1}_${y}`;
      const downKey = `node_${x}_${y + 1}`;

      if (x + 1 < width && this.nodes.has(rightKey)) {
        const segId = `seg_${segmentCounter++}`;
        this.segments.set(segId, {
          id: segId,
          startNodeId: node.id,
          endNodeId: rightKey,
          type: 'two_lane',
          speedLimit: 50,
          lanes: 2,
          length: 1.0,
        });
        node.connectedSegmentIds.push(segId);
        this.nodes.get(rightKey)!.connectedSegmentIds.push(segId);
      }

      if (y + 1 < height && this.nodes.has(downKey)) {
        const segId = `seg_${segmentCounter++}`;
        this.segments.set(segId, {
          id: segId,
          startNodeId: node.id,
          endNodeId: downKey,
          type: 'two_lane',
          speedLimit: 50,
          lanes: 2,
          length: 1.0,
        });
        node.connectedSegmentIds.push(segId);
        this.nodes.get(downKey)!.connectedSegmentIds.push(segId);
      }
    }
  }

  public generateRoadGeometry(grid: TileData[][], gridWidth: number, gridHeight: number): RoadGeometryBatch {
    const asphaltGeos: THREE.BufferGeometry[] = [];
    const markingsGeos: THREE.BufferGeometry[] = [];
    const curbGeos: THREE.BufferGeometry[] = [];
    const bridgeGeos: THREE.BufferGeometry[] = [];
    const debugLinesGeos: THREE.BufferGeometry[] = [];

    const roadWidth = TILE_SIZE * 0.76;
    const halfWidth = roadWidth / 2;
    const halfTile = TILE_SIZE / 2;

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return grid[y]?.[x]?.type === TileType.ROAD;
    };

    for (const node of this.nodes.values()) {
      const { x, y } = node;
      const tile = grid[y]?.[x];
      const isWater = !!tile?.water;
      const [wx, , wz] = gridToWorld(x, y, gridWidth, gridHeight);
      const elevation = isWater ? Math.max(0.18, (tile?.elevation || 0) * 0.45 + 0.18) : (tile?.elevation || 0) * 0.45;

      const nN = isRoad(x, y - 1);
      const nS = isRoad(x, y + 1);
      const nE = isRoad(x + 1, y);
      const nW = isRoad(x - 1, y);

      const connCount = (nN ? 1 : 0) + (nS ? 1 : 0) + (nE ? 1 : 0) + (nW ? 1 : 0);

      // -------------------------------------------------------------
      // 1. BRIDGE DECK & PIERS (if over water)
      // -------------------------------------------------------------
      if (isWater) {
        // Concrete bridge deck slab under asphalt
        const deckGeo = new THREE.BoxGeometry(roadWidth * 1.04, 0.08, TILE_SIZE);
        deckGeo.translate(wx, elevation - 0.03, wz);
        bridgeGeos.push(deckGeo);

        // Guardrails (left & right)
        const railL = new THREE.BoxGeometry(0.06, 0.14, TILE_SIZE);
        railL.translate(wx - halfWidth - 0.02, elevation + 0.06, wz);
        bridgeGeos.push(railL);

        const railR = new THREE.BoxGeometry(0.06, 0.14, TILE_SIZE);
        railR.translate(wx + halfWidth + 0.02, elevation + 0.06, wz);
        bridgeGeos.push(railR);

        // Support Pillar extending into riverbed
        const pillarGeo = new THREE.CylinderGeometry(0.12, 0.14, Math.max(0.4, elevation + 0.4), 8);
        pillarGeo.translate(wx, (elevation - 0.4) / 2, wz);
        bridgeGeos.push(pillarGeo);
      }

      // -------------------------------------------------------------
      // 2. ASPHALT SURFACE
      // -------------------------------------------------------------
      // Base square covering the node intersection core
      const coreGeo = new THREE.PlaneGeometry(roadWidth, roadWidth);
      coreGeo.rotateX(-Math.PI / 2);
      coreGeo.translate(wx, elevation + 0.02, wz);
      asphaltGeos.push(coreGeo);

      // Extend road arms to connect seamlessly to adjacent road tiles
      if (nN) {
        const armN = new THREE.PlaneGeometry(roadWidth, halfTile - halfWidth);
        armN.rotateX(-Math.PI / 2);
        armN.translate(wx, elevation + 0.02, wz - (halfWidth + (halfTile - halfWidth) / 2));
        asphaltGeos.push(armN);
      }
      if (nS) {
        const armS = new THREE.PlaneGeometry(roadWidth, halfTile - halfWidth);
        armS.rotateX(-Math.PI / 2);
        armS.translate(wx, elevation + 0.02, wz + (halfWidth + (halfTile - halfWidth) / 2));
        asphaltGeos.push(armS);
      }
      if (nE) {
        const armE = new THREE.PlaneGeometry(halfTile - halfWidth, roadWidth);
        armE.rotateX(-Math.PI / 2);
        armE.translate(wx + (halfWidth + (halfTile - halfWidth) / 2), elevation + 0.02, wz);
        asphaltGeos.push(armE);
      }
      if (nW) {
        const armW = new THREE.PlaneGeometry(halfTile - halfWidth, roadWidth);
        armW.rotateX(-Math.PI / 2);
        armW.translate(wx - (halfWidth + (halfTile - halfWidth) / 2), elevation + 0.02, wz);
        asphaltGeos.push(armW);
      }

      // -------------------------------------------------------------
      // 3. CURBS & SIDEWALKS (Placed where there is NO connecting road arm)
      // -------------------------------------------------------------
      if (!isWater) {
        const curbThick = 0.08;
        const curbHeight = 0.05;
        const sidewalkWidth = 0.22;

        // North edge curb & sidewalk slab
        if (!nN) {
          const cN = new THREE.BoxGeometry(roadWidth, curbHeight, curbThick);
          cN.translate(wx, elevation + 0.025, wz - halfWidth);
          curbGeos.push(cN);

          const swN = new THREE.BoxGeometry(roadWidth, 0.03, sidewalkWidth);
          swN.translate(wx, elevation + 0.03, wz - halfWidth - sidewalkWidth / 2);
          curbGeos.push(swN);
        }
        // South edge curb & sidewalk slab
        if (!nS) {
          const cS = new THREE.BoxGeometry(roadWidth, curbHeight, curbThick);
          cS.translate(wx, elevation + 0.025, wz + halfWidth);
          curbGeos.push(cS);

          const swS = new THREE.BoxGeometry(roadWidth, 0.03, sidewalkWidth);
          swS.translate(wx, elevation + 0.03, wz + halfWidth + sidewalkWidth / 2);
          curbGeos.push(swS);
        }
        // East edge curb & sidewalk slab
        if (!nE) {
          const cE = new THREE.BoxGeometry(curbThick, curbHeight, roadWidth);
          cE.translate(wx + halfWidth, elevation + 0.025, wz);
          curbGeos.push(cE);

          const swE = new THREE.BoxGeometry(sidewalkWidth, 0.03, roadWidth);
          swE.translate(wx + halfWidth + sidewalkWidth / 2, elevation + 0.03, wz);
          curbGeos.push(swE);
        }
        // West edge curb & sidewalk slab
        if (!nW) {
          const cW = new THREE.BoxGeometry(curbThick, curbHeight, roadWidth);
          cW.translate(wx - halfWidth, elevation + 0.025, wz);
          curbGeos.push(cW);

          const swW = new THREE.BoxGeometry(sidewalkWidth, 0.03, roadWidth);
          swW.translate(wx - halfWidth - sidewalkWidth / 2, elevation + 0.03, wz);
          curbGeos.push(swW);
        }
      }

      // -------------------------------------------------------------
      // 4. LANE MARKINGS & CROSSWALKS (Zebra stripes & stop bars)
      // -------------------------------------------------------------
      const markY = elevation + 0.025;
      const lineWidth = 0.05;

      if (connCount >= 3) {
        // Real 3-way or 4-way INTERSECTION:
        // Keep center open, place stop bars + crosswalk zebra stripes at incoming arms
        const stripeW = 0.08;
        const stripeL = 0.28;
        const numStripes = 5;

        if (nN) {
          for (let k = 0; k < numStripes; k++) {
            const offset = (k - (numStripes - 1) / 2) * (roadWidth / numStripes);
            const stripe = new THREE.PlaneGeometry(stripeW, stripeL);
            stripe.rotateX(-Math.PI / 2);
            stripe.translate(wx + offset, markY, wz - halfWidth - 0.18);
            markingsGeos.push(stripe);
          }
        }
        if (nS) {
          for (let k = 0; k < numStripes; k++) {
            const offset = (k - (numStripes - 1) / 2) * (roadWidth / numStripes);
            const stripe = new THREE.PlaneGeometry(stripeW, stripeL);
            stripe.rotateX(-Math.PI / 2);
            stripe.translate(wx + offset, markY, wz + halfWidth + 0.18);
            markingsGeos.push(stripe);
          }
        }
        if (nE) {
          for (let k = 0; k < numStripes; k++) {
            const offset = (k - (numStripes - 1) / 2) * (roadWidth / numStripes);
            const stripe = new THREE.PlaneGeometry(stripeL, stripeW);
            stripe.rotateX(-Math.PI / 2);
            stripe.translate(wx + halfWidth + 0.18, markY, wz + offset);
            markingsGeos.push(stripe);
          }
        }
        if (nW) {
          for (let k = 0; k < numStripes; k++) {
            const offset = (k - (numStripes - 1) / 2) * (roadWidth / numStripes);
            const stripe = new THREE.PlaneGeometry(stripeL, stripeW);
            stripe.rotateX(-Math.PI / 2);
            stripe.translate(wx - halfWidth - 0.18, markY, wz + offset);
            markingsGeos.push(stripe);
          }
        }
      } else if (connCount === 2) {
        if (nN && nS) {
          // Continuous North-South straight corridor: 2 evenly spaced dashes across the tile
          const dash1 = new THREE.PlaneGeometry(lineWidth, TILE_SIZE * 0.38);
          dash1.rotateX(-Math.PI / 2);
          dash1.translate(wx, markY, wz - TILE_SIZE * 0.25);
          markingsGeos.push(dash1);

          const dash2 = new THREE.PlaneGeometry(lineWidth, TILE_SIZE * 0.38);
          dash2.rotateX(-Math.PI / 2);
          dash2.translate(wx, markY, wz + TILE_SIZE * 0.25);
          markingsGeos.push(dash2);
        } else if (nE && nW) {
          // Continuous East-West straight corridor: 2 evenly spaced dashes across the tile
          const dash1 = new THREE.PlaneGeometry(TILE_SIZE * 0.38, lineWidth);
          dash1.rotateX(-Math.PI / 2);
          dash1.translate(wx - TILE_SIZE * 0.25, markY, wz);
          markingsGeos.push(dash1);

          const dash2 = new THREE.PlaneGeometry(TILE_SIZE * 0.38, lineWidth);
          dash2.rotateX(-Math.PI / 2);
          dash2.translate(wx + TILE_SIZE * 0.25, markY, wz);
          markingsGeos.push(dash2);
        } else {
          // Corner curve (e.g. N-E, S-W)
          const cornerDash = new THREE.PlaneGeometry(lineWidth * 1.5, lineWidth * 1.5);
          cornerDash.rotateX(-Math.PI / 2);
          cornerDash.translate(wx, markY, wz);
          markingsGeos.push(cornerDash);
        }
      } else if (connCount <= 1) {
        // Dead end or single segment
        const dLen = halfTile * 0.6;
        if (nN || nS) {
          const dash = new THREE.PlaneGeometry(lineWidth, dLen);
          dash.rotateX(-Math.PI / 2);
          dash.translate(wx, markY, wz + (nN ? -dLen / 2 : dLen / 2));
          markingsGeos.push(dash);
        } else if (nE || nW) {
          const dash = new THREE.PlaneGeometry(dLen, lineWidth);
          dash.rotateX(-Math.PI / 2);
          dash.translate(wx + (nW ? -dLen / 2 : dLen / 2), markY, wz);
          markingsGeos.push(dash);
        }
      }

      // -------------------------------------------------------------
      // 5. DEBUG VISUALIZER SEGMENTS
      // -------------------------------------------------------------
      const debugNodeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
      debugNodeGeo.translate(wx, elevation + 0.08, wz);
      debugLinesGeos.push(debugNodeGeo);
    }

    return {
      asphaltGeo: asphaltGeos.length > 0 ? (asphaltGeos.length === 1 ? asphaltGeos[0] : mergeGeometriesSafely(asphaltGeos)) : new THREE.BufferGeometry(),
      markingsGeo: markingsGeos.length > 0 ? (markingsGeos.length === 1 ? markingsGeos[0] : mergeGeometriesSafely(markingsGeos)) : new THREE.BufferGeometry(),
      curbGeo: curbGeos.length > 0 ? (curbGeos.length === 1 ? curbGeos[0] : mergeGeometriesSafely(curbGeos)) : new THREE.BufferGeometry(),
      bridgeGeo: bridgeGeos.length > 0 ? (bridgeGeos.length === 1 ? bridgeGeos[0] : mergeGeometriesSafely(bridgeGeos)) : new THREE.BufferGeometry(),
      debugGeo: debugLinesGeos.length > 0 ? (debugLinesGeos.length === 1 ? debugLinesGeos[0] : mergeGeometriesSafely(debugLinesGeos)) : new THREE.BufferGeometry(),
    };
  }
}

function mergeGeometriesSafely(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  let totalVerts = 0;
  let totalIndices = 0;

  for (const g of geometries) {
    totalVerts += g.getAttribute('position').count;
    if (g.getIndex()) {
      totalIndices += g.getIndex()!.count;
    }
  }

  const positions = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  let vertBase = 0;

  for (const g of geometries) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      positions[(vOffset + i) * 3 + 0] = pos.getX(i);
      positions[(vOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vOffset + i) * 3 + 2] = pos.getZ(i);
    }

    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices[iOffset + i] = vertBase + idx.getX(i);
      }
      iOffset += idx.count;
    }

    vertBase += pos.count;
    vOffset += pos.count;
  }

  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (totalIndices > 0) {
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  merged.computeVertexNormals();
  return merged;
}

