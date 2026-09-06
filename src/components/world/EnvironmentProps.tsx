import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType, GraphicsQualityTier } from '../../types';
import { gridToWorld } from './types3D';
import { TerrainMeshGenerator } from '../../core/world/TerrainMesh';

interface EnvironmentPropsProps {
  grid: TileData[][];
  graphicsQuality?: GraphicsQualityTier;
  showInvalidVegetation?: boolean;
}

interface TreeInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  archetype: 'pine' | 'oak' | 'bush';
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
  const { pineTrees, oakTrees, bushes, rocks } = useMemo(() => {
    const pines: TreeInstance[] = [];
    const oaks: TreeInstance[] = [];
    const bushList: TreeInstance[] = [];
    const rockList: RockInstance[] = [];

    // 1. Organic Clusters on Forest Resource Tiles & Natural Mountain/Park Zones
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const tile = grid[y][x];
        const seed = x * 911 + y * 547;
        const rnd = getSeededRandom(seed);

        if (tile.water || tile.type !== TileType.EMPTY) continue;

        const isForest = tile.resource === 'forest';
        const isOre = tile.resource === 'ore';
        const isHighGround = (tile.elevation || 0) >= 3;

        // Forest grove cluster
        if (isForest || rnd() < 0.15) {
          const clusterSize = isForest ? (graphicsQuality === 'low' ? 2 : 4) : 1;
          for (let k = 0; k < clusterSize; k++) {
            const offsetX = (rnd() - 0.5) * 1.5;
            const offsetZ = (rnd() - 0.5) * 1.5;
            const gx = Math.max(0, Math.min(width - 1, x + offsetX));
            const gy = Math.max(0, Math.min(height - 1, y + offsetZ));

            const [wx, , wz] = gridToWorld(gx, gy, width, height);
            const sample = TerrainMeshGenerator.sampleTerrain(grid, gx, gy, width, height);

            // Water Masking & Footprint check:
            // Reject if waterWeight > 0.05 OR height < 0.03 (submerged or shoreline)
            const targetTile = grid[Math.floor(gy)]?.[Math.floor(gx)];
            if (sample.waterWeight > 0.05 || sample.height < 0.03 || targetTile?.water || targetTile?.type !== TileType.EMPTY) {
              continue;
            }

            const groundY = sample.height;
            const r = rnd();
            const arch = isHighGround ? (r > 0.3 ? 'pine' : 'bush') : (r > 0.6 ? 'oak' : (r > 0.3 ? 'pine' : 'bush'));
            const treeData: TreeInstance = {
              x: wx, y: groundY, z: wz,
              scale: 0.6 + rnd() * 0.6,
              rotation: rnd() * Math.PI * 2,
              archetype: arch,
            };
            if (arch === 'pine') pines.push(treeData);
            else if (arch === 'oak') oaks.push(treeData);
            else bushList.push(treeData);
          }
        }

        // Mineral / Mountain stone outcrops
        if (isOre || (isHighGround && rnd() < 0.2)) {
          const count = 1 + Math.floor(rnd() * 2);
          for (let k = 0; k < count; k++) {
            const gx = Math.max(0, Math.min(width - 1, x + (rnd() - 0.5)));
            const gy = Math.max(0, Math.min(height - 1, y + (rnd() - 0.5)));
            const [wx, , wz] = gridToWorld(gx, gy, width, height);
            const sample = TerrainMeshGenerator.sampleTerrain(grid, gx, gy, width, height);
            if (sample.waterWeight < 0.05 && sample.height > 0.03) {
              rockList.push({
                x: wx, y: sample.height + 0.02, z: wz,
                scale: 0.1 + rnd() * 0.2,
                rx: rnd() * Math.PI, ry: rnd() * Math.PI, rz: rnd() * Math.PI,
              });
            }
          }
        }
      }
    }

    return { pineTrees: pines, oakTrees: oaks, bushes: bushList, rocks: rockList };
  }, [grid, width, height, graphicsQuality]);

  // Archetype Geometries & Materials
  const trunkGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.04, 0.08, 0.5, 5);
    geo.translate(0, 0.25, 0);
    return geo;
  }, []);
  
  const pineGeo = useMemo(() => {
    // Stacked cones for a stylized pine
    const c1 = new THREE.ConeGeometry(0.25, 0.6, 6);
    c1.translate(0, 0.4, 0);
    const c2 = new THREE.ConeGeometry(0.2, 0.5, 6);
    c2.translate(0, 0.7, 0);
    const c3 = new THREE.ConeGeometry(0.15, 0.4, 6);
    c3.translate(0, 1.0, 0);
    
    // In a real app we'd use BufferGeometryUtils.mergeGeometries, but since we 
    // are strictly avoiding extra dependency issues, we'll keep it to one cone 
    // or manually build it if we had the util. We can just use one better proportioned cone 
    // with some noise, or stick to a single stylized cone for performance.
    // Let's use a stylized lower-poly cone but better proportioned:
    const geo = new THREE.ConeGeometry(0.3, 1.1, 5);
    geo.translate(0, 0.55, 0);
    
    // Add a bit of jitter to vertices to make it organic
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0.6) {
        pos.setX(i, pos.getX(i) * (1.0 + (Math.random() - 0.5) * 0.1));
        pos.setZ(i, pos.getZ(i) * (1.0 + (Math.random() - 0.5) * 0.1));
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const oakGeo = useMemo(() => {
    // A more stylized canopy
    const geo = new THREE.IcosahedronGeometry(0.4, 1);
    geo.translate(0, 0.5, 0);
    // Jitter
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.05);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const bushGeo = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.25, 0);
    geo.translate(0, 0.1, 0);
    return geo;
  }, []);
  
  const rockGeo = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(0.6, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.6); // Flatten rocks
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#452a18', roughness: 0.9 }), []);
  const pineMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.8 }), []);
  const oakMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.75 }), []);
  const bushMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.8 }), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.9 }), []);

  const refs = {
    pine: useRef<THREE.InstancedMesh>(null),
    oak: useRef<THREE.InstancedMesh>(null),
    bush: useRef<THREE.InstancedMesh>(null),
    rock: useRef<THREE.InstancedMesh>(null),
  };

  useEffect(() => {
    const tempM = new THREE.Matrix4();
    const updateMesh = (mesh: THREE.InstancedMesh | null, data: any[], yOffset: number = 0) => {
      if (!mesh) return;
      data.forEach((d, i) => {
        tempM.identity();
        const rot = new THREE.Quaternion();
        if (d.rx !== undefined) rot.setFromEuler(new THREE.Euler(d.rx, d.ry, d.rz));
        else rot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.rotation || 0);
        
        tempM.compose(
          new THREE.Vector3(d.x, d.y + yOffset * d.scale, d.z),
          rot,
          new THREE.Vector3(d.scale, d.scale, d.scale)
        );
        mesh.setMatrixAt(i, tempM);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.count = data.length;
    };

    updateMesh(refs.pine.current, pineTrees, 0.1);
    updateMesh(refs.oak.current, oakTrees, 0.1);
    updateMesh(refs.bush.current, bushes, 0.1);
    updateMesh(refs.rock.current, rocks, 0.05);
  }, [pineTrees, oakTrees, bushes, rocks]);

  return (
    <group name="Environment">
      {pineTrees.length > 0 && (
        <instancedMesh ref={refs.pine} args={[pineGeo, pineMat, pineTrees.length]} castShadow={graphicsQuality !== 'low'} />
      )}
      {oakTrees.length > 0 && (
        <instancedMesh ref={refs.oak} args={[oakGeo, oakMat, oakTrees.length]} castShadow={graphicsQuality !== 'low'} />
      )}
      {bushes.length > 0 && (
        <instancedMesh ref={refs.bush} args={[bushGeo, bushMat, bushes.length]} castShadow={false} />
      )}
      {rocks.length > 0 && (
        <instancedMesh ref={refs.rock} args={[rockGeo, rockMat, rocks.length]} castShadow={graphicsQuality === 'ultra'} receiveShadow />
      )}
    </group>
  );
}

