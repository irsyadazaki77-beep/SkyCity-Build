import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { TileData, TileType, OverlayMode, GraphicsQualityTier } from '../types';
import { TerrainMeshGenerator } from '../core/world/TerrainMesh';
import { CHUNK_SIZE } from '../core/simulation/ChunkManager';
import { gridToWorld, worldToGrid, TILE_SIZE } from '../components/world/types3D';

interface ChunkTerrainRendererProps {
  grid: TileData[][];
  activeTool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  brushSize?: number;
  graphicsQuality?: GraphicsQualityTier;
  showChunkBoundaries?: boolean;
  showTerrainLOD?: boolean;
  onTileClick: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
}

export function ChunkTerrainRenderer({
  grid,
  activeTool,
  activeOverlay = 'NONE',
  brushSize = 1,
  graphicsQuality = 'high',
  showChunkBoundaries = false,
  showTerrainLOD = false,
  onTileClick,
  onTilePointerEnter,
  dragPreviewTiles = [],
  dragPreviewColor = 'green',
}: ChunkTerrainRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const chunksX = Math.ceil(width / CHUNK_SIZE);
  const chunksY = Math.ceil(height / CHUNK_SIZE);

  const [hoverTile, setHoverTile] = useState<[number, number] | null>(null);

  // Generate chunk geometries with adaptive LOD
  const chunkGeometries = useMemo(() => {
    const list: { id: string; geometry: THREE.BufferGeometry; minX: number; minY: number; maxX: number; maxY: number; lod: number }[] = [];

    // Center of map or camera focus point
    const centerX = width / 2;
    const centerY = height / 2;

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const minX = cx * CHUNK_SIZE;
        const minY = cy * CHUNK_SIZE;
        const maxX = Math.min(width - 1, (cx + 1) * CHUNK_SIZE - 1);
        const maxY = Math.min(height - 1, (cy + 1) * CHUNK_SIZE - 1);

        const chunkMidX = (minX + maxX) / 2;
        const chunkMidY = (minY + maxY) / 2;
        const distToCenter = Math.sqrt(Math.pow(chunkMidX - centerX, 2) + Math.pow(chunkMidY - centerY, 2));

        // Adaptive LOD based on distance to center & quality setting
        let lod = 0;
        if (graphicsQuality === 'low') {
          lod = 1;
        } else if (distToCenter > 28) {
          lod = 1;
        }

        const geo = TerrainMeshGenerator.generateChunkGeometry(grid, minX, minY, maxX, maxY, width, height, lod);
        list.push({ id: `${cx},${cy}`, geometry: geo, minX, minY, maxX, maxY, lod });
      }
    }

    return list;
  }, [grid, width, height, chunksX, chunksY, graphicsQuality]);

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

  // Compute cursor position in world space
  const cursorWorldPos = useMemo(() => {
    if (!hoverTile) return null;
    const [wx, , wz] = gridToWorld(hoverTile[0], hoverTile[1], width, height);
    const el = (grid[hoverTile[1]]?.[hoverTile[0]]?.elevation || 0) * 0.45;
    return [wx, el + 0.05, wz] as [number, number, number];
  }, [hoverTile, grid, width, height]);

  // Chunk boundary lines for debug
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
      {chunkGeometries.map((chunk) => (
        <mesh
          key={chunk.id}
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

      {/* Unified Batched Water Surface Plane */}
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

