import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TileData, TileType, OverlayMode, GraphicsQualityTier } from '../types';
import { TerrainMeshGenerator } from '../core/world/TerrainMesh';
import { gridToWorld, TILE_SIZE } from '../components/world/types3D';
import { GraphicsState } from './GraphicsState';
import { BuildingArchitecture, getArchitectureColors } from './BuildingArchetypes';
import { BuildingShaderMaterial } from './CustomMaterials';
import { createBuildingGeometries } from './BuildingGeometries';
import { CHUNK_SIZE } from '../core/simulation/ChunkManager';

import { BuildingEntity } from '../core/simulation/entities/BuildingEntity';

interface InstancedBuildingRendererProps {
  grid: TileData[][];
  buildings?: Record<string, BuildingEntity>;
  buildingRevision: number;
  dirtyBuildingChunks?: Set<string>;
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  graphicsQuality?: GraphicsQualityTier;
  onBuildingBatchUpdate?: (count: number) => void;
}

interface BuildingInstance {
  tile: TileData;
  entity?: BuildingEntity;
  worldX: number;
  worldZ: number;
  elevation: number;
  footprintW: number;
  footprintL: number;
  variant: number;
}

interface ChunkBuildings {
  id: string;
  box: THREE.Box3;
  batches: Map<BuildingArchitecture, BuildingInstance[]>;
}

export function InstancedBuildingRenderer({
  grid,
  buildings,
  buildingRevision,
  dirtyBuildingChunks,
  activeOverlay = 'NONE',
  graphicsQuality = 'high',
  onBuildingBatchUpdate,
}: InstancedBuildingRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const chunksX = Math.ceil(width / CHUNK_SIZE);
  const chunksY = Math.ceil(height / CHUNK_SIZE);

  const chunkCacheRef = useRef<Map<string, ChunkBuildings>>(new Map());
  const [chunkList, setChunkList] = useState<ChunkBuildings[]>([]);
  const prevBuildingRevisionRef = useRef<number>(-1);
  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const frustumRef = useRef(new THREE.Frustum());
  const projScreenMatrixRef = useRef(new THREE.Matrix4());

  const buildingGeometries = useMemo(() => createBuildingGeometries(), []);

  const materials = useMemo(() => {
    const mats = new Map<BuildingArchitecture, THREE.ShaderMaterial>();
    const types: BuildingArchitecture[] = [
      'RES_TENT', 'RES_CABIN', 'RES_HOUSE', 'RES_APARTMENT', 'RES_HIGHRISE',
      'COM_STALL', 'COM_SHOP', 'COM_MALL', 'COM_TOWER', 'COM_PREMIUM_SKYSCRAPER',
      'IND_WORKSHOP', 'IND_WAREHOUSE', 'IND_FACTORY', 'IND_LOGISTICS', 'IND_HIGHTECH',
      'SRV_POWER', 'SRV_WATER', 'SRV_FIRE', 'SRV_POLICE', 'SRV_CLINIC', 'SRV_SCHOOL', 'SRV_WASTE', 'SRV_PARK'
    ];
    
    types.forEach(arch => {
      const { base, accent, patternType } = getArchitectureColors(arch);
      const mat = BuildingShaderMaterial(base, accent, patternType);
      if (activeOverlay && activeOverlay !== 'NONE') {
        mat.transparent = true;
        mat.opacity = 0.35;
      } else {
        mat.transparent = false;
        mat.opacity = 1.0;
      }
      mats.set(arch, mat);
    });
    return mats;
  }, [activeOverlay, graphicsQuality]);

  useEffect(() => {
    const isFirstRun = prevBuildingRevisionRef.current === -1;
    const revisionChanged = buildingRevision !== prevBuildingRevisionRef.current;

    if (!isFirstRun && !revisionChanged) return;

    prevBuildingRevisionRef.current = buildingRevision;

    const cache = chunkCacheRef.current;
    let rebuildCount = 0;
    const isAllDirty = isFirstRun || !dirtyBuildingChunks || dirtyBuildingChunks.has('all');

    const processedTiles = new Set<string>();

    // Pass 1: find all multi-tile buildings across the whole grid to ensure we know their footprints
    // (We do this globally because a building in chunk A might extend into chunk B)
    // Actually, we can just process dirty chunks, but for safety of footprints, we process the whole grid if needed.
    // To be efficient, we ONLY process the dirty chunks.
    
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
        // Extend box slightly for tall buildings
        const box = new THREE.Box3(
          new THREE.Vector3(chunkMidXW - halfW - 1, -2, chunkMidZW - halfD - 1),
          new THREE.Vector3(chunkMidXW + halfW + 1, 15, chunkMidZW + halfD + 1)
        );

        const existing = cache.get(id);
        const shouldRebuild = isAllDirty || dirtyBuildingChunks.has(id) || !existing;

        if (shouldRebuild) {
          const batches = new Map<BuildingArchitecture, BuildingInstance[]>();

          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              if (processedTiles.has(`${x},${y}`)) continue;

              const tile = grid[y]?.[x];
              if (!tile || tile.type === TileType.EMPTY || tile.type === TileType.ROAD || tile.water) continue;

              const entity = tile.buildingId ? buildings?.[tile.buildingId] : undefined;

              const lvl = tile.level || 1;
              let arch: BuildingArchitecture = 'RES_TENT';
              let fpW = entity?.footprintW || 1;
              let fpL = entity?.footprintL || 1;

              if (tile.type === TileType.RESIDENTIAL) {
                if (lvl === 1) arch = 'RES_TENT';
                else if (lvl === 2) arch = 'RES_CABIN';
                else if (lvl === 3) arch = 'RES_HOUSE';
                else if (lvl === 4) arch = 'RES_APARTMENT';
                else { arch = 'RES_HIGHRISE'; if(!entity){ fpW = 2; fpL = 2; } }
              } else if (tile.type === TileType.COMMERCIAL) {
                if (lvl === 1) arch = 'COM_STALL';
                else if (lvl === 2) arch = 'COM_SHOP';
                else if (lvl === 3) arch = 'COM_MALL';
                else if (lvl === 4) { arch = 'COM_TOWER'; if(!entity){ fpW = 1; fpL = 2; } }
                else { arch = (x + y) % 2 === 0 ? 'COM_TOWER' : 'COM_PREMIUM_SKYSCRAPER'; if(!entity){ fpW = 2; fpL = 2; } }
              } else if (tile.type === TileType.INDUSTRIAL) {
                if (lvl === 1) arch = 'IND_WORKSHOP';
                else if (lvl === 2) { arch = 'IND_WAREHOUSE'; if(!entity){ fpW = 1; fpL = 2; } }
                else if (lvl === 3) { arch = 'IND_FACTORY'; if(!entity){ fpW = 2; fpL = 2; } }
                else if (lvl === 4) { arch = 'IND_LOGISTICS'; if(!entity){ fpW = 2; fpL = 2; } }
                else { arch = 'IND_HIGHTECH'; if(!entity){ fpW = 2; fpL = 2; } }
              } else {
                if (tile.type === TileType.POWER_PLANT) { arch = 'SRV_POWER'; if(!entity){ fpW = 2; fpL = 2; } }
                else if (tile.type === TileType.WATER_PUMP) { arch = 'SRV_WATER'; }
                else if (tile.type === TileType.FIRE_STATION) { arch = 'SRV_FIRE'; if(!entity){ fpW = 1; fpL = 2; } }
                else if (tile.type === TileType.POLICE_STATION) { arch = 'SRV_POLICE'; if(!entity){ fpW = 1; fpL = 2; } }
                else if (tile.type === TileType.CLINIC) { arch = 'SRV_CLINIC'; if(!entity){ fpW = 2; fpL = 2; } }
                else if (tile.type === TileType.SCHOOL) { arch = 'SRV_SCHOOL'; if(!entity){ fpW = 2; fpL = 2; } }
                else if (tile.type === TileType.WASTE_MANAGEMENT) { arch = 'SRV_WASTE'; if(!entity){ fpW = 2; fpL = 2; } }
                else if (tile.type === TileType.PARK) { arch = 'SRV_PARK'; }
              }

              if (x + fpW > width || y + fpL > height) {
                fpW = 1; fpL = 1;
              }

              for (let dy = 0; dy < fpL; dy++) {
                for (let dx = 0; dx < fpW; dx++) {
                  processedTiles.add(`${x + dx},${y + dy}`);
                }
              }

              const [wx1, , wz1] = gridToWorld(x, y, width, height);
              const [wx2, , wz2] = gridToWorld(x + fpW - 1, y + fpL - 1, width, height);
              const centerX = (wx1 + wx2) / 2;
              const centerZ = (wz1 + wz2) / 2;

              const sampleGx = x + (fpW - 1) / 2;
              const sampleGy = y + (fpL - 1) / 2;
              const sample = TerrainMeshGenerator.sampleTerrain(grid, sampleGx, sampleGy, width, height);
              
              if (!batches.has(arch)) batches.set(arch, []);
              batches.get(arch)!.push({
                tile,
                entity,
                worldX: centerX,
                worldZ: centerZ,
                elevation: sample.height,
                footprintW: fpW,
                footprintL: fpL,
                variant: (x * 13 + y * 29) % 3,
              });
            }
          }

          cache.set(id, { id, box, batches });
          rebuildCount++;
        }
      }
    }

    if (rebuildCount > 0) {
      if (onBuildingBatchUpdate) onBuildingBatchUpdate(rebuildCount);
      setChunkList(Array.from(cache.values()));
    }
  }, [grid, buildingRevision, dirtyBuildingChunks, width, height, chunksX, chunksY, activeOverlay, graphicsQuality, onBuildingBatchUpdate]);

  useFrame(({ camera }) => {
    projScreenMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

    groupRefs.current.forEach((group, id) => {
      const entry = chunkCacheRef.current.get(id);
      if (entry) {
        group.visible = frustumRef.current.intersectsBox(entry.box);
      }
    });
  });

  return (
    <group name="ChunkBuildings">
      {chunkList.map((chunk) => (
        <group
          key={chunk.id}
          ref={(el) => {
            if (el) groupRefs.current.set(chunk.id, el);
            else groupRefs.current.delete(chunk.id);
          }}
        >
          {Array.from(chunk.batches.entries()).map(([arch, instances]) => {
            if (instances.length === 0) return null;
            const geo = buildingGeometries.get(arch);
            const mat = materials.get(arch);
            if (!geo || !mat) return null;
            return (
              <InstancedBuildingBatch
                key={arch}
                architecture={arch}
                instances={instances}
                geometry={geo}
                material={mat}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

const InstancedBuildingBatch = React.memo(({
  architecture,
  instances,
  geometry,
  material
}: {
  architecture: BuildingArchitecture;
  instances: BuildingInstance[];
  geometry: THREE.BufferGeometry;
  material?: THREE.ShaderMaterial;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    
    const dummy = new THREE.Object3D();
    const statusArray = new Float32Array(instances.length * 2);

    instances.forEach((inst, i) => {
      // Base resting at ground level (elevation)
      dummy.position.set(inst.worldX, inst.elevation, inst.worldZ);
      
      const widthScale = (inst.footprintW * TILE_SIZE) / TILE_SIZE;
      const depthScale = (inst.footprintL * TILE_SIZE) / TILE_SIZE;
      const heightScale = 1.0 + inst.variant * 0.06;

      dummy.scale.set(widthScale, heightScale, depthScale);
      
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      statusArray[i * 2 + 0] = inst.tile.powered ? 1.0 : 0.0;
      statusArray[i * 2 + 1] = inst.tile.abandoned ? 1.0 : 0.0;
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute('aStatus', new THREE.InstancedBufferAttribute(statusArray, 2));
  }, [instances, architecture]);

  if (!material) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, instances.length]} castShadow receiveShadow />
  );
});
