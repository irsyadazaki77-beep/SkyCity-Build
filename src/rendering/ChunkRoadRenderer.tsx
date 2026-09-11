import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TileData } from '../types';
import { GridRoadNetwork, RoadGeometryBatch } from '../core/world/GridRoadNetwork';
import { CHUNK_SIZE } from '../core/simulation/ChunkManager';
import { gridToWorld, TILE_SIZE } from '../components/world/types3D';
import { RoadAsphaltShaderMaterial, RoadMarkingShaderMaterial, BridgeShaderMaterial } from './CustomMaterials';

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

  const asphaltMat = useMemo(() => RoadAsphaltShaderMaterial(), []);
  const markingsMat = useMemo(() => RoadMarkingShaderMaterial(), []);
  const bridgeMat = useMemo(() => BridgeShaderMaterial(showRoadWaterIntersections), [showRoadWaterIntersections]);

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
            <mesh geometry={chunk.batch.markingsGeo} material={markingsMat} />
          )}
          {chunk.batch.curbGeo.attributes.position && chunk.batch.curbGeo.attributes.position.count > 0 && (
            <mesh geometry={chunk.batch.curbGeo} receiveShadow castShadow>
              <meshStandardMaterial color="#94a3b8" roughness={0.75} metalness={0.08} />
            </mesh>
          )}
          {chunk.batch.bridgeGeo.attributes.position && chunk.batch.bridgeGeo.attributes.position.count > 0 && (
            <mesh geometry={chunk.batch.bridgeGeo} material={bridgeMat} receiveShadow castShadow />
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

