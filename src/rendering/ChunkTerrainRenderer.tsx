import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { TileData, TileType, OverlayMode, GraphicsQualityTier } from '../types';
import { TerrainMeshGenerator } from '../core/world/TerrainMesh';
import { CHUNK_SIZE } from '../core/simulation/ChunkManager';
import { gridToWorld, worldToGrid, TILE_SIZE } from '../components/world/types3D';

interface ChunkTerrainRendererProps {
  grid: TileData[][];
  terrainRevision: number;
  dirtyTerrainChunks?: Set<string>;
  activeTool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  brushSize?: number;
  graphicsQuality?: GraphicsQualityTier;
  showChunkBoundaries?: boolean;
  showTerrainLOD?: boolean;
  onTileClick: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  onChunkRebuild?: (count: number) => void;
  onVisibleChunksChange?: (count: number) => void;
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
}

interface ChunkEntry {
  id: string;
  cx: number;
  cy: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerWorld: THREE.Vector3;
  box: THREE.Box3;
  geometry: THREE.BufferGeometry;
  lod: number;
}

export function ChunkTerrainRenderer({
  grid,
  terrainRevision,
  dirtyTerrainChunks,
  activeTool,
  activeOverlay = 'NONE',
  brushSize = 1,
  graphicsQuality = 'high',
  showChunkBoundaries = false,
  showTerrainLOD = false,
  onTileClick,
  onTilePointerEnter,
  onChunkRebuild,
  onVisibleChunksChange,
  dragPreviewTiles = [],
  dragPreviewColor = 'green',
}: ChunkTerrainRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const chunksX = Math.ceil(width / CHUNK_SIZE);
  const chunksY = Math.ceil(height / CHUNK_SIZE);

  const [hoverTile, setHoverTile] = useState<[number, number] | null>(null);

  // Chunk geometries cache: id -> ChunkEntry
  const chunkCacheRef = useRef<Map<string, ChunkEntry>>(new Map());
  const [chunkList, setChunkList] = useState<ChunkEntry[]>([]);
  const prevTerrainRevisionRef = useRef<number>(-1);
  const prevQualityRef = useRef<GraphicsQualityTier>(graphicsQuality);

  // Camera frustum for culling
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const frustumRef = useRef(new THREE.Frustum());
  const projScreenMatrixRef = useRef(new THREE.Matrix4());
  const lastVisibleCountRef = useRef(-1);

  // Incremental chunk generation
  useEffect(() => {
    const isFirstRun = prevTerrainRevisionRef.current === -1;
    const revisionChanged = terrainRevision !== prevTerrainRevisionRef.current;
    const qualityChanged = graphicsQuality !== prevQualityRef.current;

    if (!isFirstRun && !revisionChanged && !qualityChanged) {
      return;
    }

    prevTerrainRevisionRef.current = terrainRevision;
    prevQualityRef.current = graphicsQuality;

    const cache = chunkCacheRef.current;
    let rebuildCount = 0;

    const isAllDirty = isFirstRun || !dirtyTerrainChunks || dirtyTerrainChunks.has('all');

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const id = `${cx},${cy}`;
        const minX = cx * CHUNK_SIZE;
        const minY = cy * CHUNK_SIZE;
        const maxX = Math.min(width - 1, (cx + 1) * CHUNK_SIZE - 1);
        const maxY = Math.min(height - 1, (cy + 1) * CHUNK_SIZE - 1);

        const chunkMidXW = ((minX + maxX + 1) / 2 - width / 2) * TILE_SIZE;
        const chunkMidZW = ((minY + maxY + 1) / 2 - height / 2) * TILE_SIZE;
        const centerWorld = new THREE.Vector3(chunkMidXW, 0, chunkMidZW);

        const halfW = ((maxX - minX + 1) * TILE_SIZE) / 2;
        const halfD = ((maxY - minY + 1) * TILE_SIZE) / 2;
        const box = new THREE.Box3(
          new THREE.Vector3(chunkMidXW - halfW, -2, chunkMidZW - halfD),
          new THREE.Vector3(chunkMidXW + halfW, 8, chunkMidZW + halfD)
        );

        const existing = cache.get(id);
        const shouldRebuild = isAllDirty || dirtyTerrainChunks.has(id) || !existing;

        if (shouldRebuild) {
          if (existing?.geometry) {
            existing.geometry.dispose();
          }

          let lod = 0;
          if (graphicsQuality === 'low') lod = 1;

          const geometry = TerrainMeshGenerator.generateChunkGeometry(
            grid,
            minX,
            minY,
            maxX,
            maxY,
            width,
            height,
            lod
          );

          cache.set(id, {
            id,
            cx,
            cy,
            minX,
            minY,
            maxX,
            maxY,
            centerWorld,
            box,
            geometry,
            lod,
          });

          rebuildCount++;
        }
      }
    }

    if (rebuildCount > 0) {
      if (onChunkRebuild) onChunkRebuild(rebuildCount);
      setChunkList(Array.from(cache.values()));
    }
  }, [grid, terrainRevision, dirtyTerrainChunks, width, height, chunksX, chunksY, graphicsQuality, onChunkRebuild]);

  // Frame-by-frame camera LOD & Frustum Culling
  useFrame(({ camera }) => {
    projScreenMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

    let visibleCount = 0;
    const cache = chunkCacheRef.current;
    const camPos = camera.position;

    meshRefs.current.forEach((mesh, id) => {
      const entry = cache.get(id);
      if (!entry) return;

      const isVisible = frustumRef.current.intersectsBox(entry.box);
      mesh.visible = isVisible;
      if (isVisible) visibleCount++;

      // Adaptive camera LOD: if chunk is within 40 units, use LOD 0. If > 40 units, use LOD 1.
      if (isVisible && graphicsQuality !== 'low') {
        const dist = camPos.distanceTo(entry.centerWorld);
        const targetLod = dist > 42 ? 1 : 0;
        if (targetLod !== entry.lod) {
          entry.lod = targetLod;
          entry.geometry.dispose();
          entry.geometry = TerrainMeshGenerator.generateChunkGeometry(
            grid,
            entry.minX,
            entry.minY,
            entry.maxX,
            entry.maxY,
            width,
            height,
            targetLod
          );
          mesh.geometry = entry.geometry;
        }
      }
    });

    if (visibleCount !== lastVisibleCountRef.current) {
      lastVisibleCountRef.current = visibleCount;
      if (onVisibleChunksChange) {
        onVisibleChunksChange(visibleCount);
      }
    }
  });

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const point = e.point;
    const [gx, gy] = worldToGrid(point.x, point.z, width, height);
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
      setHoverTile([gx, gy]);
      onTilePointerEnter(gx, gy);
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const point = e.point;
    const [gx, gy] = worldToGrid(point.x, point.z, width, height);
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
      onTileClick(gx, gy);
    }
  };

  const isTerraforming =
    activeTool === 'RAISE_TERRAIN' ||
    activeTool === 'LOWER_TERRAIN' ||
    activeTool === 'LEVEL_TERRAIN' ||
    activeTool === 'SMOOTH_TERRAIN';

  const cursorWorldPos = useMemo(() => {
    if (!hoverTile) return null;
    const [wx, , wz] = gridToWorld(hoverTile[0], hoverTile[1], width, height);
    const el = (grid[hoverTile[1]]?.[hoverTile[0]]?.elevation || 0) * 0.45;
    return [wx, el + 0.05, wz] as [number, number, number];
  }, [hoverTile, grid, width, height]);

  const chunkBoundaryHelpers = useMemo(() => {
    if (!showChunkBoundaries) return [];
    const helpers: { id: string; position: [number, number, number]; size: [number, number, number] }[] = [];

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const minX = cx * CHUNK_SIZE;
        const minY = cy * CHUNK_SIZE;
        const maxX = Math.min(width - 1, (cx + 1) * CHUNK_SIZE - 1);
        const maxY = Math.min(height - 1, (cy + 1) * CHUNK_SIZE - 1);

        const w = (maxX - minX + 1) * TILE_SIZE;
        const d = (maxY - minY + 1) * TILE_SIZE;

        const cxW = ((minX + maxX + 1) / 2 - width / 2) * TILE_SIZE;
        const czW = ((minY + maxY + 1) / 2 - height / 2) * TILE_SIZE;

        helpers.push({
          id: `boundary-${cx}-${cy}`,
          position: [cxW, 1.5, czW],
          size: [w, 3.0, d],
        });
      }
    }
    return helpers;
  }, [showChunkBoundaries, chunksX, chunksY, width, height]);

  return (
    <group name="ChunkTerrain">
      {chunkList.map((chunk) => (
        <mesh
          key={chunk.id}
          ref={(el) => {
            if (el) meshRefs.current.set(chunk.id, el);
            else meshRefs.current.delete(chunk.id);
          }}
          geometry={chunk.geometry}
          receiveShadow
          onPointerMove={handlePointerMove}
          onClick={handleClick}
        >
          <meshStandardMaterial
            vertexColors
            roughness={0.82}
            metalness={0.08}
            wireframe={showTerrainLOD}
          />
        </mesh>
      ))}

      {/* Batched Unified Water Surface Plane */}
      <mesh
        position={[0, 0.0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[width * TILE_SIZE, height * TILE_SIZE]} />
        <meshStandardMaterial
          color="#0284c7"
          roughness={0.08}
          metalness={0.8}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Debug Chunk Boundary Boxes */}
      {showChunkBoundaries &&
        chunkBoundaryHelpers.map((h) => (
          <mesh key={h.id} position={h.position}>
            <boxGeometry args={h.size} />
            <meshBasicMaterial color="#a855f7" wireframe />
          </mesh>
        ))}

      {/* Terraform Brush Ring Preview */}
      {isTerraforming && cursorWorldPos && (
        <mesh position={cursorWorldPos} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[brushSize * TILE_SIZE * 0.85, brushSize * TILE_SIZE, 32]} />
          <meshBasicMaterial
            color={activeTool === 'RAISE_TERRAIN' ? '#22c55e' : activeTool === 'LOWER_TERRAIN' ? '#ef4444' : '#3b82f6'}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Drag build preview tiles */}
      {dragPreviewTiles.map(([px, py]) => {
        const [wx, , wz] = gridToWorld(px, py, width, height);
        const el = (grid[py]?.[px]?.elevation || 0) * 0.45;
        return (
          <mesh key={`drag-${px}-${py}`} position={[wx, el + 0.04, wz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[TILE_SIZE * 0.9, TILE_SIZE * 0.9]} />
            <meshBasicMaterial
              color={dragPreviewColor === 'red' ? '#ef4444' : '#22c55e'}
              transparent
              opacity={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}
