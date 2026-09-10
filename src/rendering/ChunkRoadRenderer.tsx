import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TileData } from '../types';
import { GridRoadNetwork, RoadGeometryBatch } from '../core/world/GridRoadNetwork';
import { CHUNK_SIZE } from '../core/simulation/ChunkManager';
import { gridToWorld, TILE_SIZE } from '../components/world/types3D';
import { GraphicsState } from './GraphicsState';

interface ChunkRoadRendererProps {
  grid: TileData[][];
  roadRevision: number;
  dirtyRoadChunks?: Set<string>;
  showRoadSegments?: boolean;
  showRoadWaterIntersections?: boolean;
  onRoadRebuild?: (count: number) => void;
}

interface RoadChunkEntry {
  id: string;
  box: THREE.Box3;
  batch: RoadGeometryBatch;
}

const AsphaltMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uNightFactor: GraphicsState.uniforms.uNightFactor,
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        mat3 m = mat3(modelMatrix);
        vNormal = normalize(m * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uNightFactor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        float grain = hash(vWorldPosition.xz * 100.0) * 0.1;
        float macro = hash(vWorldPosition.xz * 5.0) * 0.05;
        vec3 color = vec3(0.12, 0.14, 0.18) + grain + macro;
        
        vec3 normal = normalize(vNormal);
        float dotL = max(0.2, dot(normal, uSunDirection));
        
        vec3 diffuse = color * dotL * (1.0 - uNightFactor * 0.8);
        diffuse += vec3(0.01, 0.02, 0.08) * uNightFactor;

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `
  });
};

export function ChunkRoadRenderer({
  grid,
  roadRevision,
  dirtyRoadChunks,
  showRoadSegments = false,
  showRoadWaterIntersections = false,
  onRoadRebuild,
}: ChunkRoadRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const chunksX = Math.ceil(width / CHUNK_SIZE);
  const chunksY = Math.ceil(height / CHUNK_SIZE);

  const chunkCacheRef = useRef<Map<string, RoadChunkEntry>>(new Map());
  const [chunkList, setChunkList] = useState<RoadChunkEntry[]>([]);
  const prevRoadRevisionRef = useRef<number>(-1);

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const frustumRef = useRef(new THREE.Frustum());
  const projScreenMatrixRef = useRef(new THREE.Matrix4());

  useEffect(() => {
    const isFirstRun = prevRoadRevisionRef.current === -1;
    const revisionChanged = roadRevision !== prevRoadRevisionRef.current;

    if (!isFirstRun && !revisionChanged) return;

    prevRoadRevisionRef.current = roadRevision;

    const cache = chunkCacheRef.current;
    let rebuildCount = 0;
    const isAllDirty = isFirstRun || !dirtyRoadChunks || dirtyRoadChunks.has('all');

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const id = `${cx},${cy}`;
        const minX = cx * CHUNK_SIZE;
        const minY = cy * CHUNK_SIZE;
        const maxX = Math.min(width - 1, (cx + 1) * CHUNK_SIZE - 1);
        const maxY = Math.min(height - 1, (cy + 1) * CHUNK_SIZE - 1);

        const chunkMidXW = ((minX + maxX + 1) / 2 - width / 2) * TILE_SIZE;
        const chunkMidZW = ((minY + maxY + 1) / 2 - height / 2) * TILE_SIZE;
        
        const halfW = ((maxX - minX + 1) * TILE_SIZE) / 2;
        const halfD = ((maxY - minY + 1) * TILE_SIZE) / 2;
        const box = new THREE.Box3(
          new THREE.Vector3(chunkMidXW - halfW, -2, chunkMidZW - halfD),
          new THREE.Vector3(chunkMidXW + halfW, 8, chunkMidZW + halfD)
        );

        const existing = cache.get(id);
        const shouldRebuild = isAllDirty || dirtyRoadChunks.has(id) || !existing;

        if (shouldRebuild) {
          if (existing?.batch) {
            existing.batch.asphaltGeo.dispose();
            existing.batch.markingsGeo.dispose();
            existing.batch.curbGeo.dispose();
            existing.batch.bridgeGeo.dispose();
            existing.batch.debugGeo.dispose();
          }

          const batch = GridRoadNetwork.generateChunkRoadGeometry(grid, width, height, minX, minY, maxX, maxY);
          cache.set(id, { id, box, batch });
          rebuildCount++;
        }
      }
    }

    if (rebuildCount > 0) {
      if (onRoadRebuild) onRoadRebuild(rebuildCount);
      setChunkList(Array.from(cache.values()));
    }
  }, [grid, roadRevision, dirtyRoadChunks, width, height, chunksX, chunksY, onRoadRebuild]);

  useFrame(({ camera }) => {
    projScreenMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

    const cache = chunkCacheRef.current;
    groupRefs.current.forEach((group, id) => {
      const entry = cache.get(id);
      if (!entry) return;
      group.visible = frustumRef.current.intersectsBox(entry.box);
    });
  });

  const asphaltMat = useMemo(() => AsphaltMaterial(), []);

  return (
    <group name="ChunkRoads">
      {chunkList.map((chunk) => (
        <group
          key={chunk.id}
          ref={(el) => {
            if (el) groupRefs.current.set(chunk.id, el);
            else groupRefs.current.delete(chunk.id);
          }}
        >
          {chunk.batch.asphaltGeo.attributes.position && chunk.batch.asphaltGeo.attributes.position.count > 0 && (
            <mesh geometry={chunk.batch.asphaltGeo} material={asphaltMat} receiveShadow castShadow />
          )}
          {chunk.batch.markingsGeo.attributes.position && chunk.batch.markingsGeo.attributes.position.count > 0 && (
            <mesh geometry={chunk.batch.markingsGeo}>
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
          )}
          {chunk.batch.curbGeo.attributes.position && chunk.batch.curbGeo.attributes.position.count > 0 && (
            <mesh geometry={chunk.batch.curbGeo} receiveShadow castShadow>
              <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
            </mesh>
          )}
          {chunk.batch.bridgeGeo.attributes.position && chunk.batch.bridgeGeo.attributes.position.count > 0 && (
            <mesh geometry={chunk.batch.bridgeGeo} receiveShadow castShadow>
              <meshStandardMaterial
                color={showRoadWaterIntersections ? '#f97316' : '#64748b'}
                emissive={showRoadWaterIntersections ? '#f97316' : '#000000'}
                emissiveIntensity={showRoadWaterIntersections ? 0.6 : 0}
                roughness={0.65}
                metalness={0.3}
              />
            </mesh>
          )}
          {showRoadSegments && chunk.batch.debugGeo.attributes.position && chunk.batch.debugGeo.attributes.position.count > 0 && (
            <mesh geometry={chunk.batch.debugGeo}>
              <meshBasicMaterial color="#38bdf8" wireframe />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
