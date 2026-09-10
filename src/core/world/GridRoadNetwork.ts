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

    const roadWidth = TILE_SIZE * 0.76;
    const halfWidth = roadWidth / 2;
    const halfTile = TILE_SIZE / 2;

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
        const elevation = isWater ? Math.max(0.18, (tile?.elevation || 0) * 0.45 + 0.18) : (tile?.elevation || 0) * 0.45;

        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);
        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);

        const connCount = (nN ? 1 : 0) + (nS ? 1 : 0) + (nE ? 1 : 0) + (nW ? 1 : 0);
        const isEastWest = (nE || nW) && !nN && !nS;

        if (isWater) {
          if (isEastWest) {
            const deckGeo = new THREE.BoxGeometry(TILE_SIZE, 0.08, roadWidth * 1.04);
            deckGeo.translate(wx, elevation - 0.03, wz);
            bridgeGeos.push(deckGeo);
            const railN = new THREE.BoxGeometry(TILE_SIZE, 0.14, 0.06);
            railN.translate(wx, elevation + 0.06, wz - halfWidth - 0.02);
            bridgeGeos.push(railN);
            const railS = new THREE.BoxGeometry(TILE_SIZE, 0.14, 0.06);
            railS.translate(wx, elevation + 0.06, wz + halfWidth + 0.02);
            bridgeGeos.push(railS);
          } else if (connCount > 2) {
            const deckGeo = new THREE.BoxGeometry(TILE_SIZE, 0.08, TILE_SIZE);
            deckGeo.translate(wx, elevation - 0.03, wz);
            bridgeGeos.push(deckGeo);
          } else {
            const deckGeo = new THREE.BoxGeometry(roadWidth * 1.04, 0.08, TILE_SIZE);
            deckGeo.translate(wx, elevation - 0.03, wz);
            bridgeGeos.push(deckGeo);
            const railL = new THREE.BoxGeometry(0.06, 0.14, TILE_SIZE);
            railL.translate(wx - halfWidth - 0.02, elevation + 0.06, wz);
            bridgeGeos.push(railL);
            const railR = new THREE.BoxGeometry(0.06, 0.14, TILE_SIZE);
            railR.translate(wx + halfWidth + 0.02, elevation + 0.06, wz);
            bridgeGeos.push(railR);
          }
          const pillarGeo = new THREE.CylinderGeometry(0.12, 0.14, Math.max(0.4, elevation + 0.4), 8);
          pillarGeo.translate(wx, (elevation - 0.4) / 2, wz);
          bridgeGeos.push(pillarGeo);
        }

        const coreGeo = new THREE.PlaneGeometry(roadWidth, roadWidth);
        coreGeo.rotateX(-Math.PI / 2);
        coreGeo.translate(wx, elevation + 0.02, wz);
        asphaltGeos.push(coreGeo);

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

        if (!isWater) {
          const curbThick = 0.08;
          const curbHeight = 0.05;
          const sidewalkWidth = 0.22;
          if (!nN) {
            const cN = new THREE.BoxGeometry(roadWidth, curbHeight, curbThick);
            cN.translate(wx, elevation + 0.025, wz - halfWidth);
            curbGeos.push(cN);
            const swN = new THREE.BoxGeometry(roadWidth, 0.03, sidewalkWidth);
            swN.translate(wx, elevation + 0.03, wz - halfWidth - sidewalkWidth / 2);
            curbGeos.push(swN);
          }
          if (!nS) {
            const cS = new THREE.BoxGeometry(roadWidth, curbHeight, curbThick);
            cS.translate(wx, elevation + 0.025, wz + halfWidth);
            curbGeos.push(cS);
            const swS = new THREE.BoxGeometry(roadWidth, 0.03, sidewalkWidth);
            swS.translate(wx, elevation + 0.03, wz + halfWidth + sidewalkWidth / 2);
            curbGeos.push(swS);
          }
          if (!nE) {
            const cE = new THREE.BoxGeometry(curbThick, curbHeight, roadWidth);
            cE.translate(wx + halfWidth, elevation + 0.025, wz);
            curbGeos.push(cE);
            const swE = new THREE.BoxGeometry(sidewalkWidth, 0.03, roadWidth);
            swE.translate(wx + halfWidth + sidewalkWidth / 2, elevation + 0.03, wz);
            curbGeos.push(swE);
          }
          if (!nW) {
            const cW = new THREE.BoxGeometry(curbThick, curbHeight, roadWidth);
            cW.translate(wx - halfWidth, elevation + 0.025, wz);
            curbGeos.push(cW);
            const swW = new THREE.BoxGeometry(sidewalkWidth, 0.03, roadWidth);
            swW.translate(wx - halfWidth - sidewalkWidth / 2, elevation + 0.03, wz);
            curbGeos.push(swW);
          }
        }

        const markY = elevation + 0.025;
        const lineWidth = 0.05;

        if (connCount >= 3) {
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
          if ((nN && nS) || (nE && nW)) {
            const isVert = nN && nS;
            const line = new THREE.PlaneGeometry(isVert ? lineWidth : TILE_SIZE, isVert ? TILE_SIZE : lineWidth);
            line.rotateX(-Math.PI / 2);
            line.translate(wx, markY, wz);
            markingsGeos.push(line);
          } else {
            if (nN && nE) {
              const lineN = new THREE.PlaneGeometry(lineWidth, halfTile);
              lineN.rotateX(-Math.PI / 2);
              lineN.translate(wx, markY, wz - halfTile / 2);
              markingsGeos.push(lineN);
              const lineE = new THREE.PlaneGeometry(halfTile, lineWidth);
              lineE.rotateX(-Math.PI / 2);
              lineE.translate(wx + halfTile / 2, markY, wz);
              markingsGeos.push(lineE);
            } else if (nN && nW) {
              const lineN = new THREE.PlaneGeometry(lineWidth, halfTile);
              lineN.rotateX(-Math.PI / 2);
              lineN.translate(wx, markY, wz - halfTile / 2);
              markingsGeos.push(lineN);
              const lineW = new THREE.PlaneGeometry(halfTile, lineWidth);
              lineW.rotateX(-Math.PI / 2);
              lineW.translate(wx - halfTile / 2, markY, wz);
              markingsGeos.push(lineW);
            } else if (nS && nE) {
              const lineS = new THREE.PlaneGeometry(lineWidth, halfTile);
              lineS.rotateX(-Math.PI / 2);
              lineS.translate(wx, markY, wz + halfTile / 2);
              markingsGeos.push(lineS);
              const lineE = new THREE.PlaneGeometry(halfTile, lineWidth);
              lineE.rotateX(-Math.PI / 2);
              lineE.translate(wx + halfTile / 2, markY, wz);
              markingsGeos.push(lineE);
            } else if (nS && nW) {
              const lineS = new THREE.PlaneGeometry(lineWidth, halfTile);
              lineS.rotateX(-Math.PI / 2);
              lineS.translate(wx, markY, wz + halfTile / 2);
              markingsGeos.push(lineS);
              const lineW = new THREE.PlaneGeometry(halfTile, lineWidth);
              lineW.rotateX(-Math.PI / 2);
              lineW.translate(wx - halfTile / 2, markY, wz);
              markingsGeos.push(lineW);
            }
          }
        }
      }
    }

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
