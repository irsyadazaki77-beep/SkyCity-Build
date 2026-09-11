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

    const roadWidth = 0.76; // Slightly wider for modern proportion
    const halfWidth = roadWidth / 2;
    const halfTile = TILE_SIZE / 2;
    const armLen = halfTile - halfWidth;
    
    // Smooth corner radius for a realistic modern look
    const innerRadius = 0.16; 
    
    const curbH = 0.04;
    const curbT = 0.035; // Curb rim thickness
    const sidewalkY = 0.012; // Base offset for sidewalk

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return grid[y]?.[x]?.type === TileType.ROAD;
    };

    const isWater = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return !!grid[y]?.[x]?.water;
    };

    const getElevation = (x: number, y: number) => {
      const t = grid[y]?.[x];
      const base = (t?.elevation || 0) * 0.45;
      return !!t?.water ? Math.max(0.20, base + 0.20) : base;
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

      // Start top left
      if (nN && nW) {
        shape.moveTo(-hw, -ht);
        shape.lineTo(-hw, -hw - r);
        shape.quadraticCurveTo(-hw, -hw, -hw - r, -hw);
        shape.lineTo(-ht, -hw);
      } else if (nN) {
        shape.moveTo(-hw, -ht);
        shape.lineTo(-hw, -hw);
      } else if (nW) {
        shape.moveTo(-ht, -hw);
        shape.lineTo(-hw, -hw);
      } else {
        shape.moveTo(-hw, -hw);
      }

      // Bottom left
      if (nW && nS) {
        shape.lineTo(-ht, hw);
        shape.lineTo(-hw - r, hw);
        shape.quadraticCurveTo(-hw, hw, -hw, hw + r);
        shape.lineTo(-hw, ht);
      } else if (nW) {
        shape.lineTo(-ht, hw);
        shape.lineTo(-hw, hw);
      } else if (nS) {
        shape.lineTo(-hw, hw);
        shape.lineTo(-hw, ht);
      } else {
        shape.lineTo(-hw, hw);
      }

      // Bottom right
      if (nS && nE) {
        shape.lineTo(hw, ht);
        shape.lineTo(hw, hw + r);
        shape.quadraticCurveTo(hw, hw, hw + r, hw);
        shape.lineTo(ht, hw);
      } else if (nS) {
        shape.lineTo(hw, ht);
        shape.lineTo(hw, hw);
      } else if (nE) {
        shape.lineTo(hw, hw);
        shape.lineTo(ht, hw);
      } else {
        shape.lineTo(hw, hw);
      }

      // Top right
      if (nE && nN) {
        shape.lineTo(ht, -hw);
        shape.lineTo(hw + r, -hw);
        shape.quadraticCurveTo(hw, -hw, hw, -hw - r);
        shape.lineTo(hw, -ht);
      } else if (nE) {
        shape.lineTo(ht, -hw);
        shape.lineTo(hw, -hw);
      } else if (nN) {
        shape.lineTo(hw, -hw);
        shape.lineTo(hw, -ht);
      } else {
        shape.lineTo(hw, -hw);
      }

      return shape;
    };

    const processedNS = new Set<string>();
    const processedEW = new Set<string>();

    // 1. Process continuous straight segments (Seamless roads & bridges)
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
            // Must match water state and elevation
            if (isWater(x, endY + 1) !== water || getElevation(x, endY + 1) !== elevation) break;
            
            // Look ahead to ensure next tile is also straight
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
          const asphaltY = elevation + 0.02;

          addPlane(asphaltGeos, roadWidth, length, wxStart, asphaltY, midZ);
          
          // Continuous markings (single ultra-thin line in center)
          addPlane(markingsGeos, 0.012, length, wxStart, asphaltY + 0.005, midZ);
          
          // Edge lines (very subtle)
          addPlane(markingsGeos, 0.012, length, wxStart - halfWidth + 0.05, asphaltY + 0.005, midZ);
          addPlane(markingsGeos, 0.012, length, wxStart + halfWidth - 0.05, asphaltY + 0.005, midZ);

          if (!water) {
            // Continuous Sidewalks
            const curbY = elevation + 0.022;
            const swW = armLen;
            // Left Sidewalk
            addBox(curbGeos, swW, 0.024, length, wxStart - halfWidth - swW/2, curbY + sidewalkY, midZ);
            addBox(curbGeos, curbT, curbH, length, wxStart - halfWidth - curbT/2, curbY + curbH/2, midZ);
            // Right Sidewalk
            addBox(curbGeos, swW, 0.024, length, wxStart + halfWidth + swW/2, curbY + sidewalkY, midZ);
            addBox(curbGeos, curbT, curbH, length, wxStart + halfWidth + curbT/2, curbY + curbH/2, midZ);
          } else {
            // Modern Bridge
            const deckThickness = 0.12;
            const deckY = elevation - deckThickness / 2;
            const bWidth = roadWidth + 0.16;
            const bHalf = bWidth / 2;
            
            // Main Deck
            addBox(bridgeGeos, bWidth, deckThickness, length, wxStart, deckY, midZ);
            // Lower decorative deck bevel
            addBox(bridgeGeos, bWidth - 0.1, deckThickness * 0.5, length, wxStart, deckY - deckThickness*0.75, midZ);

            // Railings
            addBox(bridgeGeos, 0.03, 0.18, length, wxStart - bHalf + 0.02, elevation + 0.09, midZ);
            addBox(bridgeGeos, 0.03, 0.18, length, wxStart + bHalf - 0.02, elevation + 0.09, midZ);

            // Natural Piers (arch-like flared cylinders)
            const pierHeight = Math.max(0.2, elevation + 0.45 - deckThickness);
            for (let py = y; py <= endY; py += 2) { // Every 2 tiles
              const [, , pz] = gridToWorld(x, py, gridWidth, gridHeight);
              const pierSupport = new THREE.BoxGeometry(bWidth - 0.15, 0.08, 0.35);
              pierSupport.translate(wxStart, elevation - deckThickness - 0.04, pz);
              bridgeGeos.push(pierSupport);
              
              const pierCyl = new THREE.CylinderGeometry(0.08, 0.12, pierHeight, 16);
              pierCyl.translate(wxStart, (elevation - 0.45) / 2, pz);
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
          const asphaltY = elevation + 0.02;

          addPlane(asphaltGeos, length, roadWidth, midX, asphaltY, wzStart);
          
          // Continuous markings
          addPlane(markingsGeos, length, 0.012, midX, asphaltY + 0.005, wzStart);
          // Edge lines
          addPlane(markingsGeos, length, 0.012, midX, asphaltY + 0.005, wzStart - halfWidth + 0.05);
          addPlane(markingsGeos, length, 0.012, midX, asphaltY + 0.005, wzStart + halfWidth - 0.05);

          if (!water) {
            // Continuous Sidewalks
            const curbY = elevation + 0.022;
            const swW = armLen;
            // Top Sidewalk
            addBox(curbGeos, length, 0.024, swW, midX, curbY + sidewalkY, wzStart - halfWidth - swW/2);
            addBox(curbGeos, length, curbH, curbT, midX, curbY + curbH/2, wzStart - halfWidth - curbT/2);
            // Bottom Sidewalk
            addBox(curbGeos, length, 0.024, swW, midX, curbY + sidewalkY, wzStart + halfWidth + swW/2);
            addBox(curbGeos, length, curbH, curbT, midX, curbY + curbH/2, wzStart + halfWidth + curbT/2);
          } else {
            // Modern Bridge
            const deckThickness = 0.12;
            const deckY = elevation - deckThickness / 2;
            const bWidth = roadWidth + 0.16;
            const bHalf = bWidth / 2;
            
            // Main Deck
            addBox(bridgeGeos, length, deckThickness, bWidth, midX, deckY, wzStart);
            addBox(bridgeGeos, length, deckThickness * 0.5, bWidth - 0.1, midX, deckY - deckThickness*0.75, wzStart);

            // Railings
            addBox(bridgeGeos, length, 0.18, 0.03, midX, elevation + 0.09, wzStart - bHalf + 0.02);
            addBox(bridgeGeos, length, 0.18, 0.03, midX, elevation + 0.09, wzStart + bHalf - 0.02);

            // Natural Piers
            const pierHeight = Math.max(0.2, elevation + 0.45 - deckThickness);
            for (let px = x; px <= endX; px += 2) { // Every 2 tiles
              const [pwx, , ] = gridToWorld(px, y, gridWidth, gridHeight);
              const pierSupport = new THREE.BoxGeometry(0.35, 0.08, bWidth - 0.15);
              pierSupport.translate(pwx, elevation - deckThickness - 0.04, wzStart);
              bridgeGeos.push(pierSupport);
              
              const pierCyl = new THREE.CylinderGeometry(0.08, 0.12, pierHeight, 16);
              pierCyl.translate(pwx, (elevation - 0.45) / 2, wzStart);
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
        
        if (isStraightNS || isStraightEW) {
            // Already handled by continuous blocks
            continue;
        }

        const nN = isRoad(x, y - 1);
        const nS = isRoad(x, y + 1);
        const nE = isRoad(x + 1, y);
        const nW = isRoad(x - 1, y);

        const asphaltY = elevation + 0.02;

        // Draw smooth intersection/corner asphalt
        const shape = buildIntersectionShape(nN, nS, nE, nW);
        addShapeGeo(asphaltGeos, shape, 0, asphaltY, wx, wz);

        // Intersection Markings
        const connCount = (nN ? 1 : 0) + (nS ? 1 : 0) + (nE ? 1 : 0) + (nW ? 1 : 0);
        if (connCount >= 3) {
          const stopBarW = 0.03;
          const markY = asphaltY + 0.005;
          
          const addStopBar = (dir: 'N'|'S'|'E'|'W') => {
            const isVert = dir === 'N' || dir === 'S';
            const stopOffsetZ = dir === 'N' ? -halfWidth : dir === 'S' ? halfWidth : 0;
            const stopOffsetX = dir === 'W' ? -halfWidth : dir === 'E' ? halfWidth : 0;
            // Stop bar
            addPlane(markingsGeos, isVert ? roadWidth * 0.45 : stopBarW, isVert ? stopBarW : roadWidth * 0.45,
                     wx + (isVert ? 0.12 : stopOffsetX), markY, wz + (isVert ? stopOffsetZ : 0.12));
          };

          if (nN) addStopBar('N');
          if (nS) addStopBar('S');
          if (nE) addStopBar('E');
          if (nW) addStopBar('W');

          // Clean modern crossing only on major 4-ways
          if (connCount === 4) {
            const stripeW = 0.04;
            const stripeL = 0.3;
            const numStripes = 6;
            // Draw on North and South arms for a single main axis crossing
            for (const dir of ['N', 'S']) {
              const offsetZ = dir === 'N' ? -halfWidth - 0.18 : halfWidth + 0.18;
              for (let k = 0; k < numStripes; k++) {
                const lateral = (k - (numStripes - 1) / 2) * (roadWidth / (numStripes + 1));
                addPlane(markingsGeos, stripeW, stripeL, wx + lateral, markY, wz + offsetZ);
              }
            }
          }
        }

        // Bridge Intersections
        if (isWaterTile) {
          const deckThickness = 0.12;
          const deckY = elevation - deckThickness / 2;
          
          // Extrude the intersection shape for a matching bridge deck!
          const bShape = buildIntersectionShape(nN, nS, nE, nW);
          addShapeGeo(bridgeGeos, bShape, deckThickness, deckY, wx, wz);

          // Central architectural pier
          const pierHeight = Math.max(0.2, elevation + 0.45 - deckThickness);
          const pierCyl = new THREE.CylinderGeometry(0.12, 0.18, pierHeight, 16);
          pierCyl.translate(wx, (elevation - 0.45) / 2, wz);
          bridgeGeos.push(pierCyl);
        } else {
          // Sidewalks for corners / intersections / dead ends
          const curbY = elevation + 0.022;

          const drawCornerCurbShape = (cX: number, cZ: number, isOuter: boolean, angle: number) => {
            const w = armLen;
            const cShape = new THREE.Shape();
            if (isOuter) {
              cShape.moveTo(0, 0);
              cShape.lineTo(w, 0);
              cShape.lineTo(w, w);
              cShape.lineTo(0, w);
              cShape.lineTo(0, 0);
            } else {
              const r = innerRadius;
              cShape.moveTo(0, 0);
              cShape.lineTo(w, 0);
              cShape.lineTo(w, w - r);
              cShape.quadraticCurveTo(w, w, w - r, w);
              cShape.lineTo(0, w);
              cShape.lineTo(0, 0);
            }
            
            const geo = new THREE.ExtrudeGeometry(cShape, { depth: 0.024, bevelEnabled: false });
            geo.rotateX(-Math.PI / 2);
            geo.rotateY(angle);
            geo.translate(wx + cX, curbY + sidewalkY, wz + cZ);
            curbGeos.push(geo);

            // Rim construction
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
              innerRim.moveTo(w, 0);
              innerRim.lineTo(w, w - r);
              innerRim.quadraticCurveTo(w, w, w - r, w);
              innerRim.lineTo(0, w);
              innerRim.lineTo(0, w - curbT);
              innerRim.lineTo(w - r, w - curbT);
              innerRim.quadraticCurveTo(w - curbT, w - curbT, w - curbT, w - r);
              innerRim.lineTo(w - curbT, 0);
              innerRim.lineTo(w, 0);

              const rimGeo = new THREE.ExtrudeGeometry(innerRim, { depth: curbH, bevelEnabled: false });
              rimGeo.rotateX(-Math.PI / 2);
              rimGeo.rotateY(angle);
              rimGeo.translate(wx + cX, curbY, wz + cZ);
              curbGeos.push(rimGeo);
            }
          };

          if (!nN || !nE) drawCornerCurbShape(halfWidth, -halfWidth, !nN && !nE, 0);
          if (!nN || !nW) drawCornerCurbShape(-halfWidth, -halfWidth, !nN && !nW, Math.PI / 2);
          if (!nS || !nW) drawCornerCurbShape(-halfWidth, halfWidth, !nS && !nW, Math.PI);
          if (!nS || !nE) drawCornerCurbShape(halfWidth, halfWidth, !nS && !nE, -Math.PI / 2);
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
