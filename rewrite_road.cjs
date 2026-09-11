const fs = require('fs');

const path = 'src/core/world/GridRoadNetwork.ts';
let code = fs.readFileSync(path, 'utf8');

const newFunc = `
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

    const roadWidth = 0.74;
    const halfWidth = roadWidth / 2; 
    const halfTile = TILE_SIZE / 2;  
    const armLen = halfTile - halfWidth; 

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return false;
      return grid[y]?.[x]?.type === TileType.ROAD;
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

    const addShapeGeo = (geos: THREE.BufferGeometry[], shape: THREE.Shape, depth: number, y: number, wx: number, wz: number) => {
      let geo;
      if (depth > 0) {
        geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(wx, y, wz);
      } else {
        geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        geo.translate(wx, y, wz);
      }
      geos.push(geo);
    };

    const buildCorner = (wx: number, wz: number, asphaltY: number, curbY: number, curbH: number, type: string, isWater: boolean) => {
      const sOuter = new THREE.Shape();
      const sInner = new THREE.Shape();
      const sAsphalt = new THREE.Shape();

      let cx = 0, cz = 0, a1 = 0, a2 = 0, p1 = [0,0], p2 = [0,0], p3 = [0,0], p4 = [0,0], p5 = [0,0], pInner1 = [0,0], pInner2 = [0,0], pInner3 = [0,0];
      const rOut = halfWidth + armLen; 
      const rIn = armLen; 

      if (type === 'NE') {
        cx = 0.5; cz = -0.5; a1 = Math.PI; a2 = Math.PI/2;
        p1 = [0.5, 0.37]; p2 = [0.5, 0.5]; p3 = [-0.5, 0.5]; p4 = [-0.5, -0.5]; p5 = [-0.37, -0.5];
        pInner1 = [0.37, -0.5]; pInner2 = [0.5, -0.5]; pInner3 = [0.5, -0.37];
      } else if (type === 'NW') {
        cx = -0.5; cz = -0.5; a1 = Math.PI/2; a2 = 0;
        p1 = [0.37, -0.5]; p2 = [0.5, -0.5]; p3 = [0.5, 0.5]; p4 = [-0.5, 0.5]; p5 = [-0.5, 0.37];
        pInner1 = [-0.5, -0.37]; pInner2 = [-0.5, -0.5]; pInner3 = [-0.37, -0.5];
      } else if (type === 'SW') {
        cx = -0.5; cz = 0.5; a1 = 0; a2 = -Math.PI/2;
        p1 = [-0.5, -0.37]; p2 = [-0.5, -0.5]; p3 = [0.5, -0.5]; p4 = [0.5, 0.5]; p5 = [0.37, 0.5];
        pInner1 = [-0.37, 0.5]; pInner2 = [-0.5, 0.5]; pInner3 = [-0.5, 0.37];
      } else if (type === 'SE') {
        cx = 0.5; cz = 0.5; a1 = -Math.PI/2; a2 = -Math.PI;
        p1 = [-0.37, 0.5]; p2 = [-0.5, 0.5]; p3 = [-0.5, -0.5]; p4 = [0.5, -0.5]; p5 = [0.5, -0.37];
        pInner1 = [0.5, 0.37]; pInner2 = [0.5, 0.5]; pInner3 = [0.37, 0.5];
      }

      if (!isWater) {
        sOuter.moveTo(p1[0], p1[1]);
        sOuter.lineTo(p2[0], p2[1]);
        sOuter.lineTo(p3[0], p3[1]);
        sOuter.lineTo(p4[0], p4[1]);
        sOuter.lineTo(p5[0], p5[1]);
        sOuter.absarc(cx, cz, rOut, a1, a2, true);

        sInner.moveTo(pInner1[0], pInner1[1]);
        sInner.lineTo(pInner2[0], pInner2[1]);
        sInner.lineTo(pInner3[0], pInner3[1]);
        sInner.absarc(cx, cz, rIn, a2, a1, false);

        addShapeGeo(curbGeos, sOuter, 0.024, curbY, wx, wz); 
        addShapeGeo(curbGeos, sInner, 0.024, curbY, wx, wz); 
      }

      sAsphalt.absarc(cx, cz, rOut, a2, a1, false);
      sAsphalt.absarc(cx, cz, rIn, a1, a2, true);
      addShapeGeo(asphaltGeos, sAsphalt, 0, asphaltY, wx, wz);
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

        const isCornerNE = nN && nE && !nS && !nW;
        const isCornerNW = nN && nW && !nS && !nE;
        const isCornerSE = nS && nE && !nN && !nW;
        const isCornerSW = nS && nW && !nN && !nE;
        const isCorner = isCornerNE || isCornerNW || isCornerSE || isCornerSW;

        // 1. BRIDGE SYSTEM
        if (isWater) {
          const deckThickness = 0.09;
          const deckY = elevation - deckThickness / 2;

          if (isEastWest) {
            addBox(bridgeGeos, TILE_SIZE, deckThickness, roadWidth + 0.08, wx, deckY, wz);
            addBox(bridgeGeos, TILE_SIZE, 0.15, 0.04, wx, elevation + 0.075, wz - halfWidth - 0.02);
            addBox(bridgeGeos, TILE_SIZE, 0.15, 0.04, wx, elevation + 0.075, wz + halfWidth + 0.02);
          } else if (isNorthSouth || connCount <= 2) {
            addBox(bridgeGeos, roadWidth + 0.08, deckThickness, TILE_SIZE, wx, deckY, wz);
            addBox(bridgeGeos, 0.04, 0.15, TILE_SIZE, wx - halfWidth - 0.02, elevation + 0.075, wz);
            addBox(bridgeGeos, 0.04, 0.15, TILE_SIZE, wx + halfWidth + 0.02, elevation + 0.075, wz);
          } else {
            addBox(bridgeGeos, TILE_SIZE, deckThickness, TILE_SIZE, wx, deckY, wz);
          }

          const pierHeight = Math.max(0.55, elevation + 0.45);
          addBox(bridgeGeos, roadWidth + 0.04, 0.06, 0.30, wx, elevation - deckThickness - 0.03, wz);
          
          const pierColumnL = new THREE.CylinderGeometry(0.065, 0.08, pierHeight, 8);
          pierColumnL.translate(wx - 0.18, (elevation - 0.45) / 2, wz);
          bridgeGeos.push(pierColumnL);

          const pierColumnR = new THREE.CylinderGeometry(0.065, 0.08, pierHeight, 8);
          pierColumnR.translate(wx + 0.18, (elevation - 0.45) / 2, wz);
          bridgeGeos.push(pierColumnR);

          const checkLandAbutment = (adjX: number, adjY: number, offX: number, offZ: number, isHoriz: boolean) => {
            if (isRoad(adjX, adjY) && !grid[adjY]?.[adjX]?.water) {
              addBox(bridgeGeos, isHoriz ? 0.12 : roadWidth + 0.08, deckThickness + 0.04, isHoriz ? roadWidth + 0.08 : 0.12, wx + offX, deckY - 0.01, wz + offZ);
            }
          };
          checkLandAbutment(x + 1, y, halfTile - 0.06, 0, true);
          checkLandAbutment(x - 1, y, -halfTile + 0.06, 0, true);
          checkLandAbutment(x, y + 1, 0, halfTile - 0.06, false);
          checkLandAbutment(x, y - 1, 0, -halfTile + 0.06, false);
        }

        // 2. ROAD ASPHALT SURFACE
        const asphaltY = elevation + 0.02;

        if (isStraightNS) {
          addPlane(asphaltGeos, roadWidth, TILE_SIZE, wx, asphaltY, wz);
        } else if (isStraightEW) {
          addPlane(asphaltGeos, TILE_SIZE, roadWidth, wx, asphaltY, wz);
        } else if (isCornerNE) {
          buildCorner(wx, wz, asphaltY, elevation + 0.022, 0.038, 'NE', isWater);
        } else if (isCornerNW) {
          buildCorner(wx, wz, asphaltY, elevation + 0.022, 0.038, 'NW', isWater);
        } else if (isCornerSE) {
          buildCorner(wx, wz, asphaltY, elevation + 0.022, 0.038, 'SE', isWater);
        } else if (isCornerSW) {
          buildCorner(wx, wz, asphaltY, elevation + 0.022, 0.038, 'SW', isWater);
        } else {
          // T-junction, 4-way, Dead-end
          if (nN && nS) {
            addPlane(asphaltGeos, roadWidth, TILE_SIZE, wx, asphaltY, wz);
            if (nE) addPlane(asphaltGeos, armLen, roadWidth, wx + halfWidth + armLen/2, asphaltY, wz);
            if (nW) addPlane(asphaltGeos, armLen, roadWidth, wx - halfWidth - armLen/2, asphaltY, wz);
          } else if (nE && nW) {
            addPlane(asphaltGeos, TILE_SIZE, roadWidth, wx, asphaltY, wz);
            if (nN) addPlane(asphaltGeos, roadWidth, armLen, wx, asphaltY, wz - halfWidth - armLen/2);
            if (nS) addPlane(asphaltGeos, roadWidth, armLen, wx, asphaltY, wz + halfWidth + armLen/2);
          } else {
            addPlane(asphaltGeos, roadWidth, roadWidth, wx, asphaltY, wz);
            if (nN) addPlane(asphaltGeos, roadWidth, armLen, wx, asphaltY, wz - halfWidth - armLen/2);
            if (nS) addPlane(asphaltGeos, roadWidth, armLen, wx, asphaltY, wz + halfWidth + armLen/2);
            if (nE) addPlane(asphaltGeos, armLen, roadWidth, wx + halfWidth + armLen/2, asphaltY, wz);
            if (nW) addPlane(asphaltGeos, armLen, roadWidth, wx - halfWidth - armLen/2, asphaltY, wz);
          }
        }

        // 3. CURBS AND SIDEWALKS (Orthogonal only)
        if (!isWater && !isCorner) {
          const curbH = 0.038;
          const curbT = 0.035;
          const swW = armLen; 
          const curbY = elevation + 0.022;

          if (!nE) {
            const zS = nN ? -halfTile : -halfWidth;
            const zE = nS ? halfTile : halfWidth;
            const len = zE - zS;
            const cZ = (zS + zE) / 2;
            addBox(curbGeos, swW, 0.024, len, wx + halfWidth + swW/2, curbY + 0.012, wz + cZ);
            addBox(curbGeos, curbT, curbH, len, wx + halfWidth, curbY + curbH/2, wz + cZ);
          }
          if (!nW) {
            const zS = nN ? -halfTile : -halfWidth;
            const zE = nS ? halfTile : halfWidth;
            const len = zE - zS;
            const cZ = (zS + zE) / 2;
            addBox(curbGeos, swW, 0.024, len, wx - halfWidth - swW/2, curbY + 0.012, wz + cZ);
            addBox(curbGeos, curbT, curbH, len, wx - halfWidth, curbY + curbH/2, wz + cZ);
          }
          if (!nN) {
            const xS = nW ? -halfTile : -halfWidth;
            const xE = nE ? halfTile : halfWidth;
            const len = xE - xS;
            const cX = (xS + xE) / 2;
            addBox(curbGeos, len, 0.024, swW, wx + cX, curbY + 0.012, wz - halfWidth - swW/2);
            addBox(curbGeos, len, curbH, curbT, wx + cX, curbY + curbH/2, wz - halfWidth);
          }
          if (!nS) {
            const xS = nW ? -halfTile : -halfWidth;
            const xE = nE ? halfTile : halfWidth;
            const len = xE - xS;
            const cX = (xS + xE) / 2;
            addBox(curbGeos, len, 0.024, swW, wx + cX, curbY + 0.012, wz + halfWidth + swW/2);
            addBox(curbGeos, len, curbH, curbT, wx + cX, curbY + curbH/2, wz + halfWidth);
          }
        }

        // 4. ROAD MARKINGS
        const markY = elevation + 0.025;
        const dashW = 0.025;
        
        if (connCount >= 3) {
          // Intersections: Zebras on 4-way, only stop bars on T-junction
          const stopBarW = 0.032;
          const is4Way = connCount === 4;

          const addStopBar = (dir: 'N'|'S'|'E'|'W') => {
            const isVertical = dir === 'N' || dir === 'S';
            const stopBarOffsetZ = dir === 'N' ? -halfWidth + 0.04 : dir === 'S' ? halfWidth - 0.04 : 0;
            const stopBarOffsetX = dir === 'W' ? -halfWidth + 0.04 : dir === 'E' ? halfWidth - 0.04 : 0;
            addPlane(markingsGeos, isVertical ? roadWidth * 0.44 : stopBarW, isVertical ? stopBarW : roadWidth * 0.44,
                     wx + (isVertical ? 0.16 : stopBarOffsetX), markY, wz + (isVertical ? stopBarOffsetZ : 0.16));
            
            // Zebra only on 4-way intersection
            if (is4Way) {
              const numStripes = 6;
              const stripeW = 0.038;
              const stripeL = 0.20;
              const offsetZ = dir === 'N' ? -halfWidth - 0.08 : dir === 'S' ? halfWidth + 0.08 : 0;
              const offsetX = dir === 'W' ? -halfWidth - 0.08 : dir === 'E' ? halfWidth + 0.08 : 0;
              
              for (let k = 0; k < numStripes; k++) {
                const lateral = (k - (numStripes - 1) / 2) * (roadWidth / (numStripes + 0.5));
                addPlane(markingsGeos, isVertical ? stripeW : stripeL, isVertical ? stripeL : stripeW,
                         wx + (isVertical ? lateral : offsetX), markY, wz + (isVertical ? offsetZ : lateral));
              }
            }
          };

          if (nN) addStopBar('N');
          if (nS) addStopBar('S');
          if (nE) addStopBar('E');
          if (nW) addStopBar('W');
        } else if (connCount === 2) {
          // Straight line markings
          if ((nN && nS) || (nE && nW)) {
            const isVert = nN && nS;
            const dashL = 0.25;
            const dashCount = 2;
            for (let d = 0; d < dashCount; d++) {
              const dPos = (d - 0.5) * 0.45;
              addPlane(markingsGeos, isVert ? dashW : dashL, isVert ? dashL : dashW,
                       wx + (isVert ? 0 : dPos), markY, wz + (isVert ? dPos : 0));
            }
          }
        }
      }
    }

    // --- GEOMETRY MERGING ---
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
      merged.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
      merged.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
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
`;

const startIndex = code.indexOf('public static generateChunkRoadGeometry(');
const endIndex = code.lastIndexOf('  }') + 3;

if (startIndex !== -1 && endIndex !== -1) {
  const finalCode = code.substring(0, startIndex) + newFunc + code.substring(endIndex);
  fs.writeFileSync(path, finalCode, 'utf8');
  console.log('Successfully rewrote GridRoadNetwork.ts');
} else {
  console.error('Failed to find function bounds');
}
