import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../types';
import { gridToWorld } from '../components/world/types3D';

interface InstancedBuildingRendererProps {
  grid: TileData[][];
  buildingRevision: number;
  nightFactor: number;
  onBuildingBatchUpdate?: (count: number) => void;
}

const dummyMatrix = new THREE.Matrix4();
const dummyColor = new THREE.Color();

// Color maps by zone type
const ZONE_COLORS: Record<number, string[]> = {
  [TileType.RESIDENTIAL]: ['#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d'],
  [TileType.COMMERCIAL]: ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'],
  [TileType.INDUSTRIAL]: ['#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'],
  [TileType.POWER_PLANT]: ['#64748b'],
  [TileType.WATER_PUMP]: ['#0284c7'],
  [TileType.FIRE_STATION]: ['#ef4444'],
  [TileType.POLICE_STATION]: ['#1e40af'],
  [TileType.CLINIC]: ['#14b8a6'],
  [TileType.SCHOOL]: ['#a855f7'],
  [TileType.WASTE_MANAGEMENT]: ['#78716c'],
  [TileType.PARK]: ['#10b981'],
};

export function InstancedBuildingRenderer({
  grid,
  buildingRevision,
  nightFactor,
  onBuildingBatchUpdate,
}: InstancedBuildingRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const prevRevisionRef = useRef<number>(-1);
  const cachedBuildingsRef = useRef<TileData[]>([]);

  // Scan building tiles only when buildingRevision changes
  const buildingTiles = useMemo(() => {
    if (cachedBuildingsRef.current.length > 0 && prevRevisionRef.current === buildingRevision) {
      return cachedBuildingsRef.current;
    }

    prevRevisionRef.current = buildingRevision;
    const list: TileData[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD) {
          list.push(tile);
        }
      }
    }
    cachedBuildingsRef.current = list;
    return list;
  }, [buildingRevision, grid, width, height]);

  // Update instance transforms (only when buildingRevision changes)
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const count = buildingTiles.length;

    for (let i = 0; i < count; i++) {
      const tile = buildingTiles[i];
      const [wx, , wz] = gridToWorld(tile.x, tile.y, width, height);
      const elevation = (tile.elevation || 0) * 0.45;

      const lvl = Math.max(1, Math.min(5, tile.level || 1));
      let buildingHeight = 0.4 + lvl * 0.35;
      let buildingWidth = 0.65;
      let buildingDepth = 0.65;

      if (tile.type === TileType.POWER_PLANT) {
        buildingHeight = 1.2;
        buildingWidth = 0.75;
      } else if (tile.type === TileType.WATER_PUMP) {
        buildingHeight = 0.5;
        buildingWidth = 0.6;
      } else if (tile.type === TileType.PARK) {
        buildingHeight = 0.08;
        buildingWidth = 0.8;
        buildingDepth = 0.8;
      }

      dummyMatrix.identity();
      dummyMatrix.makeScale(buildingWidth, buildingHeight, buildingDepth);
      dummyMatrix.setPosition(wx, elevation + buildingHeight / 2 + 0.02, wz);

      mesh.setMatrixAt(i, dummyMatrix);

      // Initial color assignment
      const palette = ZONE_COLORS[tile.type] || ['#94a3b8'];
      const baseColorHex = palette[(lvl - 1) % palette.length];
      dummyColor.set(tile.abandoned ? '#475569' : baseColorHex);

      if (nightFactor > 0.2 && tile.powered && !tile.abandoned && tile.type !== TileType.PARK) {
        dummyColor.lerp(new THREE.Color('#fef08a'), nightFactor * 0.4);
      }

      mesh.setColorAt(i, dummyColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (onBuildingBatchUpdate) {
      onBuildingBatchUpdate(1);
    }
  }, [buildingRevision, buildingTiles, width, height, onBuildingBatchUpdate]);

  // Fast-path color updates on night cycle change without recalculating matrices
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const count = buildingTiles.length;

    for (let i = 0; i < count; i++) {
      const tile = buildingTiles[i];
      const lvl = Math.max(1, Math.min(5, tile.level || 1));
      const palette = ZONE_COLORS[tile.type] || ['#94a3b8'];
      const baseColorHex = palette[(lvl - 1) % palette.length];
      dummyColor.set(tile.abandoned ? '#475569' : baseColorHex);

      if (nightFactor > 0.2 && tile.powered && !tile.abandoned && tile.type !== TileType.PARK) {
        dummyColor.lerp(new THREE.Color('#fef08a'), nightFactor * 0.4);
      }

      mesh.setColorAt(i, dummyColor);
    }

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nightFactor, buildingTiles]);

  const maxInstances = Math.max(1, buildingTiles.length);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, maxInstances]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.2}
      />
    </instancedMesh>
  );
}
