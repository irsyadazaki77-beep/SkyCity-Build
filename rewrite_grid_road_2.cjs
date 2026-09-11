const fs = require('fs');

const code = `import * as THREE from 'three';
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

    const roadWidth = 0.74; // Modern clean width
    const halfWidth = roadWidth / 2;
    const halfTile = TILE_SIZE / 2;
    const armLen = halfTile - halfWidth;
    
    // Smooth corner radius for realistic intersections
    const innerRadius = 0.15; 
    
    const curbH = 0.038;
    const curbT = 0.035; 
    const sidewalkY = 0.012; // Base offset for sidewalk
    // All road surfaces are placed at exactly base + 0.04 (landHeight) + 0.02 (asphalt depth) = base + 0.06
    // This perfectly aligns with TerrainMesh landHeight (which is base + 0.04).
    const TERRAIN_LAND_OFFSET = 0.04;
    const ASPHALT_OFFSET = 0.02;

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return grid[y]?.[x]?.type === TileType.ROAD;
    };

    const isWater = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return !!grid[y]?.[x]?.water;
    };

    // Return exact same elevation for both land and water to guarantee NO SEAMS.
    // TerrainMesh dips the riverbed down, so the bridge will simply span across cleanly.
    const getElevation = (x: number, y: number) => {
      const t = grid[y]?.[x];
      return (t?.elevation || 0) * 0.45;
    };

    const addPlane = (geos: THREE.BufferGeometry[], w: number, h: number, x: number, y: number, z: number, rotY = 0) => {
      const geo = new THREE.PlaneGeometry(w, h);
      geo.rotateX(-Math.PI / 2);
      if (rotY) geo.rotateY(rotY);
      geo.translate(x, y, z);
      geos.push(geo);
    };

    const addBox = (geos: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(x, y, z);
      geos.push(geo);
    };

    const addShapeGeo = (geos: THREE.BufferGeometry[], shape: THREE.Shape, depth: number, y: number, wx: number, wz: number, rotY = 0) => {
      let geo;
      if (depth > 0) {
        geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
        geo.rotateX(-Math.PI / 2);
      } else {
        geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
      }
      if (rotY) geo.rotateY(rotY);
      geo.translate(wx, y, wz);
      geos.push(geo);
    };

    // Advanced intersection shape builder
    const buildIntersectionShape = (nN: boolean, nS: boolean, nE: boolean, nW: boolean): THREE.Shape => {
      const shape = new THREE.Shape();
      const hw = halfWidth;
      const ht = halfTile;
      const r = innerRadius;

      if (nN && nW) {
        shape.moveTo(-hw, -ht);
        shape.lineTo(-hw, -hw - r);
        shape.quadraticCurveTo(-hw, -hw, -hw - r, -hw);
        shape.lineTo(-ht, -hw);
      } else if (nN) { shape.moveTo(-hw, -ht); shape.lineTo(-hw, -hw); }
      else if (nW) { shape.moveTo(-ht, -hw); shape.lineTo(-hw, -hw); }
      else { shape.moveTo(-hw, -hw); }

      if (nW && nS) {
        shape.lineTo(-ht, hw);
        shape.lineTo(-hw - r, hw);
        shape.quadraticCurveTo(-hw, hw, -hw, hw + r);
        shape.lineTo(-hw, ht);
      } else if (nW) { shape.lineTo(-ht, hw); shape.lineTo(-hw, hw); }
      else if (nS) { shape.lineTo(-hw, hw); shape.lineTo(-hw, ht); }
      else { shape.lineTo(-hw, hw); }

      if (nS && nE) {
        shape.lineTo(hw, ht);
        shape.lineTo(hw, hw + r);
        shape.quadraticCurveTo(hw, hw, hw + r, hw);
        shape.lineTo(ht, hw);
      } else if (nS) { shape.lineTo(hw, ht); shape.lineTo(hw, hw); }
      else if (nE) { shape.lineTo(hw, hw); shape.lineTo(ht, hw); }
      else { shape.lineTo(hw, hw); }

      if (nE && nN) {
        shape.lineTo(ht, -hw);
        shape.lineTo(hw + r, -hw);
        shape.quadraticCurveTo(hw, -hw, hw, -hw - r);
        shape.lineTo(hw, -ht);
      } else if (nE) { shape.lineTo(ht, -hw); shape.lineTo(hw, -hw); }
      else if (nN) { shape.lineTo(hw, -hw); shape.lineTo(hw, -ht); }
      else { shape.lineTo(hw, -hw); }

      return shape;
    };

    const processedNS = new Set<string>();
    const processedEW = new Set<string>();

    // 1. Process continuous straight segments
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isRoad(x, y)) continue;

        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);
        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);

        const isStraightNS = (nN || nS) && !nE && !nW;
        const isStraightEW = (nE || nW) && !nN && !nS;
        
        const water = isWater(x, y);
        const elevation = getElevation(x, y);

        // Continuous NS
        if (isStraightNS && !processedNS.has(\`\${x},\${y}\`)) {
          let endY = y;
          while (endY + 1 <= maxY && isRoad(x, endY + 1) && !isRoad(x + 1, endY + 1) && !isRoad(x - 1, endY + 1)) {
            if (isWater(x, endY + 1) !== water || getElevation(x, endY + 1) !== elevation) break;
            const nnN = isRoad(x, endY);
            const nnS = isRoad(x, endY + 2);
            const nnE = isRoad(x + 1, endY + 1);
            const nnW = isRoad(x - 1, endY + 1);
            if ((nnN || nnS) && !nnE && !nnW) {
              endY++;
            } else {
              break;
            }
          }

          const length = (endY - y + 1) * TILE_SIZE;
          const [wxStart, , wzStart] = gridToWorld(x, y, gridWidth, gridHeight);
          const [, , wzEnd] = gridToWorld(x, endY, gridWidth, gridHeight);
          const midZ = (wzStart + wzEnd) / 2;
          const asphaltY = elevation + TERRAIN_LAND_OFFSET + ASPHALT_OFFSET;

          addPlane(asphaltGeos, roadWidth, length, wxStart, asphaltY, midZ);
          
          // Subtle Center line
          addPlane(markingsGeos, 0.012, length, wxStart, asphaltY + 0.005, midZ);

          if (!water) {
            const curbY = elevation + TERRAIN_LAND_OFFSET + 0.022;
            const swW = armLen;
            addBox(curbGeos, swW, 0.024, length, wxStart - halfWidth - swW/2, curbY + sidewalkY, midZ);
            addBox(curbGeos, curbT, curbH, length, wxStart - halfWidth - curbT/2, curbY + curbH/2, midZ);
            addBox(curbGeos, swW, 0.024, length, wxStart + halfWidth + swW/2, curbY + sidewalkY, midZ);
            addBox(curbGeos, curbT, curbH, length, wxStart + halfWidth + curbT/2, curbY + curbH/2, midZ);
          } else {
            // Bridge
            const deckThickness = 0.08; // Thinner modern deck
            const deckY = elevation + TERRAIN_LAND_OFFSET - deckThickness / 2;
            const bWidth = roadWidth + 0.16;
            const bHalf = bWidth / 2;
            
            addBox(bridgeGeos, bWidth, deckThickness, length, wxStart, deckY, midZ);
            addBox(bridgeGeos, bWidth - 0.1, deckThickness * 0.4, length, wxStart, deckY - deckThickness*0.7, midZ);

            // Sleek railings
            addBox(bridgeGeos, 0.03, 0.14, length, wxStart - bHalf + 0.02, elevation + TERRAIN_LAND_OFFSET + 0.07, midZ);
            addBox(bridgeGeos, 0.03, 0.14, length, wxStart + bHalf - 0.02, elevation + TERRAIN_LAND_OFFSET + 0.07, midZ);

            const pierHeight = Math.max(0.1, elevation + TERRAIN_LAND_OFFSET - deckThickness + 0.36); // Riverbed is at -0.36 relative to 0
            for (let py = y; py <= endY; py += 2) { 
              const [, , pz] = gridToWorld(x, py, gridWidth, gridHeight);
              const pierSupport = new THREE.BoxGeometry(bWidth - 0.15, 0.08, 0.25);
              pierSupport.translate(wxStart, elevation + TERRAIN_LAND_OFFSET - deckThickness - 0.04, pz);
              bridgeGeos.push(pierSupport);
              
              const pierCyl = new THREE.CylinderGeometry(0.08, 0.10, pierHeight, 16);
              pierCyl.translate(wxStart, (elevation + TERRAIN_LAND_OFFSET - deckThickness - pierHeight/2), pz);
              bridgeGeos.push(pierCyl);
            }
          }

          for (let cy = y; cy <= endY; cy++) processedNS.add(\`\${x},\${cy}\`);
        }

        // Continuous EW
        if (isStraightEW && !processedEW.has(\`\${x},\${y}\`)) {
          let endX = x;
          while (endX + 1 <= maxX && isRoad(endX + 1, y) && !isRoad(endX + 1, y + 1) && !isRoad(endX + 1, y - 1)) {
            if (isWater(endX + 1, y) !== water || getElevation(endX + 1, y) !== elevation) break;
            const nnE = isRoad(endX + 2, y);
            const nnW = isRoad(endX, y);
            const nnN = isRoad(endX + 1, y - 1);
            const nnS = isRoad(endX + 1, y + 1);
            if ((nnE || nnW) && !nnN && !nnS) {
              endX++;
            } else {
              break;
            }
          }

          const length = (endX - x + 1) * TILE_SIZE;
          const [wxStart, , wzStart] = gridToWorld(x, y, gridWidth, gridHeight);
          const [wxEnd, , ] = gridToWorld(endX, y, gridWidth, gridHeight);
          const midX = (wxStart + wxEnd) / 2;
          const asphaltY = elevation + TERRAIN_LAND_OFFSET + ASPHALT_OFFSET;

          addPlane(asphaltGeos, length, roadWidth, midX, asphaltY, wzStart);
          
          // Subtle Center line
          addPlane(markingsGeos, length, 0.012, midX, asphaltY + 0.005, wzStart);

          if (!water) {
            const curbY = elevation + TERRAIN_LAND_OFFSET + 0.022;
            const swW = armLen;
            addBox(curbGeos, length, 0.024, swW, midX, curbY + sidewalkY, wzStart - halfWidth - swW/2);
            addBox(curbGeos, length, curbH, curbT, midX, curbY + curbH/2, wzStart - halfWidth - curbT/2);
            addBox(curbGeos, length, 0.024, swW, midX, curbY + sidewalkY, wzStart + halfWidth + swW/2);
            addBox(curbGeos, length, curbH, curbT, midX, curbY + curbH/2, wzStart + halfWidth + curbT/2);
          } else {
            // Modern Bridge
            const deckThickness = 0.08;
            const deckY = elevation + TERRAIN_LAND_OFFSET - deckThickness / 2;
            const bWidth = roadWidth + 0.16;
            const bHalf = bWidth / 2;
            
            addBox(bridgeGeos, length, deckThickness, bWidth, midX, deckY, wzStart);
            addBox(bridgeGeos, length, deckThickness * 0.4, bWidth - 0.1, midX, deckY - deckThickness*0.7, wzStart);

            addBox(bridgeGeos, length, 0.14, 0.03, midX, elevation + TERRAIN_LAND_OFFSET + 0.07, wzStart - bHalf + 0.02);
            addBox(bridgeGeos, length, 0.14, 0.03, midX, elevation + TERRAIN_LAND_OFFSET + 0.07, wzStart + bHalf - 0.02);

            const pierHeight = Math.max(0.1, elevation + TERRAIN_LAND_OFFSET - deckThickness + 0.36);
            for (let px = x; px <= endX; px += 2) { 
              const [pwx, , ] = gridToWorld(px, y, gridWidth, gridHeight);
              const pierSupport = new THREE.BoxGeometry(0.25, 0.08, bWidth - 0.15);
              pierSupport.translate(pwx, elevation + TERRAIN_LAND_OFFSET - deckThickness - 0.04, wzStart);
              bridgeGeos.push(pierSupport);
              
              const pierCyl = new THREE.CylinderGeometry(0.08, 0.10, pierHeight, 16);
              pierCyl.translate(pwx, (elevation + TERRAIN_LAND_OFFSET - deckThickness - pierHeight/2), wzStart);
              bridgeGeos.push(pierCyl);
            }
          }

          for (let cx = x; cx <= endX; cx++) processedEW.add(\`\${cx},\${y}\`);
        }
      }
    }

    // 2. Process intersections, corners, dead-ends
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isRoad(x, y)) continue;

        const isWaterTile = isWater(x, y);
        const elevation = getElevation(x, y);
        const [wx, , wz] = gridToWorld(x, y, gridWidth, gridHeight);

        // Check if processed by continuous straights
        const isStraightNS = processedNS.has(\`\${x},\${y}\`);
        const isStraightEW = processedEW.has(\`\${x},\${y}\`);
        
        if (isStraightNS || isStraightEW) continue;

        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);
        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);

        const asphaltY = elevation + TERRAIN_LAND_OFFSET + ASPHALT_OFFSET;
        const shape = buildIntersectionShape(nN, nS, nE, nW);
        
        if (isWaterTile) {
          const deckThickness = 0.08;
          const deckY = elevation + TERRAIN_LAND_OFFSET - deckThickness / 2;
          // Intersection deck
          addShapeGeo(bridgeGeos, shape, deckThickness, deckY - deckThickness/2, wx, wz);
          
          // Subtle Asphalt layer on top
          addShapeGeo(asphaltGeos, shape, 0, asphaltY, wx, wz);

          // Central architectural pier for intersections over water
          const pierHeight = Math.max(0.1, elevation + TERRAIN_LAND_OFFSET - deckThickness + 0.36);
          const pierCyl = new THREE.CylinderGeometry(0.12, 0.16, pierHeight, 16);
          pierCyl.translate(wx, (elevation + TERRAIN_LAND_OFFSET - deckThickness - pierHeight/2), wz);
          bridgeGeos.push(pierCyl);
        } else {
          // Asphalt layer on land
          addShapeGeo(asphaltGeos, shape, 0, asphaltY, wx, wz);

          // Sidewalks for corners
          const curbY = elevation + TERRAIN_LAND_OFFSET + 0.022;

          const drawCornerCurbShape = (cX: number, cZ: number, isOuter: boolean, angle: number) => {
            const w = armLen;
            const cShape = new THREE.Shape();
            if (isOuter) {
              cShape.moveTo(0, 0); cShape.lineTo(w, 0); cShape.lineTo(w, w); cShape.lineTo(0, w); cShape.lineTo(0, 0);
            } else {
              const r = innerRadius;
              cShape.moveTo(0, 0); cShape.lineTo(w, 0); cShape.lineTo(w, w - r); cShape.quadraticCurveTo(w, w, w - r, w); cShape.lineTo(0, w); cShape.lineTo(0, 0);
            }
            
            const geo = new THREE.ExtrudeGeometry(cShape, { depth: 0.024, bevelEnabled: false });
            geo.rotateX(-Math.PI / 2);
            geo.rotateY(angle);
            // Extrude depth adds to Y, so translate accordingly:
            geo.translate(wx + cX, curbY + sidewalkY - 0.024/2, wz + cZ);
            curbGeos.push(geo);

            if (isOuter) {
              // Flat rims for outer edges
              if (cX > 0 && cZ > 0) { // SE
                if (!nS) addBox(curbGeos, w, curbH, curbT, wx + cX + w/2, curbY + curbH/2, wz + cZ + w - curbT/2);
                if (!nE) addBox(curbGeos, curbT, curbH, w, wx + cX + w - curbT/2, curbY + curbH/2, wz + cZ + w/2);
              } else if (cX < 0 && cZ > 0) { // SW
                if (!nS) addBox(curbGeos, w, curbH, curbT, wx + cX - w/2, curbY + curbH/2, wz + cZ + w - curbT/2);
                if (!nW) addBox(curbGeos, curbT, curbH, w, wx + cX - w + curbT/2, curbY + curbH/2, wz + cZ + w/2);
              } else if (cX > 0 && cZ < 0) { // NE
                if (!nN) addBox(curbGeos, w, curbH, curbT, wx + cX + w/2, curbY + curbH/2, wz + cZ - w + curbT/2);
                if (!nE) addBox(curbGeos, curbT, curbH, w, wx + cX + w - curbT/2, curbY + curbH/2, wz + cZ - w/2);
              } else if (cX < 0 && cZ < 0) { // NW
                if (!nN) addBox(curbGeos, w, curbH, curbT, wx + cX - w/2, curbY + curbH/2, wz + cZ - w + curbT/2);
                if (!nW) addBox(curbGeos, curbT, curbH, w, wx + cX - w + curbT/2, curbY + curbH/2, wz + cZ - w/2);
              }
            } else {
              // Curved inner rim
              const r = innerRadius;
              const innerRim = new THREE.Shape();
              innerRim.moveTo(w, 0); innerRim.lineTo(w, w - r); innerRim.quadraticCurveTo(w, w, w - r, w);
              innerRim.lineTo(0, w); innerRim.lineTo(0, w - curbT); innerRim.lineTo(w - r, w - curbT);
              innerRim.quadraticCurveTo(w - curbT, w - curbT, w - curbT, w - r); innerRim.lineTo(w - curbT, 0);
              innerRim.lineTo(w, 0);

              const rimGeo = new THREE.ExtrudeGeometry(innerRim, { depth: curbH, bevelEnabled: false });
              rimGeo.rotateX(-Math.PI / 2);
              rimGeo.rotateY(angle);
              rimGeo.translate(wx + cX, curbY - curbH/2, wz + cZ);
              curbGeos.push(rimGeo);
            }
          };

          if (!nN || !nE) drawCornerCurbShape(halfWidth, -halfWidth, !nN && !nE, 0);
          if (!nN || !nW) drawCornerCurbShape(-halfWidth, -halfWidth, !nN && !nW, Math.PI / 2);
          if (!nS || !nW) drawCornerCurbShape(-halfWidth, halfWidth, !nS && !nW, Math.PI);
          if (!nS || !nE) drawCornerCurbShape(halfWidth, halfWidth, !nS && !nE, -Math.PI / 2);
        }

        // Intersection Markings (Compact & Clean)
        const connCount = (nN ? 1 : 0) + (nS ? 1 : 0) + (nE ? 1 : 0) + (nW ? 1 : 0);
        if (connCount >= 3) {
          const stopBarW = 0.03;
          const markY = asphaltY + 0.005;
          
          const addStopBar = (dir: 'N'|'S'|'E'|'W') => {
            const isVert = dir === 'N' || dir === 'S';
            const stopOffsetZ = dir === 'N' ? -halfWidth + 0.05 : dir === 'S' ? halfWidth - 0.05 : 0;
            const stopOffsetX = dir === 'W' ? -halfWidth + 0.05 : dir === 'E' ? halfWidth - 0.05 : 0;
            addPlane(markingsGeos, isVert ? roadWidth * 0.45 : stopBarW, isVert ? stopBarW : roadWidth * 0.45,
                     wx + (isVert ? 0.12 : stopOffsetX), markY, wz + (isVert ? stopOffsetZ : 0.12));
          };

          if (nN) addStopBar('N');
          if (nS) addStopBar('S');
          if (nE) addStopBar('E');
          if (nW) addStopBar('W');

          // Clean modern crossing only on major 4-ways
          if (connCount === 4) {
            const stripeW = 0.035;
            const stripeL = 0.28;
            const numStripes = 6;
            for (const dir of ['N', 'S']) {
              const offsetZ = dir === 'N' ? -halfWidth - 0.18 : halfWidth + 0.18;
              for (let k = 0; k < numStripes; k++) {
                const lateral = (k - (numStripes - 1) / 2) * (roadWidth / (numStripes + 1));
                addPlane(markingsGeos, stripeW, stripeL, wx + lateral, markY, wz + offsetZ);
              }
            }
          }
        }
      }
    }

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
    const finalDebug = mergeBufferGeometries(debugLinesGeos);

    asphaltGeos.forEach(g => g.dispose());
    markingsGeos.forEach(g => g.dispose());
    curbGeos.forEach(g => g.dispose());
    bridgeGeos.forEach(g => g.dispose());
    debugLinesGeos.forEach(g => g.dispose());

    return {
      asphaltGeo: finalAsphalt,
      markingsGeo: finalMarkings,
      curbGeo: finalCurb,
      bridgeGeo: finalBridge,
      debugGeo: finalDebug,
    };
  }
}
`;

fs.writeFileSync('/app/applet/src/core/world/GridRoadNetwork.ts', code, 'utf8');
console.log('Done writing GridRoadNetwork.ts');
