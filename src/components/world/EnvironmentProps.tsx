import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType, GraphicsQualityTier } from '../../types';
import { gridToWorld } from './types3D';
import { TerrainMeshGenerator } from '../../core/world/TerrainMesh';

interface EnvironmentPropsProps {
  grid: TileData[][];
  graphicsQuality?: GraphicsQualityTier;
}

interface TreeInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  archetype: 'pine' | 'oak';
}

interface RockInstance {
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
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function EnvironmentProps({ grid, graphicsQuality = 'high' }: EnvironmentPropsProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  // Generate clustered tree groves & natural rock clusters
  const { pineTrees, oakTrees, rocks } = useMemo(() => {
    const pines: TreeInstance[] = [];
    const oaks: TreeInstance[] = [];
    const rockList: RockInstance[] = [];

    const isNearWater = (gx: number, gy: number): boolean => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const t = grid[gy + dy]?.[gx + dx];
          if (t?.water) return true;
        }
      }
      return false;
    };

    // 1. Organic Clusters on Forest Resource Tiles & Natural Mountain/Park Zones
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const tile = grid[y][x];
        const seed = x * 911 + y * 547;
        const rnd = getSeededRandom(seed);

        // Don't place on water, roads, or developed structures
        if (tile.water || tile.type !== TileType.EMPTY) continue;

        const isForest = tile.resource === 'forest';
        const isOre = tile.resource === 'ore';
        const isHighGround = (tile.elevation || 0) >= 3;
        const isNearRiver = isNearWater(x, y);

        // Forest grove cluster
        if (isForest) {
          const clusterSize = graphicsQuality === 'low' ? 3 : 5 + Math.floor(rnd() * 3);
          for (let k = 0; k < clusterSize; k++) {
            const offsetX = (rnd() - 0.5) * 1.6;
            const offsetZ = (rnd() - 0.5) * 1.6;
            const gx = Math.max(0, Math.min(width - 1, x + offsetX));
            const gy = Math.max(0, Math.min(height - 1, y + offsetZ));

            const [wx, , wz] = gridToWorld(gx, gy, width, height);
            const groundY = TerrainMeshGenerator.sampleTerrain(grid, gx, gy, width, height).height;

            // Only place if ground is above waterline
            if (groundY > 0.05) {
              const arch = rnd() > 0.4 ? 'pine' : 'oak';
              const treeData: TreeInstance = {
                x: wx,
                y: groundY,
                z: wz,
                scale: 0.85 + rnd() * 0.45,
                rotation: rnd() * Math.PI * 2,
                archetype: arch,
              };
              if (arch === 'pine') pines.push(treeData);
              else oaks.push(treeData);
            }
          }
        }
        // Natural wooded grove (sparse clusters, avoiding individual noise)
        else if (rnd() < 0.18 && !isOre && !isNearRiver) {
          const clusterSize = 3 + Math.floor(rnd() * 2);
          for (let k = 0; k < clusterSize; k++) {
            const offsetX = (rnd() - 0.5) * 1.2;
            const offsetZ = (rnd() - 0.5) * 1.2;
            const gx = Math.max(0, Math.min(width - 1, x + offsetX));
            const gy = Math.max(0, Math.min(height - 1, y + offsetZ));

            const [wx, , wz] = gridToWorld(gx, gy, width, height);
            const groundY = TerrainMeshGenerator.sampleTerrain(grid, gx, gy, width, height).height;

            if (groundY > 0.05) {
              const arch = isHighGround ? 'pine' : rnd() > 0.5 ? 'oak' : 'pine';
              const treeData: TreeInstance = {
                x: wx,
                y: groundY,
                z: wz,
                scale: 0.8 + rnd() * 0.4,
                rotation: rnd() * Math.PI * 2,
                archetype: arch,
              };
              if (arch === 'pine') pines.push(treeData);
              else oaks.push(treeData);
            }
          }
        }

        // Mineral / Mountain stone outcrops
        if (isOre || (isHighGround && rnd() < 0.22)) {
          const count = 2 + Math.floor(rnd() * 3);
          for (let k = 0; k < count; k++) {
            const offsetX = (rnd() - 0.5) * 1.1;
            const offsetZ = (rnd() - 0.5) * 1.1;
            const gx = Math.max(0, Math.min(width - 1, x + offsetX));
            const gy = Math.max(0, Math.min(height - 1, y + offsetZ));

            const [wx, , wz] = gridToWorld(gx, gy, width, height);
            const groundY = TerrainMeshGenerator.sampleTerrain(grid, gx, gy, width, height).height;

            if (groundY > 0.02) {
              rockList.push({
                x: wx,
                y: groundY + 0.03,
                z: wz,
                scale: 0.12 + rnd() * 0.22,
                rx: rnd() * Math.PI,
                ry: rnd() * Math.PI,
                rz: rnd() * Math.PI,
              });
            }
          }
        }
      }
    }

    return { pineTrees: pines, oakTrees: oaks, rocks: rockList };
  }, [grid, width, height, graphicsQuality]);

  // Archetype Geometries & Materials
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.07, 0.35, 6), []);
  const pineFoliageGeo = useMemo(() => new THREE.ConeGeometry(0.28, 0.72, 6), []);
  const oakFoliageGeo = useMemo(() => new THREE.DodecahedronGeometry(0.36, 1), []);
  const rockGeo = useMemo(() => new THREE.DodecahedronGeometry(0.7, 1), []);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.9 }), []);
  const pineMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.7 }), []);
  const oakMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.65 }), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.88 }), []);

  const pineTrunkRef = useRef<THREE.InstancedMesh>(null);
  const pineFoliageRef = useRef<THREE.InstancedMesh>(null);
  const oakTrunkRef = useRef<THREE.InstancedMesh>(null);
  const oakFoliageRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const tempM = new THREE.Matrix4();
    const tempPos = new THREE.Vector3();
    const tempScale = new THREE.Vector3();
    const tempRot = new THREE.Quaternion();

    // 1. Pines
    if (pineTrunkRef.current && pineFoliageRef.current) {
      pineTrees.forEach((tree, i) => {
        // Trunk
        tempPos.set(tree.x, tree.y + 0.16 * tree.scale, tree.z);
        tempScale.set(tree.scale, tree.scale, tree.scale);
        tempRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
        tempM.compose(tempPos, tempRot, tempScale);
        pineTrunkRef.current!.setMatrixAt(i, tempM);

        // Conical Foliage
        tempPos.set(tree.x, tree.y + 0.52 * tree.scale, tree.z);
        tempM.compose(tempPos, tempRot, tempScale);
        pineFoliageRef.current!.setMatrixAt(i, tempM);
      });
      pineTrunkRef.current.count = pineTrees.length;
      pineTrunkRef.current.instanceMatrix.needsUpdate = true;
      pineFoliageRef.current.count = pineTrees.length;
      pineFoliageRef.current.instanceMatrix.needsUpdate = true;
    }

    // 2. Oaks
    if (oakTrunkRef.current && oakFoliageRef.current) {
      oakTrees.forEach((tree, i) => {
        // Trunk
        tempPos.set(tree.x, tree.y + 0.16 * tree.scale, tree.z);
        tempScale.set(tree.scale, tree.scale, tree.scale);
        tempRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
        tempM.compose(tempPos, tempRot, tempScale);
        oakTrunkRef.current!.setMatrixAt(i, tempM);

        // Broadleaf Foliage
        tempPos.set(tree.x, tree.y + 0.5 * tree.scale, tree.z);
        tempM.compose(tempPos, tempRot, tempScale);
        oakFoliageRef.current!.setMatrixAt(i, tempM);
      });
      oakTrunkRef.current.count = oakTrees.length;
      oakTrunkRef.current.instanceMatrix.needsUpdate = true;
      oakFoliageRef.current.count = oakTrees.length;
      oakFoliageRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. Rocks
    if (rockRef.current) {
      rocks.forEach((rock, i) => {
        tempPos.set(rock.x, rock.y + 0.05, rock.z);
        tempScale.set(rock.scale, rock.scale, rock.scale);
        tempRot.setFromEuler(new THREE.Euler(rock.rx, rock.ry, rock.rz));
        tempM.compose(tempPos, tempRot, tempScale);
        rockRef.current!.setMatrixAt(i, tempM);
      });
      rockRef.current.count = rocks.length;
      rockRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [pineTrees, oakTrees, rocks]);

  return (
    <group name="EnvironmentProps">
      {/* Pine Trees */}
      <instancedMesh
        ref={pineTrunkRef}
        args={[trunkGeo, trunkMat, pineTrees.length || 1]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={pineFoliageRef}
        args={[pineFoliageGeo, pineMat, pineTrees.length || 1]}
        castShadow
      />

      {/* Oak Trees */}
      <instancedMesh
        ref={oakTrunkRef}
        args={[trunkGeo, trunkMat, oakTrees.length || 1]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={oakFoliageRef}
        args={[oakFoliageGeo, oakMat, oakTrees.length || 1]}
        castShadow
      />

      {/* Rock Outcrops */}
      <instancedMesh
        ref={rockRef}
        args={[rockGeo, rockMat, rocks.length || 1]}
        castShadow
        receiveShadow
      />
    </group>
  );
}

