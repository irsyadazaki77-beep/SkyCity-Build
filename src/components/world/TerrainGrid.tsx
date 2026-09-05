import React, { useState, useMemo } from 'react';
import * as THREE from 'three';
import { TileData, TileType, BUILD_COSTS, OverlayMode } from '../../types';
import { gridToWorld, worldToGrid, TILE_SIZE } from './types3D';

interface TerrainGridProps {
  grid: TileData[][];
  activeTool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
  money: number;
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  unlockedRegions?: string[]; // e.g. ["1,1"]
  mapExpansionMode?: boolean;
  brushSize?: number; // 1 to 3
  onTileClick: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  onUnlockRegion?: (rx: number, ry: number) => void;
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
}

function getOverlayColor(tile: TileData, overlay: string): string | null {
  if (overlay === 'NONE') return null;

  if (overlay === 'NATURAL_RESOURCES') {
    if (tile.water) return null;
    if (tile.resource === 'fertile') return '#84cc16'; // Lime green
    if (tile.resource === 'forest') return '#15803d';  // Rich green
    if (tile.resource === 'ore') return '#b45309';     // Bronze/Copper orange
    if (tile.resource === 'oil') return '#1e1b4b';     // Dark oil midnight-blue
    return null;
  }

  if (overlay === 'TRAFFIC') {
    if (tile.type !== TileType.ROAD) return null;
    const t = tile.traffic || 0;
    if (t < 5) return '#22c55e';
    if (t < 15) return '#eab308';
    return '#ef4444';
  }

  if (overlay === 'POWER') {
    if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) return null;
    return tile.powered ? '#06b6d4' : '#ef4444';
  }

  if (overlay === 'WATER') {
    if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) return null;
    return tile.watered ? '#3b82f6' : '#ef4444';
  }

  if (overlay === 'POLLUTION') {
    const p = tile.pollution || 0;
    if (p < 10) return '#22c55e';
    if (p < 30) return '#f59e0b';
    return '#ef4444';
  }

  if (overlay === 'LAND_VALUE') {
    const v = tile.landValue || 35;
    if (v > 60) return '#10b981';
    if (v > 30) return '#eab308';
    return '#64748b';
  }

  if (overlay === 'CRIME') {
    const c = tile.crime || 0;
    if (c > 30) return '#a855f7';
    if (c > 10) return '#f59e0b';
    return '#22c55e';
  }

  if (overlay === 'EDUCATION') {
    const ed = tile.education || 0;
    if (ed > 50) return '#38bdf8';
    if (ed > 20) return '#f59e0b';
    return '#64748b';
  }

  if (overlay === 'HAPPINESS') {
    if (tile.type === TileType.RESIDENTIAL) {
      return (tile.population > 0) ? '#10b981' : '#f59e0b';
    }
  }

  return null;
}

export function TerrainGrid({
  grid,
  activeTool,
  money,
  activeOverlay = 'NONE',
  unlockedRegions = ['1,1'],
  mapExpansionMode = false,
  brushSize = 1,
  onTileClick,
  onTilePointerEnter,
  onUnlockRegion,
  dragPreviewTiles = [],
  dragPreviewColor = 'green',
}: TerrainGridProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const [hoveredTile, setHoveredTile] = useState<[number, number] | null>(null);

  // Check if a tile is inside any unlocked region
  const isTileUnlocked = (x: number, y: number): boolean => {
    const rx = Math.floor(x / 20);
    const ry = Math.floor(y / 20);
    return unlockedRegions.includes(`${rx},${ry}`);
  };

  // Ground plane geometry (base level underneath the grid)
  const groundGeo = useMemo(() => {
    return new THREE.BoxGeometry(width * TILE_SIZE + 4, 0.2, height * TILE_SIZE + 4);
  }, [width, height]);

  const terrainMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.95,
    });
  }, []);

  const defaultTileMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.9,
    side: THREE.DoubleSide,
  }), []);

  const waterTileMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0284c7', // Beautiful deep cyan
    roughness: 0.08,
    metalness: 0.75,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  }), []);

  const tileOutlineGeo = useMemo(() => new THREE.PlaneGeometry(0.96, 0.96), []);

  // Compute preview info for cursor hovered tile or brushes
  const previewInfo = useMemo(() => {
    if (!hoveredTile) return null;
    const [hx, hy] = hoveredTile;

    if (hx < 0 || hx >= width || hy < 0 || hy >= height) return null;
    const targetTile = grid[hy][hx];
    const tileUnlocked = isTileUnlocked(hx, hy);

    let color = '#38bdf8'; // Blue for pointer
    let isValid = true;

    const isTerraforming = ['RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'].includes(activeTool as any);

    if (mapExpansionMode) {
      color = '#eab308'; // Orange for expansion clicks
      isValid = !tileUnlocked;
    } else if (!tileUnlocked && activeTool !== 'POINTER') {
      color = '#ef4444'; // Cannot construct on locked tiles
      isValid = false;
    } else if (activeTool === 'BULLDOZER') {
      color = '#ef4444';
      isValid = targetTile.type !== TileType.EMPTY;
    } else if (isTerraforming) {
      color = '#06b6d4'; // Cyan for terrain modifications
      isValid = money >= 15;
    } else if (activeTool !== 'POINTER') {
      const cost = BUILD_COSTS[activeTool as TileType] || 0;
      // Normal placement
      const canPlace = targetTile.type === TileType.EMPTY && !targetTile.water;
      // Water pump must be placed adjacent to water
      let adjWaterOk = true;
      if (activeTool === TileType.WATER_PUMP) {
        // Must be built on ground next to water
        let hasAdjWater = false;
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of dirs) {
          const nx = hx + dx;
          const ny = hy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (grid[ny][nx].water) hasAdjWater = true;
          }
        }
        adjWaterOk = hasAdjWater;
      }

      isValid = canPlace && adjWaterOk && money >= cost;
      color = isValid ? '#22c55e' : '#ef4444';
    }

    const [wx, , wz] = gridToWorld(hx, hy, width, height);
    const wy = (targetTile.elevation || 0) * 0.15;
    return { wx, wy, wz, color, isValid };
  }, [hoveredTile, activeTool, money, grid, width, height, unlockedRegions, mapExpansionMode]);

  // Compute set of coordinates within the brush radius
  const brushTiles = useMemo(() => {
    if (!hoveredTile || !['RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'].includes(activeTool as any)) return [];
    const [hx, hy] = hoveredTile;
    const tiles: [number, number][] = [];
    const radius = brushSize - 1;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = hx + dx;
        const ty = hy + dy;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
          tiles.push([tx, ty]);
        }
      }
    }
    return tiles;
  }, [hoveredTile, activeTool, brushSize, width, height]);

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    const point = e.point;
    const coords = worldToGrid(point.x, point.z, width, height);
    if (coords) {
      const [x, y] = coords;
      if (!hoveredTile || hoveredTile[0] !== x || hoveredTile[1] !== y) {
        setHoveredTile([x, y]);
        onTilePointerEnter(x, y);
      }
    } else {
      setHoveredTile(null);
    }
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (hoveredTile) {
      const [hx, hy] = hoveredTile;
      const tileUnlocked = isTileUnlocked(hx, hy);
      if (mapExpansionMode && !tileUnlocked) {
        const rx = Math.floor(hx / 20);
        const ry = Math.floor(hy / 20);
        if (onUnlockRegion) onUnlockRegion(rx, ry);
      } else {
        onTileClick(hx, hy);
      }
    }
  };

  // Solid block to hide locked regions
  const lockedRegionMesh = useMemo(() => {
    return new THREE.BoxGeometry(20, 1.5, 20);
  }, []);

  const lockedRegionMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#090d16',
      roughness: 0.9,
      transparent: true,
      opacity: 0.85,
    });
  }, []);

  return (
    <group name="TerrainGrid">
      {/* Absolute base floor under the world */}
      <mesh geometry={groundGeo} material={terrainMat} position={[0, -0.15, 0]} receiveShadow />

      {/* Main interaction canvas plane */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerOut={() => setHoveredTile(null)}
        receiveShadow
      >
        <planeGeometry args={[width * TILE_SIZE, height * TILE_SIZE]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.9} transparent opacity={0.0} />
      </mesh>

      {/* 1. Draw Grid Tiles with elevation-responsive coordinate positions */}
      {grid.map((row, y) =>
        row.map((tile, x) => {
          const tileUnlocked = isTileUnlocked(x, y);
          // Performance Optimization: Skip detailed grids if tile is locked and we're not in expansion mode
          if (!tileUnlocked && !mapExpansionMode) return null;

          const [wx, , wz] = gridToWorld(x, y, width, height);
          const tileY = (tile.elevation || 0) * 0.15;
          const overlayColor = getOverlayColor(tile, activeOverlay);

          return (
            <React.Fragment key={`tile-${x}-${y}`}>
              {/* Ground Voxel / Water Plane */}
              {tile.water ? (
                <mesh
                  geometry={tileOutlineGeo}
                  material={waterTileMat}
                  position={[wx, tileY + 0.01, wz]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  receiveShadow
                />
              ) : (
                tile.type === TileType.EMPTY && (
                  <mesh
                    geometry={tileOutlineGeo}
                    material={defaultTileMat}
                    position={[wx, tileY + 0.005, wz]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    receiveShadow
                  />
                )
              )}

              {/* Dynamic Overlay Color Grid */}
              {overlayColor && (
                <mesh
                  position={[wx, tileY + 0.03, wz]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <planeGeometry args={[0.96, 0.96]} />
                  <meshBasicMaterial color={overlayColor} transparent opacity={0.65} side={THREE.DoubleSide} />
                </mesh>
              )}
            </React.Fragment>
          );
        })
      )}

      {/* 2. Lock Overlay meshes for Region Expansions */}
      {Array.from({ length: 3 }).map((_, ry) =>
        Array.from({ length: 3 }).map((_, rx) => {
          const key = `${rx},${ry}`;
          const isUnlocked = unlockedRegions.includes(key);
          if (isUnlocked) return null;

          // Compute absolute center of region in world coords
          const rxCenter = rx * 20 + 10;
          const ryCenter = ry * 20 + 10;
          const [wx, , wz] = gridToWorld(rxCenter - 0.5, ryCenter - 0.5, width, height);

          return (
            <group key={`locked-region-${key}`}>
              {/* Translucent fog cover */}
              <mesh geometry={lockedRegionMesh} material={lockedRegionMat} position={[wx, 0.5, wz]} receiveShadow />
              
              {/* Solid bounding border of locked region */}
              <mesh position={[wx, 0.05, wz]}>
                <boxGeometry args={[20, 0.1, 20]} />
                <meshBasicMaterial color={mapExpansionMode ? '#eab308' : '#ef4444'} wireframe />
              </mesh>
            </group>
          );
        })
      )}

      {/* 3. Drag Placement Previews */}
      {dragPreviewTiles.length > 0 && dragPreviewTiles.map(([px, py], idx) => {
        const [pwx, , pwz] = gridToWorld(px, py, width, height);
        const tileY = (grid[py]?.[px]?.elevation || 0) * 0.15;
        const color = dragPreviewColor === 'green' ? '#22c55e' : '#ef4444';
        return (
          <group key={`drag-tile-${px}-${py}-${idx}`} position={[pwx, tileY + 0.045, pwz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.98, 0.2, 0.98]} />
              <meshBasicMaterial color={color} wireframe />
            </mesh>
          </group>
        );
      })}

      {/* 4. Circular Terraforming Brush Overlay Preview */}
      {brushTiles.length > 0 && brushTiles.map(([bx, by], idx) => {
        const [bwx, , bwz] = gridToWorld(bx, by, width, height);
        const tileY = (grid[by]?.[bx]?.elevation || 0) * 0.15;
        return (
          <group key={`brush-preview-${bx}-${by}-${idx}`} position={[bwx, tileY + 0.042, bwz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[0.98, 0.1, 0.98]} />
              <meshBasicMaterial color="#22d3ee" wireframe />
            </mesh>
          </group>
        );
      })}

      {/* 5. Standard Build Cursor Box (when no drag active) */}
      {previewInfo && dragPreviewTiles.length === 0 && brushTiles.length === 0 && (
        <group position={[previewInfo.wx, previewInfo.wy + 0.04, previewInfo.wz]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.98, 0.98]} />
            <meshBasicMaterial color={previewInfo.color} transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.98, 0.2, 0.98]} />
            <meshBasicMaterial color={previewInfo.color} wireframe />
          </mesh>
        </group>
      )}

      {/* Thicker 3D Grid borders dividing the regions */}
      <group name="RegionGridBorders">
        {/* Border line 1 (x = 20) */}
        <mesh position={[getOffsetX(width) + 19.5, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.2, height]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
        {/* Border line 2 (x = 40) */}
        <mesh position={[getOffsetX(width) + 39.5, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.2, height]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
        {/* Border line 3 (y = 20) */}
        <mesh position={[0, 0.1, getOffsetZ(height) + 19.5]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.1, 0.2, width]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
        {/* Border line 4 (y = 40) */}
        <mesh position={[0, 0.1, getOffsetZ(height) + 39.5]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.1, 0.2, width]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function getOffsetX(width: number) {
  return -(width * TILE_SIZE) / 2 + TILE_SIZE / 2;
}

function getOffsetZ(height: number) {
  return -(height * TILE_SIZE) / 2 + TILE_SIZE / 2;
}
