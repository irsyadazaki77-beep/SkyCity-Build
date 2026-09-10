import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { TileData, TileType, OverlayMode, GraphicsQualityTier } from '../types';
import { TerrainMeshGenerator } from '../core/world/TerrainMesh';
import { CHUNK_SIZE } from '../core/simulation/ChunkManager';
import { gridToWorld, worldToGrid, TILE_SIZE } from '../components/world/types3D';
import { TerrainMaterial, WaterMaterial } from './CustomMaterials';
import { GraphicsState } from './GraphicsState';

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
  showWaterMask?: boolean;
  showShorelineContour?: boolean;
  showWaterRegions?: boolean;
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
  waterGeometry: THREE.BufferGeometry | null;
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
  showWaterMask = false,
  showShorelineContour = false,
  showWaterRegions = false,
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
  const lastHoverRef = useRef<[number, number] | null>(null);

  const chunkCacheRef = useRef<Map<string, ChunkEntry>>(new Map());
  const [chunkList, setChunkList] = useState<ChunkEntry[]>([]);
  const prevTerrainRevisionRef = useRef<number>(-1);
  const prevQualityRef = useRef<GraphicsQualityTier>(graphicsQuality);

  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const waterMeshRefs = useRef<Map<string, THREE.Mesh>>(new Map());
  const frustumRef = useRef(new THREE.Frustum());
  const projScreenMatrixRef = useRef(new THREE.Matrix4());
  const lastVisibleCountRef = useRef(-1);
  const frameCountRef = useRef(0);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!instancedMeshRef.current) return;
    const mesh = instancedMeshRef.current;
    const count = dragPreviewTiles.length;
    mesh.count = count;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const [px, py] = dragPreviewTiles[i];
      const [wx, , wz] = gridToWorld(px, py, width, height);
      const el = (grid[py]?.[px]?.elevation || 0) * 0.45;

      dummy.position.set(wx, el + 0.04, wz);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [dragPreviewTiles, grid, width, height]);

  // Materials
  const terrainMat = useMemo(() => TerrainMaterial(), []);
  const waterMat = useMemo(() => WaterMaterial(), []);

  // Update debug uniforms on material
  useEffect(() => {
    if (terrainMat.uniforms.uShowWaterMask) {
      terrainMat.uniforms.uShowWaterMask.value = showWaterMask ? 1.0 : 0.0;
    }
    if (terrainMat.uniforms.uShowShoreline) {
      terrainMat.uniforms.uShowShoreline.value = showShorelineContour ? 1.0 : 0.0;
    }
  }, [terrainMat, showWaterMask, showShorelineContour]);

  useEffect(() => {
    const isFirstRun = prevTerrainRevisionRef.current === -1;
    const revisionChanged = terrainRevision !== prevTerrainRevisionRef.current;
    const qualityChanged = graphicsQuality !== prevQualityRef.current;

    if (!isFirstRun && !revisionChanged && !qualityChanged) return;

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
          if (existing?.geometry) existing.geometry.dispose();
          if (existing?.waterGeometry) existing.waterGeometry.dispose();
          let lod = graphicsQuality === 'low' ? 1 : 0;

          const geometry = TerrainMeshGenerator.generateChunkGeometry(grid, minX, minY, maxX, maxY, width, height, lod);
          const waterGeometry = TerrainMeshGenerator.generateChunkWaterGeometry(grid, minX, minY, maxX, maxY, width, height, lod);

          cache.set(id, { id, cx, cy, minX, minY, maxX, maxY, centerWorld, box, geometry, waterGeometry, lod });
          rebuildCount++;
        }
      }
    }

    if (rebuildCount > 0) {
      if (onChunkRebuild) onChunkRebuild(rebuildCount);
      setChunkList(Array.from(cache.values()));
    }
  }, [grid, terrainRevision, dirtyTerrainChunks, width, height, chunksX, chunksY, graphicsQuality, onChunkRebuild]);

  useFrame(({ camera }) => {
    projScreenMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

    let visibleCount = 0;
    const cache = chunkCacheRef.current;
    const camPos = camera.position;

    frameCountRef.current++;
    const shouldCheckLOD = frameCountRef.current % 30 === 0;

    meshRefs.current.forEach((mesh, id) => {
      const entry = cache.get(id);
      if (!entry) return;
      const waterMesh = waterMeshRefs.current.get(id);

      const isVisible = frustumRef.current.intersectsBox(entry.box);
      mesh.visible = isVisible;
      if (waterMesh) waterMesh.visible = isVisible;
      if (isVisible) visibleCount++;

      // Adaptive camera LOD with Hysteresis
      if (shouldCheckLOD && isVisible && graphicsQuality !== 'low') {
        const dist = camPos.distanceTo(entry.centerWorld);
        
        let targetLod = entry.lod;
        if (entry.lod === 0 && dist > 48) targetLod = 1;
        else if (entry.lod === 1 && dist < 38) targetLod = 0;

        if (targetLod !== entry.lod) {
          entry.lod = targetLod;
          const oldGeo = entry.geometry;
          const oldWaterGeo = entry.waterGeometry;
          
          entry.geometry = TerrainMeshGenerator.generateChunkGeometry(
            grid, entry.minX, entry.minY, entry.maxX, entry.maxY, width, height, targetLod
          );
          entry.waterGeometry = TerrainMeshGenerator.generateChunkWaterGeometry(
            grid, entry.minX, entry.minY, entry.maxX, entry.maxY, width, height, targetLod
          );
          
          mesh.geometry = entry.geometry;
          if (waterMesh && entry.waterGeometry) {
            waterMesh.geometry = entry.waterGeometry;
          }
          
          oldGeo.dispose();
          if (oldWaterGeo) oldWaterGeo.dispose();
        }
      }
    });

    if (visibleCount !== lastVisibleCountRef.current) {
      lastVisibleCountRef.current = visibleCount;
      if (onVisibleChunksChange) onVisibleChunksChange(visibleCount);
    }
  });

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const [gx, gy] = worldToGrid(e.point.x, e.point.z, width, height);
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
      const prevHover = lastHoverRef.current;
      if (!prevHover || prevHover[0] !== gx || prevHover[1] !== gy) {
        lastHoverRef.current = [gx, gy];
        setHoverTile([gx, gy]);
        onTilePointerEnter(gx, gy);
      }
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const [gx, gy] = worldToGrid(e.point.x, e.point.z, width, height);
    if (gx >= 0 && gx < width && gy >= 0 && gy < height) onTileClick(gx, gy);
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

  return (
    <group name="ChunkTerrain">
      {chunkList.map((chunk) => (
        <group key={chunk.id}>
          <mesh
            ref={(el) => {
              if (el) meshRefs.current.set(chunk.id, el);
              else meshRefs.current.delete(chunk.id);
            }}
            geometry={chunk.geometry}
            material={terrainMat}
            receiveShadow
            onPointerMove={handlePointerMove}
            onClick={handleClick}
          />

          {/* Region-Masked Water Mesh for this Chunk */}
          {chunk.waterGeometry && (
            <mesh
              ref={(el) => {
                if (el) waterMeshRefs.current.set(chunk.id, el);
                else waterMeshRefs.current.delete(chunk.id);
              }}
              geometry={chunk.waterGeometry}
              material={waterMat}
              receiveShadow
            />
          )}

          {/* Water Region Debug Boundaries */}
          {showWaterRegions && chunk.waterGeometry && (
            <lineSegments position={chunk.centerWorld}>
              <edgesGeometry args={[new THREE.BoxGeometry((chunk.maxX - chunk.minX + 1) * TILE_SIZE, 0.5, (chunk.maxY - chunk.minY + 1) * TILE_SIZE)]} />
              <lineBasicMaterial color="#0284c7" linewidth={2} />
            </lineSegments>
          )}
        </group>
      ))}

      {/* Terraform Brush Ring Preview */}
      {isTerraforming && cursorWorldPos && (
        <mesh position={cursorWorldPos} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[brushSize * TILE_SIZE * 0.85, brushSize * TILE_SIZE, 32]} />
          <meshBasicMaterial
            color={activeTool === 'RAISE_TERRAIN' ? '#22c55e' : activeTool === 'LOWER_TERRAIN' ? '#ef4444' : '#3b82f6'}
            transparent opacity={0.7} side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Drag build preview tiles */}
      {dragPreviewTiles.length > 0 && (
        <instancedMesh
          ref={instancedMeshRef}
          args={[null as any, null as any, dragPreviewTiles.length]}
        >
          <planeGeometry args={[TILE_SIZE * 0.9, TILE_SIZE * 0.9]} />
          <meshBasicMaterial
            color={dragPreviewColor === 'red' ? '#ef4444' : '#22c55e'}
            transparent
            opacity={0.5}
          />
        </instancedMesh>
      )}
    </group>
  );
}
