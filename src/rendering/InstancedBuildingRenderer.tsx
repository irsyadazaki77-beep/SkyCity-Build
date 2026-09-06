import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../types';
import { gridToWorld } from '../components/world/types3D';
import { GraphicsState } from './GraphicsState';

interface InstancedBuildingRendererProps {
  grid: TileData[][];
  buildingRevision: number;
  nightFactor: number;
  onBuildingBatchUpdate?: (count: number) => void;
}

// Building Archetypes definition
type BuildingArchetype = 'RES_SMALL' | 'RES_MED' | 'RES_TOWER' | 'COM_SMALL' | 'COM_TOWER' | 'IND_LOW' | 'IND_HIGH' | 'SERVICE';

interface ArchetypeGroup {
  type: BuildingArchetype;
  tiles: TileData[];
}

const dummyMatrix = new THREE.Matrix4();
const dummyColor = new THREE.Color();

/**
 * Building Material with Emissive Windows support
 */
const BuildingMaterial = (color: string) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunDirection: GraphicsState.uniforms.uSunDirection,
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = instanceMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uNightFactor;
      uniform vec3 uSunDirection;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        float dotL = max(0.2, dot(normal, uSunDirection));
        
        // Window logic based on world position (fake windows)
        vec3 p = vWorldPosition * 4.0;
        float windowMask = step(0.6, fract(p.x * 2.0)) * step(0.6, fract(p.y * 3.0));
        
        // Randomly turn off some windows
        float rand = fract(sin(dot(floor(vWorldPosition.xy * 2.0), vec2(12.9898, 78.233))) * 43758.5453);
        windowMask *= step(0.3, rand);

        vec3 emissive = vec3(1.0, 0.9, 0.5) * windowMask * uNightFactor * 1.5;
        vec3 diffuse = uColor * dotL * (1.0 - uNightFactor * 0.7);
        
        // Night tint
        diffuse += vec3(0.02, 0.05, 0.15) * uNightFactor;

        gl_FragColor = vec4(diffuse + emissive, 1.0);
      }
    `
  });
};

export function InstancedBuildingRenderer({
  grid,
  buildingRevision,
  nightFactor,
  onBuildingBatchUpdate,
}: InstancedBuildingRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const prevRevisionRef = useRef<number>(-1);
  const archetypeGroupsRef = useRef<Map<BuildingArchetype, TileData[]>>(new Map());

  // Group buildings into archetypes
  const archetypeGroups = useMemo(() => {
    if (prevRevisionRef.current === buildingRevision && archetypeGroupsRef.current.size > 0) {
      return Array.from(archetypeGroupsRef.current.entries());
    }

    prevRevisionRef.current = buildingRevision;
    const groups = new Map<BuildingArchetype, TileData[]>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) continue;

        let arch: BuildingArchetype = 'RES_SMALL';
        const lvl = tile.level || 1;

        if (tile.type === TileType.RESIDENTIAL) {
          if (lvl <= 2) arch = 'RES_SMALL';
          else if (lvl <= 4) arch = 'RES_MED';
          else arch = 'RES_TOWER';
        } else if (tile.type === TileType.COMMERCIAL) {
          if (lvl <= 3) arch = 'COM_SMALL';
          else arch = 'COM_TOWER';
        } else if (tile.type === TileType.INDUSTRIAL) {
          if (lvl <= 3) arch = 'IND_LOW';
          else arch = 'IND_HIGH';
        } else {
          arch = 'SERVICE';
        }

        if (!groups.has(arch)) groups.set(arch, []);
        groups.get(arch)!.push(tile);
      }
    }

    archetypeGroupsRef.current = groups;
    return Array.from(groups.entries());
  }, [buildingRevision, grid, width, height]);

  // Procedural geometries for archetypes
  const geometries = useMemo(() => {
    const geos: Record<string, THREE.BufferGeometry> = {
      RES_SMALL: new THREE.BoxGeometry(0.65, 0.4, 0.65),
      RES_MED: new THREE.BoxGeometry(0.75, 1.2, 0.75),
      RES_TOWER: new THREE.BoxGeometry(0.85, 2.5, 0.85),
      COM_SMALL: new THREE.BoxGeometry(0.8, 0.6, 0.8),
      COM_TOWER: new THREE.BoxGeometry(0.9, 3.2, 0.9),
      IND_LOW: new THREE.BoxGeometry(0.9, 0.5, 1.2),
      IND_HIGH: new THREE.BoxGeometry(1.2, 1.5, 1.5),
      SERVICE: new THREE.BoxGeometry(0.85, 0.85, 0.85),
    };
    return geos;
  }, []);

  const materials = useMemo(() => {
    return {
      RES_SMALL: BuildingMaterial('#86efac'),
      RES_MED: BuildingMaterial('#4ade80'),
      RES_TOWER: BuildingMaterial('#16a34a'),
      COM_SMALL: BuildingMaterial('#93c5fd'),
      COM_TOWER: BuildingMaterial('#2563eb'),
      IND_LOW: BuildingMaterial('#fdba74'),
      IND_HIGH: BuildingMaterial('#ea580c'),
      SERVICE: BuildingMaterial('#64748b'),
    };
  }, []);

  return (
    <group name="Buildings">
      {archetypeGroups.map(([arch, tiles]) => (
        <BuildingBatch
          key={arch}
          archetype={arch}
          tiles={tiles}
          geometry={geometries[arch]}
          material={materials[arch as keyof typeof materials]}
          gridWidth={width}
          gridHeight={height}
        />
      ))}
    </group>
  );
}

interface BuildingBatchProps {
  archetype: BuildingArchetype;
  tiles: TileData[];
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  gridWidth: number;
  gridHeight: number;
}

function BuildingBatch({ archetype, tiles, geometry, material, gridWidth, gridHeight }: BuildingBatchProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  if (tiles.length === 0) return null;

  useEffect(() => {
    if (!meshRef.current || tiles.length === 0) return;
    const mesh = meshRef.current;
    
    tiles.forEach((tile, i) => {
      const [wx, , wz] = gridToWorld(tile.x, tile.y, gridWidth, gridHeight);
      const elevation = (tile.elevation || 0) * 0.45;
      
      let h = 1.0;
      if (archetype === 'RES_SMALL') h = 0.4 + (tile.level || 1) * 0.1;
      else if (archetype === 'RES_MED') h = 0.8 + (tile.level || 1) * 0.2;
      else if (archetype === 'RES_TOWER') h = 1.5 + (tile.level || 1) * 0.3;

      dummyMatrix.identity();
      dummyMatrix.setPosition(wx, elevation + h / 2 + 0.01, wz);
      // We could add random rotation here if we wanted
      mesh.setMatrixAt(i, dummyMatrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [tiles, archetype, gridWidth, gridHeight]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, tiles.length]}
      castShadow
      receiveShadow
    />
  );
}
