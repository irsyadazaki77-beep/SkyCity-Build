const fs = require('fs');

const path = 'src/core/world/GridRoadNetwork.ts';
let code = fs.readFileSync(path, 'utf8');

const oldBridge = `        // 1. BRIDGE SYSTEM
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
        }`;

const newBridge = `        // 1. BRIDGE SYSTEM
        if (isWater) {
          const deckThickness = 0.09;
          const deckY = elevation - deckThickness / 2;
          const bWidth = roadWidth + 0.08;
          const bHalf = bWidth / 2;

          if (isStraightNS) {
            addBox(bridgeGeos, bWidth, deckThickness, TILE_SIZE, wx, deckY, wz);
            addBox(bridgeGeos, 0.04, 0.15, TILE_SIZE, wx - bHalf + 0.02, elevation + 0.075, wz);
            addBox(bridgeGeos, 0.04, 0.15, TILE_SIZE, wx + bHalf - 0.02, elevation + 0.075, wz);
          } else if (isStraightEW) {
            addBox(bridgeGeos, TILE_SIZE, deckThickness, bWidth, wx, deckY, wz);
            addBox(bridgeGeos, TILE_SIZE, 0.15, 0.04, wx, elevation + 0.075, wz - bHalf + 0.02);
            addBox(bridgeGeos, TILE_SIZE, 0.15, 0.04, wx, elevation + 0.075, wz + bHalf - 0.02);
          } else if (isCorner) {
            // Simplify corners on water to just a square deck (very rare)
            addBox(bridgeGeos, TILE_SIZE, deckThickness, TILE_SIZE, wx, deckY, wz);
          } else {
            // T-junction, 4-way, Dead-end
            if (nN && nS) {
              addBox(bridgeGeos, bWidth, deckThickness, TILE_SIZE, wx, deckY, wz);
              if (nE) addBox(bridgeGeos, armLen, deckThickness, bWidth, wx + bHalf + armLen/2 - 0.04, deckY, wz);
              if (nW) addBox(bridgeGeos, armLen, deckThickness, bWidth, wx - bHalf - armLen/2 + 0.04, deckY, wz);
            } else if (nE && nW) {
              addBox(bridgeGeos, TILE_SIZE, deckThickness, bWidth, wx, deckY, wz);
              if (nN) addBox(bridgeGeos, bWidth, deckThickness, armLen, wx, deckY, wz - bHalf - armLen/2 + 0.04);
              if (nS) addBox(bridgeGeos, bWidth, deckThickness, armLen, wx, deckY, wz + bHalf + armLen/2 - 0.04);
            } else {
              addBox(bridgeGeos, bWidth, deckThickness, bWidth, wx, deckY, wz);
              if (nN) addBox(bridgeGeos, bWidth, deckThickness, armLen, wx, deckY, wz - bHalf - armLen/2 + 0.04);
              if (nS) addBox(bridgeGeos, bWidth, deckThickness, armLen, wx, deckY, wz + bHalf + armLen/2 - 0.04);
              if (nE) addBox(bridgeGeos, armLen, deckThickness, bWidth, wx + bHalf + armLen/2 - 0.04, deckY, wz);
              if (nW) addBox(bridgeGeos, armLen, deckThickness, bWidth, wx - bHalf - armLen/2 + 0.04, deckY, wz);
            }
          }

          const pierHeight = Math.max(0.55, elevation + 0.45);
          addBox(bridgeGeos, bWidth, 0.06, 0.30, wx, elevation - deckThickness - 0.03, wz);
          
          const pierColumnL = new THREE.CylinderGeometry(0.065, 0.08, pierHeight, 8);
          pierColumnL.translate(wx - 0.18, (elevation - 0.45) / 2, wz);
          bridgeGeos.push(pierColumnL);

          const pierColumnR = new THREE.CylinderGeometry(0.065, 0.08, pierHeight, 8);
          pierColumnR.translate(wx + 0.18, (elevation - 0.45) / 2, wz);
          bridgeGeos.push(pierColumnR);

          const checkLandAbutment = (adjX: number, adjY: number, offX: number, offZ: number, isHoriz: boolean) => {
            if (isRoad(adjX, adjY) && !grid[adjY]?.[adjX]?.water) {
              addBox(bridgeGeos, isHoriz ? 0.12 : bWidth, deckThickness + 0.04, isHoriz ? bWidth : 0.12, wx + offX, deckY - 0.01, wz + offZ);
            }
          };
          checkLandAbutment(x + 1, y, halfTile - 0.06, 0, true);
          checkLandAbutment(x - 1, y, -halfTile + 0.06, 0, true);
          checkLandAbutment(x, y + 1, 0, halfTile - 0.06, false);
          checkLandAbutment(x, y - 1, 0, -halfTile + 0.06, false);
        }`;

code = code.replace(oldBridge, newBridge);
fs.writeFileSync(path, code, 'utf8');
console.log('Bridge fixed');
