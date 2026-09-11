import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType, GraphicsQualityTier } from '../../types';
import { gridToWorld, TILE_SIZE } from './types3D';
import { TerrainMeshGenerator } from '../../core/world/TerrainMesh';
import { TreeMaterial } from '../../rendering/CustomMaterials';
import { GraphicsState } from '../../rendering/GraphicsState';

interface EnvironmentPropsProps {
  grid: TileData[][];
  graphicsQuality?: GraphicsQualityTier;
  showInvalidVegetation?: boolean;
  revision?: number;
}

interface TreeInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
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

interface StreetPropInstance {
  x: number;
  y: number;
  z: number;
  rotation: number;
}

// Quick LCG for stable seeded randomness
function getSeededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function EnvironmentProps({ grid, graphicsQuality = 'high', revision = 0 }: EnvironmentPropsProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  // Generate clustered tree groves, natural rock clusters, street lamps & benches
  const { pineTrees, oakTrees, bushes, rocks, streetLamps, benches } = useMemo(() => {
    const pines: TreeInstance[] = [];
    const oaks: TreeInstance[] = [];
    const bushList: TreeInstance[] = [];
    const rockList: RockInstance[] = [];
    const lamps: StreetPropInstance[] = [];
    const benchList: StreetPropInstance[] = [];

    const isRoad = (gx: number, gy: number) => {
      if (gx < 0 || gx >= width || gy < 0 || gy >= height) return false;
      return grid[gy]?.[gx]?.type === TileType.ROAD;
    };

    const getTerrainHeight = (wx: number, wz: number): number => {
      const offsetX = -(width * TILE_SIZE) / 2 + TILE_SIZE / 2;
      const offsetZ = -(height * TILE_SIZE) / 2 + TILE_SIZE / 2;
      const gx = (wx - offsetX) / TILE_SIZE;
      const gy = (wz - offsetZ) / TILE_SIZE;
      return TerrainMeshGenerator.sampleTerrain(grid, gx, gy, width, height).height;
    };

    // 1. Street Props & Sidewalk Lighting on Road Tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const [wx, , wz] = gridToWorld(x, y, width, height);

        if (tile.type === TileType.ROAD && !tile.water) {
          // Place Street Lamps at every second road tile along edge
          if ((x + y) % 2 === 0) {
            const hasNorth = isRoad(x, y - 1);
            const hasEast = isRoad(x + 1, y);

            if (!hasNorth) {
              const lampZ = wz - TILE_SIZE * 0.38;
              const lampY = getTerrainHeight(wx, lampZ);
              lamps.push({ x: wx, y: lampY + 0.02, z: lampZ, rotation: 0 });
            } else if (!hasEast) {
              const lampX = wx + TILE_SIZE * 0.38;
              const lampY = getTerrainHeight(lampX, wz);
              lamps.push({ x: lampX, y: lampY + 0.02, z: wz, rotation: Math.PI / 2 });
            }
          }

          // Benches along commercial & residential sidewalks
          if ((x * 7 + y * 13) % 5 === 0) {
            const benchX = wx + TILE_SIZE * 0.36;
            const benchY = getTerrainHeight(benchX, wz);
            benchList.push({
              x: benchX,
              y: benchY + 0.02,
              z: wz,
              rotation: Math.PI / 2,
            });
          }
        }
      }
    }

    // 2. Organic Clusters on Forest Resource Tiles & Natural Mountain/Park Zones
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

    return { pineTrees: pines, oakTrees: oaks, bushes: bushList, rocks: rockList, streetLamps: lamps, benches: benchList };
  }, [grid, width, height, graphicsQuality, revision]);

  // Archetype Geometries & Materials
  const pineGeo = useMemo(() => {
    // 3-tiered stylized pine tree with wooden trunk
    const trunk = new THREE.CylinderGeometry(0.04, 0.06, 0.35, 6);
    trunk.translate(0, 0.175, 0);

    const cone1 = new THREE.ConeGeometry(0.38, 0.45, 6);
    cone1.translate(0, 0.45, 0);

    const cone2 = new THREE.ConeGeometry(0.30, 0.40, 6);
    cone2.translate(0, 0.70, 0);

    const cone3 = new THREE.ConeGeometry(0.20, 0.35, 6);
    cone3.translate(0, 0.95, 0);

    // Merge into single buffer geometry
    const geometries = [trunk, cone1, cone2, cone3];
    let totalCount = 0;
    geometries.forEach(g => { totalCount += g.attributes.position.count; });
    const posArray = new Float32Array(totalCount * 3);
    const normArray = new Float32Array(totalCount * 3);

    let offset = 0;
    geometries.forEach(g => {
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        posArray[(offset + i) * 3 + 0] = pos.getX(i);
        posArray[(offset + i) * 3 + 1] = pos.getY(i);
        posArray[(offset + i) * 3 + 2] = pos.getZ(i);
        normArray[(offset + i) * 3 + 0] = norm.getX(i);
        normArray[(offset + i) * 3 + 1] = norm.getY(i);
        normArray[(offset + i) * 3 + 2] = norm.getZ(i);
      }
      offset += pos.count;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
    return merged;
  }, []);

  const oakGeo = useMemo(() => {
    // Broadleaf stylized oak with trunk and 3 organic foliage clusters
    const trunk = new THREE.CylinderGeometry(0.06, 0.08, 0.45, 6);
    trunk.translate(0, 0.22, 0);

    const cluster1 = new THREE.IcosahedronGeometry(0.32, 1);
    cluster1.translate(0, 0.58, 0);

    const cluster2 = new THREE.IcosahedronGeometry(0.25, 1);
    cluster2.translate(0.12, 0.72, 0.08);

    const cluster3 = new THREE.IcosahedronGeometry(0.22, 1);
    cluster3.translate(-0.10, 0.68, -0.06);

    const geometries = [trunk, cluster1, cluster2, cluster3];
    let totalCount = 0;
    geometries.forEach(g => { totalCount += g.attributes.position.count; });
    const posArray = new Float32Array(totalCount * 3);
    const normArray = new Float32Array(totalCount * 3);

    let offset = 0;
    geometries.forEach(g => {
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        posArray[(offset + i) * 3 + 0] = pos.getX(i);
        posArray[(offset + i) * 3 + 1] = pos.getY(i);
        posArray[(offset + i) * 3 + 2] = pos.getZ(i);
        normArray[(offset + i) * 3 + 0] = norm.getX(i);
        normArray[(offset + i) * 3 + 1] = norm.getY(i);
        normArray[(offset + i) * 3 + 2] = norm.getZ(i);
      }
      offset += pos.count;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
    return merged;
  }, []);

  const bushGeo = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.24, 1);
    geo.translate(0, 0.14, 0);
    return geo;
  }, []);

  const rockGeo = useMemo(() => {
    const geo = new THREE.DodecahedronGeometry(0.5, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) * 0.55);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Street Lamp Model (Pedestal + Pole + Angled Arm + Head Fixture)
  const lampPoleGeo = useMemo(() => {
    const pedestal = new THREE.CylinderGeometry(0.04, 0.05, 0.08, 8);
    pedestal.translate(0, 0.04, 0);

    const pole = new THREE.CylinderGeometry(0.018, 0.024, 0.72, 8);
    pole.translate(0, 0.40, 0);

    const arm = new THREE.BoxGeometry(0.20, 0.02, 0.02);
    arm.rotateZ(-0.15);
    arm.translate(0.09, 0.74, 0);

    const headFrame = new THREE.BoxGeometry(0.10, 0.03, 0.06);
    headFrame.translate(0.18, 0.72, 0);

    // Merge pole components
    const geoms = [pedestal, pole, arm, headFrame];
    let totalCount = 0;
    geoms.forEach(g => totalCount += g.attributes.position.count);
    const posArray = new Float32Array(totalCount * 3);

    let offset = 0;
    geoms.forEach(g => {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        posArray[(offset + i) * 3 + 0] = pos.getX(i);
        posArray[(offset + i) * 3 + 1] = pos.getY(i);
        posArray[(offset + i) * 3 + 2] = pos.getZ(i);
      }
      offset += pos.count;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    merged.computeVertexNormals();
    return merged;
  }, []);

  const lampBulbGeo = useMemo(() => {
    const bulb = new THREE.BoxGeometry(0.08, 0.025, 0.05);
    bulb.translate(0.18, 0.705, 0);
    return bulb;
  }, []);

  const benchGeo = useMemo(() => {
    const seat = new THREE.BoxGeometry(0.32, 0.03, 0.12);
    seat.translate(0, 0.12, 0);

    const backrest = new THREE.BoxGeometry(0.32, 0.12, 0.02);
    backrest.translate(0, 0.20, -0.05);

    const legL = new THREE.BoxGeometry(0.03, 0.12, 0.10);
    legL.translate(-0.13, 0.06, 0);

    const legR = new THREE.BoxGeometry(0.03, 0.12, 0.10);
    legR.translate(0.13, 0.06, 0);

    const geoms = [seat, backrest, legL, legR];
    let totalCount = 0;
    geoms.forEach(g => totalCount += g.attributes.position.count);
    const posArray = new Float32Array(totalCount * 3);

    let offset = 0;
    geoms.forEach(g => {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        posArray[(offset + i) * 3 + 0] = pos.getX(i);
        posArray[(offset + i) * 3 + 1] = pos.getY(i);
        posArray[(offset + i) * 3 + 2] = pos.getZ(i);
      }
      offset += pos.count;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    merged.computeVertexNormals();
    return merged;
  }, []);

  // Custom Shader Materials with Wind Sway & Night Emissive Light
  const pineMat = useMemo(() => TreeMaterial('#1b4d24', 0.8), []);
  const oakMat = useMemo(() => TreeMaterial('#2d5e2e', 0.75), []);
  const bushMat = useMemo(() => TreeMaterial('#3b7034', 0.8), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.88 }), []);

  const lampPoleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45, metalness: 0.85 }), []);

  // Emissive Lamp Shader Material (Glows softly at night for bloom)
  const lampBulbMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uNightFactor: GraphicsState.uniforms.uNightFactor,
      },
      vertexShader: `
        void main() {
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uNightFactor;
        void main() {
          vec3 offColor = vec3(0.85, 0.85, 0.80);
          vec3 glowColor = vec3(1.0, 0.94, 0.72) * 3.0;
          vec3 finalColor = mix(offColor, glowColor, uNightFactor);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }, []);

  const benchMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 }), []);

  const refs = {
    pine: useRef<THREE.InstancedMesh>(null),
    oak: useRef<THREE.InstancedMesh>(null),
    bush: useRef<THREE.InstancedMesh>(null),
    rock: useRef<THREE.InstancedMesh>(null),
    lampPole: useRef<THREE.InstancedMesh>(null),
    lampBulb: useRef<THREE.InstancedMesh>(null),
    bench: useRef<THREE.InstancedMesh>(null),
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

        const s = d.scale !== undefined ? d.scale : 1.0;
        tempM.compose(
          new THREE.Vector3(d.x, d.y + yOffset * s, d.z),
          rot,
          new THREE.Vector3(s, s, s)
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
    updateMesh(refs.lampPole.current, streetLamps, 0.0);
    updateMesh(refs.lampBulb.current, streetLamps, 0.0);
    updateMesh(refs.bench.current, benches, 0.0);
  }, [pineTrees, oakTrees, bushes, rocks, streetLamps, benches]);

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
      {streetLamps.length > 0 && (
        <>
          <instancedMesh ref={refs.lampPole} args={[lampPoleGeo, lampPoleMat, streetLamps.length]} castShadow />
          <instancedMesh ref={refs.lampBulb} args={[lampBulbGeo, lampBulbMat, streetLamps.length]} />
        </>
      )}
      {benches.length > 0 && (
        <instancedMesh ref={refs.bench} args={[benchGeo, benchMat, benches.length]} castShadow />
      )}
    </group>
  );
}


