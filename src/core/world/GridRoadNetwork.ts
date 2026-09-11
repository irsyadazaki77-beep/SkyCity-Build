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
    const debugLinesGeos: THREE.BufferGeometry[] = [];

    // Consistent proportional 2-lane road width
    const roadWidth = 0.74;
    const halfWidth = roadWidth / 2; // 0.37
    const halfTile = TILE_SIZE / 2;  // 0.50
    const armLen = halfTile - halfWidth; // 0.13

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return grid[y]?.[x]?.type === TileType.ROAD;
    };

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isRoad(x, y)) continue;

        const tile = grid[y]?.[x];
        const isWater = !!tile?.water;
        const [wx, , wz] = gridToWorld(x, y, gridWidth, gridHeight);
        const baseElevation = (tile?.elevation || 0) * 0.45;
        const elevation = isWater ? Math.max(0.20, baseElevation + 0.20) : baseElevation;

        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);
        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);

        const connCount = (nN ? 1 : 0) + (nS ? 1 : 0) + (nE ? 1 : 0) + (nW ? 1 : 0);
        const isEastWest = (nE || nW) && !nN && !nS;
        const isNorthSouth = (nN || nS) && !nE && !nW;

        // -------------------------------------------------------------
        // 1. BRIDGE SYSTEM OVER WATER
        // -------------------------------------------------------------
        if (isWater) {
          const deckThickness = 0.09;
          const deckY = elevation - deckThickness / 2;

          if (isEastWest) {
            // East-West Bridge Deck
            const deck = new THREE.BoxGeometry(TILE_SIZE, deckThickness, roadWidth + 0.08);
            deck.translate(wx, deckY, wz);
            bridgeGeos.push(deck);

            // North and South Parapet / Safety Railing
            const railN = new THREE.BoxGeometry(TILE_SIZE, 0.15, 0.04);
            railN.translate(wx, elevation + 0.075, wz - halfWidth - 0.02);
            bridgeGeos.push(railN);

            const railS = new THREE.BoxGeometry(TILE_SIZE, 0.15, 0.04);
            railS.translate(wx, elevation + 0.075, wz + halfWidth + 0.02);
            bridgeGeos.push(railS);
          } else if (isNorthSouth || connCount <= 2) {
            // North-South Bridge Deck
            const deck = new THREE.BoxGeometry(roadWidth + 0.08, deckThickness, TILE_SIZE);
            deck.translate(wx, deckY, wz);
            bridgeGeos.push(deck);

            // West and East Parapets
            const railW = new THREE.BoxGeometry(0.04, 0.15, TILE_SIZE);
            railW.translate(wx - halfWidth - 0.02, elevation + 0.075, wz);
            bridgeGeos.push(railW);

            const railE = new THREE.BoxGeometry(0.04, 0.15, TILE_SIZE);
            railE.translate(wx + halfWidth + 0.02, elevation + 0.075, wz);
            bridgeGeos.push(railE);
          } else {
            // Bridge Intersection Platform Deck
            const deck = new THREE.BoxGeometry(TILE_SIZE, deckThickness, TILE_SIZE);
            deck.translate(wx, deckY, wz);
            bridgeGeos.push(deck);
          }

          // Structural Tapered Pier Support reaching down to riverbed
          const pierHeight = Math.max(0.55, elevation + 0.45);
          const pierCap = new THREE.BoxGeometry(roadWidth + 0.04, 0.06, 0.30);
          pierCap.translate(wx, elevation - deckThickness - 0.03, wz);
          bridgeGeos.push(pierCap);

          const pierColumnL = new THREE.CylinderGeometry(0.065, 0.08, pierHeight, 8);
          pierColumnL.translate(wx - 0.18, (elevation - 0.45) / 2, wz);
          bridgeGeos.push(pierColumnL);

          const pierColumnR = new THREE.CylinderGeometry(0.065, 0.08, pierHeight, 8);
          pierColumnR.translate(wx + 0.18, (elevation - 0.45) / 2, wz);
          bridgeGeos.push(pierColumnR);

          // Bridge Abutment transitions to adjacent land tiles
          const checkLandAbutment = (adjX: number, adjY: number, offX: number, offZ: number, isHoriz: boolean) => {
            if (isRoad(adjX, adjY) && !grid[adjY]?.[adjX]?.water) {
              const abutment = new THREE.BoxGeometry(isHoriz ? 0.12 : roadWidth + 0.08, deckThickness + 0.04, isHoriz ? roadWidth + 0.08 : 0.12);
              abutment.translate(wx + offX, deckY - 0.01, wz + offZ);
              bridgeGeos.push(abutment);
            }
          };
          checkLandAbutment(x + 1, y, halfTile - 0.06, 0, true);
          checkLandAbutment(x - 1, y, -halfTile + 0.06, 0, true);
          checkLandAbutment(x, y + 1, 0, halfTile - 0.06, false);
          checkLandAbutment(x, y - 1, 0, -halfTile + 0.06, false);
        }

        // -------------------------------------------------------------
        // 2. ROAD ASPHALT SURFACE
        // -------------------------------------------------------------
        const asphaltY = elevation + 0.02;

        // Central Core Square
        const coreGeo = new THREE.PlaneGeometry(roadWidth, roadWidth);
        coreGeo.rotateX(-Math.PI / 2);
        coreGeo.translate(wx, asphaltY, wz);
        asphaltGeos.push(coreGeo);

        // Connecting Arms to Adjacent Road Neighbors
        if (nN) {
          const armN = new THREE.PlaneGeometry(roadWidth, armLen);
          armN.rotateX(-Math.PI / 2);
          armN.translate(wx, asphaltY, wz - (halfWidth + armLen / 2));
          asphaltGeos.push(armN);
        }
        if (nS) {
          const armS = new THREE.PlaneGeometry(roadWidth, armLen);
          armS.rotateX(-Math.PI / 2);
          armS.translate(wx, asphaltY, wz + (halfWidth + armLen / 2));
          asphaltGeos.push(armS);
        }
        if (nE) {
          const armE = new THREE.PlaneGeometry(armLen, roadWidth);
          armE.rotateX(-Math.PI / 2);
          armE.translate(wx + (halfWidth + armLen / 2), asphaltY, wz);
          asphaltGeos.push(armE);
        }
        if (nW) {
          const armW = new THREE.PlaneGeometry(armLen, roadWidth);
          armW.rotateX(-Math.PI / 2);
          armW.translate(wx - (halfWidth + armLen / 2), asphaltY, wz);
          asphaltGeos.push(armW);
        }

        // -------------------------------------------------------------
        // 3. CURBS AND SIDEWALK PAVING (FOR LAND ROADS)
        // -------------------------------------------------------------
        if (!isWater) {
          const curbH = 0.038;
          const curbT = 0.035;
          const swW = armLen; // 0.13
          const curbY = elevation + 0.022;

          if (!nN) {
            // North Curb & Sidewalk
            const cN = new THREE.BoxGeometry(roadWidth, curbH, curbT);
            cN.translate(wx, curbY + curbH / 2, wz - halfWidth);
            curbGeos.push(cN);

            const swN = new THREE.BoxGeometry(roadWidth, 0.024, swW);
            swN.translate(wx, curbY + 0.012, wz - halfWidth - swW / 2);
            curbGeos.push(swN);
          }
          if (!nS) {
            // South Curb & Sidewalk
            const cS = new THREE.BoxGeometry(roadWidth, curbH, curbT);
            cS.translate(wx, curbY + curbH / 2, wz + halfWidth);
            curbGeos.push(cS);

            const swS = new THREE.BoxGeometry(roadWidth, 0.024, swW);
            swS.translate(wx, curbY + 0.012, wz + halfWidth + swW / 2);
            curbGeos.push(swS);
          }
          if (!nE) {
            // East Curb & Sidewalk
            const cE = new THREE.BoxGeometry(curbT, curbH, roadWidth);
            cE.translate(wx + halfWidth, curbY + curbH / 2, wz);
            curbGeos.push(cE);

            const swEast = new THREE.BoxGeometry(swW, 0.024, roadWidth);
            swEast.translate(wx + halfWidth + swW / 2, curbY + 0.012, wz);
            curbGeos.push(swEast);
          }
          if (!nW) {
            // West Curb & Sidewalk
            const cW = new THREE.BoxGeometry(curbT, curbH, roadWidth);
            cW.translate(wx - halfWidth, curbY + curbH / 2, wz);
            curbGeos.push(cW);

            const swWest = new THREE.BoxGeometry(swW, 0.024, roadWidth);
            swWest.translate(wx - halfWidth - swW / 2, curbY + 0.012, wz);
            curbGeos.push(swWest);
          }

          // Corner Sidewalk Fillers (Outer quadrants where both adjacent directions are empty)
          const cornerFill = (cxOff: number, czOff: number) => {
            const swCorner = new THREE.BoxGeometry(swW, 0.024, swW);
            swCorner.translate(wx + cxOff, curbY + 0.012, wz + czOff);
            curbGeos.push(swCorner);
          };
          if (!nN && !nE) cornerFill(halfWidth + swW / 2, -halfWidth - swW / 2);
          if (!nN && !nW) cornerFill(-halfWidth - swW / 2, -halfWidth - swW / 2);
          if (!nS && !nE) cornerFill(halfWidth + swW / 2, halfWidth + swW / 2);
          if (!nS && !nW) cornerFill(-halfWidth - swW / 2, halfWidth + swW / 2);
        }

        // -------------------------------------------------------------
        // 4. ROAD MARKINGS (LANE LINES, STOP BARS, ZEBRA CROSSINGS)
        // -------------------------------------------------------------
        const markY = elevation + 0.025;
        const dashW = 0.028;
        const dashL = 0.18;
        const dashGap = 0.14;

        if (connCount >= 3) {
          // INTERSECTIONS (3-Way T-Junction or 4-Way Crossroad)
          // Continental Zebra Crosswalk + Solid Stop Bar on each incoming arm
          const numStripes = 6;
          const stripeW = 0.038;
          const stripeL = 0.20;
          const stopBarW = 0.032;

          const addZebraArm = (dir: 'N' | 'S' | 'E' | 'W') => {
            const isVertical = dir === 'N' || dir === 'S';
            const offsetZ = dir === 'N' ? -halfWidth - 0.08 : dir === 'S' ? halfWidth + 0.08 : 0;
            const offsetX = dir === 'W' ? -halfWidth - 0.08 : dir === 'E' ? halfWidth + 0.08 : 0;

            // Zebra stripes
            for (let k = 0; k < numStripes; k++) {
              const lateral = (k - (numStripes - 1) / 2) * (roadWidth / (numStripes + 0.5));
              const stripe = new THREE.PlaneGeometry(isVertical ? stripeW : stripeL, isVertical ? stripeL : stripeW);
              stripe.rotateX(-Math.PI / 2);
              stripe.translate(
                wx + (isVertical ? lateral : offsetX),
                markY,
                wz + (isVertical ? offsetZ : lateral)
              );
              markingsGeos.push(stripe);
            }

            // Solid Stop Bar Line (Right lane inbound)
            const stopBarOffsetZ = dir === 'N' ? -halfWidth + 0.04 : dir === 'S' ? halfWidth - 0.04 : 0;
            const stopBarOffsetX = dir === 'W' ? -halfWidth + 0.04 : dir === 'E' ? halfWidth - 0.04 : 0;
            const stopBar = new THREE.PlaneGeometry(isVertical ? roadWidth * 0.44 : stopBarW, isVertical ? stopBarW : roadWidth * 0.44);
            stopBar.rotateX(-Math.PI / 2);
            stopBar.translate(
              wx + (isVertical ? 0.16 : stopBarOffsetX),
              markY,
              wz + (isVertical ? stopBarOffsetZ : 0.16)
            );
            markingsGeos.push(stopBar);
          };

          if (nN) addZebraArm('N');
          if (nS) addZebraArm('S');
          if (nE) addZebraArm('E');
          if (nW) addZebraArm('W');
        } else if (connCount === 2) {
          // STRAIGHT ROADS OR 90-DEGREE TURNS
          if ((nN && nS) || (nE && nW)) {
            // Straight 2-lane road: Crisp Dashed Center Line
            const isVert = nN && nS;
            const dashCount = 3;
            for (let d = 0; d < dashCount; d++) {
              const dPos = (d - 1) * (dashL + dashGap);
              const dash = new THREE.PlaneGeometry(isVert ? dashW : dashL, isVert ? dashL : dashW);
              dash.rotateX(-Math.PI / 2);
              dash.translate(wx + (isVert ? 0 : dPos), markY, wz + (isVert ? dPos : 0));
              markingsGeos.push(dash);
            }

            // Shoulder Guide Lines (Thin solid white along road edge)
            const edgeW = 0.016;
            if (isVert) {
              const edgeL = new THREE.PlaneGeometry(edgeW, TILE_SIZE);
              edgeL.rotateX(-Math.PI / 2);
              edgeL.translate(wx - halfWidth + 0.04, markY, wz);
              markingsGeos.push(edgeL);

              const edgeR = new THREE.PlaneGeometry(edgeW, TILE_SIZE);
              edgeR.rotateX(-Math.PI / 2);
              edgeR.translate(wx + halfWidth - 0.04, markY, wz);
              markingsGeos.push(edgeR);
            } else {
              const edgeT = new THREE.PlaneGeometry(TILE_SIZE, edgeW);
              edgeT.rotateX(-Math.PI / 2);
              edgeT.translate(wx, markY, wz - halfWidth + 0.04);
              markingsGeos.push(edgeT);

              const edgeB = new THREE.PlaneGeometry(TILE_SIZE, edgeW);
              edgeB.rotateX(-Math.PI / 2);
              edgeB.translate(wx, markY, wz + halfWidth - 0.04);
              markingsGeos.push(edgeB);
            }
          } else {
            // 90-DEGREE CORNER TURN (Smooth 5-segment arc)
            let arcCenterX = 0;
            let arcCenterZ = 0;
            let startAngle = 0;

            if (nN && nE) {
              arcCenterX = halfTile;
              arcCenterZ = -halfTile;
              startAngle = Math.PI;
            } else if (nN && nW) {
              arcCenterX = -halfTile;
              arcCenterZ = -halfTile;
              startAngle = 1.5 * Math.PI;
            } else if (nS && nE) {
              arcCenterX = halfTile;
              arcCenterZ = halfTile;
              startAngle = 0.5 * Math.PI;
            } else if (nS && nW) {
              arcCenterX = -halfTile;
              arcCenterZ = halfTile;
              startAngle = 0;
            }

            const arcSegments = 4;
            const radius = halfTile;
            for (let s = 0; s < arcSegments; s++) {
              const t1 = startAngle + (s / arcSegments) * (Math.PI / 2);
              const t2 = startAngle + ((s + 1) / arcSegments) * (Math.PI / 2);
              const midT = (t1 + t2) / 2;
              const segX = arcCenterX + Math.cos(midT) * radius;
              const segZ = arcCenterZ + Math.sin(midT) * radius;

              const segLen = (Math.PI / 2 * radius) / arcSegments * 0.65;
              const arcDash = new THREE.PlaneGeometry(dashW, segLen);
              arcDash.rotateX(-Math.PI / 2);
              arcDash.rotateY(-(midT - Math.PI / 2));
              arcDash.translate(wx + segX, markY, wz + segZ);
              markingsGeos.push(arcDash);
            }
          }
        } else if (connCount === 1) {
          // DEAD END / CUL-DE-SAC (1-way stub)
          const isVert = nN || nS;
          const dirSign = nS ? 1 : nN ? -1 : nE ? 1 : -1;
          const endDash = new THREE.PlaneGeometry(isVert ? dashW : dashL, isVert ? dashL : dashW);
          endDash.rotateX(-Math.PI / 2);
          endDash.translate(
            wx + (isVert ? 0 : dirSign * 0.15),
            markY,
            wz + (isVert ? dirSign * 0.15 : 0)
          );
          markingsGeos.push(endDash);
        }
      }
    }

    // Helper to merge BufferGeometries safely
    const merge = (geos: THREE.BufferGeometry[]) => {
      if (geos.length === 0) return new THREE.BufferGeometry();
      if (geos.length === 1) return geos[0];
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      let offset = 0;

      for (const g of geos) {
        if (!g.attributes.position) continue;
        const posAttr = g.attributes.position;
        const indexAttr = g.index;
        if (indexAttr) {
          for (let i = 0; i < indexAttr.count; i++) indices.push(indexAttr.array[i] + offset);
        } else {
          for (let i = 0; i < posAttr.count; i++) indices.push(i + offset);
        }
        for (let i = 0; i < posAttr.count * 3; i++) positions.push(posAttr.array[i]);
        if (g.attributes.normal) {
          for (let i = 0; i < g.attributes.normal.count * 3; i++) normals.push(g.attributes.normal.array[i]);
        } else {
          for (let i = 0; i < posAttr.count * 3; i++) normals.push(0);
        }
        if (g.attributes.uv) {
          for (let i = 0; i < g.attributes.uv.count * 2; i++) uvs.push(g.attributes.uv.array[i]);
        } else {
          for (let i = 0; i < posAttr.count * 2; i++) uvs.push(0);
        }
        offset += posAttr.count;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      return geo;
    };

    return {
      asphaltGeo: merge(asphaltGeos),
      markingsGeo: merge(markingsGeos),
      curbGeo: merge(curbGeos),
      bridgeGeo: merge(bridgeGeos),
      debugGeo: merge(debugLinesGeos),
    };
  }
}
