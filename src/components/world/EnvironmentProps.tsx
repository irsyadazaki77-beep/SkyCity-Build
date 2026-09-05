import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { gridToWorld } from './types3D';

interface EnvironmentPropsProps {
  grid: TileData[][];
}

interface EnvPosition {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
}

interface RockPosition {
  x: number;
  y: number;
  z: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
}

// Quick LCG for stable seeded randomness
function getSeededRandom(seed: number) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function EnvironmentProps({ grid }: EnvironmentPropsProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  // Generate stable tree and rock positions based on grid structure
  const { treePositions, rockPositions } = useMemo(() => {
    const trees: EnvPosition[] = [];
    const rocks: RockPosition[] = [];

    // 1. Perimeter boundary nature forest belt (just outside the 60x60 play zone)
    for (let x = -3; x < width + 3; x++) {
      for (let y = -3; y < height + 3; y++) {
        // Only place on the borders
        if (x < 0 || x >= width || y < 0 || y >= height) {
          const seed = (x + 100) * 313 + (y + 100) * 127;
          const rnd = getSeededRandom(seed);
          
          if (rnd() < 0.4) {
            // Find nearby grid tile for height estimate
            const gx = Math.max(0, Math.min(width - 1, x));
            const gy = Math.max(0, Math.min(height - 1, y));
            const baseElevation = grid[gy]?.[gx]?.elevation || 1;
            
            const [wx, , wz] = gridToWorld(gx, gy, width, height);
            const ox = (x < 0 ? x : x >= width ? x - width + 1 : 0);
            const oz = (y < 0 ? y : y >= height ? y - height + 1 : 0);

            trees.push({
              x: wx + ox + (rnd() - 0.5) * 0.4,
              y: baseElevation * 0.15,
              z: wz + oz + (rnd() - 0.5) * 0.4,
              scale: 0.65 + rnd() * 0.5,
              rotation: rnd() * Math.PI * 2,
            });
          }
        }
      }
    }

    // 2. Resource/Forest/Rock tiles inside the active map
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const seed = x * 719 + y * 431;
        const rnd = getSeededRandom(seed);

        if (tile.type === TileType.EMPTY && !tile.water) {
          const [wx, , wz] = gridToWorld(x, y, width, height);
          const tileY = (tile.elevation || 0) * 0.15;

          // Place trees on Forest resource or naturally on some tiles
          if (tile.resource === 'forest') {
            // Multiple trees inside a forest plot
            const count = 3 + Math.floor(rnd() * 2);
            for (let k = 0; k < count; k++) {
              trees.push({
                x: wx + (rnd() - 0.5) * 0.5,
                y: tileY,
                z: wz + (rnd() - 0.5) * 0.5,
                scale: 0.55 + rnd() * 0.45,
                rotation: rnd() * Math.PI * 2,
              });
            }
          } else if (rnd() < 0.10) {
            // Natural spare trees
            trees.push({
              x: wx + (rnd() - 0.5) * 0.4,
              y: tileY,
              z: wz + (rnd() - 0.5) * 0.4,
              scale: 0.5 + rnd() * 0.4,
              rotation: rnd() * Math.PI * 2,
            });
          }

          // Place rocks on Ore resources or high elevation hills
          if (tile.resource === 'ore') {
            const count = 2 + Math.floor(rnd() * 3);
            for (let k = 0; k < count; k++) {
              rocks.push({
                x: wx + (rnd() - 0.5) * 0.6,
                y: tileY,
                z: wz + (rnd() - 0.5) * 0.6,
                scale: 0.1 + rnd() * 0.2,
                rx: rnd() * Math.PI,
                ry: rnd() * Math.PI,
                rz: rnd() * Math.PI,
              });
            }
          } else if ((tile.elevation || 0) >= 5 && rnd() < 0.15) {
            // Mountain stones
            rocks.push({
              x: wx + (rnd() - 0.5) * 0.4,
              y: tileY,
              z: wz + (rnd() - 0.5) * 0.4,
              scale: 0.08 + rnd() * 0.15,
              rx: rnd() * Math.PI,
              ry: rnd() * Math.PI,
              rz: rnd() * Math.PI,
            });
          }
        }
      }
    }

    return { treePositions: trees, rockPositions: rocks };
  }, [grid, width, height]);

  // Geometries and Materials
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.05, 0.2, 5), []);
  const foliageGeo = useMemo(() => new THREE.ConeGeometry(0.18, 0.45, 5), []);
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(0.8, 1), []);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.95 }), []);
  const foliageMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.75 }), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.9 }), []);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!trunkRef.current || !foliageRef.current || !rockRef.current) return;

    const tempTrunk = new THREE.Matrix4();
    const tempFoliage = new THREE.Matrix4();
    const tempRock = new THREE.Matrix4();

    // 1. Position Trunks and Foliage
    treePositions.forEach((tree, i) => {
      // Trunk Composition
      const trunkPos = new THREE.Vector3(tree.x, tree.y + 0.1 * tree.scale, tree.z);
      const trunkScale = new THREE.Vector3(tree.scale, tree.scale, tree.scale);
      const trunkRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
      tempTrunk.compose(trunkPos, trunkRot, trunkScale);
      trunkRef.current!.setMatrixAt(i, tempTrunk);

      // Foliage Composition (positioned on top of the trunk)
      const foliagePos = new THREE.Vector3(tree.x, tree.y + 0.35 * tree.scale, tree.z);
      const foliageScale = new THREE.Vector3(tree.scale, tree.scale, tree.scale);
      const foliageRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
      tempFoliage.compose(foliagePos, foliageRot, foliageScale);
      foliageRef.current!.setMatrixAt(i, tempFoliage);
    });

    trunkRef.current.count = treePositions.length;
    trunkRef.current.instanceMatrix.needsUpdate = true;

    foliageRef.current.count = treePositions.length;
    foliageRef.current.instanceMatrix.needsUpdate = true;

    // 2. Position Rocks
    rockPositions.forEach((rock, i) => {
      const rockPos = new THREE.Vector3(rock.x, rock.y + 0.04, rock.z);
      const rockScale = new THREE.Vector3(rock.scale, rock.scale, rock.scale);
      const rockRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(rock.rx, rock.ry, rock.rz));
      tempRock.compose(rockPos, rockRot, rockScale);
      rockRef.current!.setMatrixAt(i, tempRock);
    });

    rockRef.current.count = rockPositions.length;
    rockRef.current.instanceMatrix.needsUpdate = true;
  }, [treePositions, rockPositions]);

  return (
    <group name="EnvironmentProps">
      {/* High-Performance Instanced Meshes for Vegetation and Prop items */}
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, treePositions.length || 1]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={foliageRef}
        args={[foliageGeo, foliageMat, treePositions.length || 1]}
        castShadow
      />
      <instancedMesh
        ref={rockRef}
        args={[rockGeo, rockMat, rockPositions.length || 1]}
        castShadow
        receiveShadow
      />
    </group>
  );
}
