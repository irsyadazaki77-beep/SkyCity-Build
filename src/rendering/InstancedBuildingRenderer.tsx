import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../types';
import { gridToWorld, TILE_SIZE } from '../components/world/types3D';
import { BuildingShaderMaterial } from './CustomMaterials';
import { TerrainMeshGenerator } from '../core/world/TerrainMesh';

interface InstancedBuildingRendererProps {
  grid: TileData[][];
  buildingRevision: number;
  nightFactor: number;
  onBuildingBatchUpdate?: (count: number) => void;
}

// Full Archetype Categories
export type DetailedArchetype =
  | 'RES_SUBURBAN'
  | 'RES_COMPACT'
  | 'RES_TOWNHOUSE'
  | 'RES_LOW_APARTMENT'
  | 'RES_MID_APARTMENT'
  | 'RES_TOWER'
  | 'RES_LUXURY_TOWER'
  | 'COM_CORNER_SHOP'
  | 'COM_SMALL_RETAIL'
  | 'COM_SUPERMARKET'
  | 'COM_OFFICE_LOW'
  | 'COM_OFFICE_MID'
  | 'COM_TOWER'
  | 'COM_PREMIUM_SKYSCRAPER'
  | 'IND_WORKSHOP'
  | 'IND_WAREHOUSE'
  | 'IND_FACTORY'
  | 'IND_LOGISTICS'
  | 'IND_HEAVY'
  | 'IND_HIGHTECH'
  | 'SRV_POWER'
  | 'SRV_WATER'
  | 'SRV_FIRE'
  | 'SRV_POLICE'
  | 'SRV_CLINIC'
  | 'SRV_SCHOOL'
  | 'SRV_WASTE'
  | 'SRV_PARK';

interface BuildingInstanceData {
  tile: TileData;
  worldX: number;
  worldZ: number;
  elevation: number;
  footprintW: number;
  footprintL: number;
  variant: number;
}

const dummyMatrix = new THREE.Matrix4();

/**
 * Merge geometries safely without external utils
 */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geos.length === 0) return new THREE.BufferGeometry();
  if (geos.length === 1) return geos[0];

  let totalVerts = 0;
  let totalIndices = 0;

  for (const g of geos) {
    const pos = g.getAttribute('position');
    if (pos) totalVerts += pos.count;
    const idx = g.getIndex();
    if (idx) totalIndices += idx.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = totalIndices > 0 ? new Uint32Array(totalIndices) : null;

  let vOffset = 0;
  let iOffset = 0;
  let vertBase = 0;

  for (const g of geos) {
    const pos = g.getAttribute('position');
    const norm = g.getAttribute('normal');
    if (!pos) continue;

    for (let i = 0; i < pos.count; i++) {
      positions[(vOffset + i) * 3 + 0] = pos.getX(i);
      positions[(vOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vOffset + i) * 3 + 2] = pos.getZ(i);

      if (norm) {
        normals[(vOffset + i) * 3 + 0] = norm.getX(i);
        normals[(vOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }

    const idx = g.getIndex();
    if (idx && indices) {
      for (let i = 0; i < idx.count; i++) {
        indices[iOffset + i] = vertBase + idx.getX(i);
      }
      iOffset += idx.count;
    }

    vertBase += pos.count;
    vOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

/**
 * Helper to build procedural building geometry with rooftop details, setbacks & awnings
 */
function createProceduralBuildingGeo(
  arch: DetailedArchetype,
  variant: number
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  let w = 0.75 * TILE_SIZE;
  let l = 0.75 * TILE_SIZE;
  let h = 0.5;

  if (arch.startsWith('RES_')) {
    if (arch === 'RES_SUBURBAN') { h = 0.45; w = 0.65; l = 0.65; }
    else if (arch === 'RES_COMPACT') { h = 0.7; w = 0.7; l = 0.7; }
    else if (arch === 'RES_TOWNHOUSE') { h = 1.1; w = 0.75; l = 0.75; }
    else if (arch === 'RES_LOW_APARTMENT') { h = 1.4; w = 0.8; l = 1.6; }
    else if (arch === 'RES_MID_APARTMENT') { h = 2.2; w = 1.5; l = 1.5; }
    else if (arch === 'RES_TOWER') { h = 3.6; w = 1.6; l = 1.6; }
    else if (arch === 'RES_LUXURY_TOWER') { h = 5.2; w = 1.7; l = 1.7; }
  } else if (arch.startsWith('COM_')) {
    if (arch === 'COM_CORNER_SHOP') { h = 0.5; w = 0.75; l = 0.75; }
    else if (arch === 'COM_SMALL_RETAIL') { h = 0.8; w = 0.8; l = 0.8; }
    else if (arch === 'COM_SUPERMARKET') { h = 0.6; w = 1.6; l = 1.6; }
    else if (arch === 'COM_OFFICE_LOW') { h = 1.5; w = 0.8; l = 1.6; }
    else if (arch === 'COM_OFFICE_MID') { h = 2.8; w = 1.6; l = 1.6; }
    else if (arch === 'COM_TOWER') { h = 4.8; w = 1.7; l = 1.7; }
    else if (arch === 'COM_PREMIUM_SKYSCRAPER') { h = 6.8; w = 1.7; l = 1.7; }
  } else if (arch.startsWith('IND_')) {
    if (arch === 'IND_WORKSHOP') { h = 0.55; w = 0.8; l = 0.8; }
    else if (arch === 'IND_WAREHOUSE') { h = 0.7; w = 0.85; l = 1.7; }
    else if (arch === 'IND_FACTORY') { h = 1.2; w = 1.65; l = 1.65; }
    else if (arch === 'IND_LOGISTICS') { h = 1.0; w = 1.7; l = 1.7; }
    else if (arch === 'IND_HEAVY') { h = 1.8; w = 1.7; l = 2.5; }
    else if (arch === 'IND_HIGHTECH') { h = 2.4; w = 1.65; l = 1.65; }
  } else {
    // Services
    if (arch === 'SRV_POWER') { h = 1.4; w = 1.6; l = 1.6; }
    else if (arch === 'SRV_WATER') { h = 0.8; w = 0.8; l = 0.8; }
    else if (arch === 'SRV_FIRE' || arch === 'SRV_POLICE') { h = 1.0; w = 0.8; l = 1.6; }
    else if (arch === 'SRV_CLINIC' || arch === 'SRV_SCHOOL' || arch === 'SRV_WASTE') { h = 1.2; w = 1.6; l = 1.6; }
    else { h = 0.25; w = 0.8; l = 0.8; } // Park
  }

  // Base building box
  const mainBox = new THREE.BoxGeometry(w, h, l);
  mainBox.translate(0, h / 2, 0);
  parts.push(mainBox);

  // Concrete foundation plinth (extends downwards to anchor building on slope)
  if (arch !== 'SRV_PARK') {
    const plinthH = 0.6;
    const plinthBox = new THREE.BoxGeometry(w * 1.01, plinthH, l * 1.01);
    plinthBox.translate(0, -plinthH / 2, 0);
    parts.push(plinthBox);
  }

  // Setbacks for towers
  if (h > 3.0) {
    const setbackH = h * 0.35;
    const setback = new THREE.BoxGeometry(w * 0.78, setbackH, l * 0.78);
    setback.translate(0, h + setbackH / 2, 0);
    parts.push(setback);

    if (h > 5.0) {
      const topSpireH = h * 0.25;
      const topSpire = new THREE.BoxGeometry(w * 0.5, topSpireH, l * 0.5);
      topSpire.translate(0, h + setbackH + topSpireH / 2, 0);
      parts.push(topSpire);
    }
  }

  // Procedural Rooftop Details (HVAC, Water tanks, Antennas, Chimneys)
  if (arch !== 'SRV_PARK') {
    // Rooftop Parapet
    const parapet = new THREE.BoxGeometry(w * 0.96, 0.06, l * 0.96);
    parapet.translate(0, h + 0.03, 0);
    parts.push(parapet);

    // HVAC / AC Units
    const acBox = new THREE.BoxGeometry(w * 0.25, 0.12, l * 0.25);
    acBox.translate((variant === 1 ? -1 : 1) * w * 0.22, h + 0.1, (variant === 2 ? -1 : 1) * l * 0.22);
    parts.push(acBox);

    // Water Tanks or Antennas for taller structures
    if (h >= 1.5) {
      if (variant === 0) {
        const waterTank = new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8);
        waterTank.translate(-w * 0.25, h + 0.18, l * 0.25);
        parts.push(waterTank);
      } else if (variant === 1 || h >= 4.0) {
        const antenna = new THREE.CylinderGeometry(0.02, 0.03, 0.8, 6);
        antenna.translate(0, h + 0.4, 0);
        parts.push(antenna);
      }
    }

    // Industrial Chimney / Loading bay shutter
    if (arch.startsWith('IND_')) {
      const chimney = new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8);
      chimney.translate(w * 0.3, h + 0.3, -l * 0.3);
      parts.push(chimney);

      // Loading bay canopy
      const bay = new THREE.BoxGeometry(w * 0.4, 0.08, 0.3);
      bay.translate(0, 0.2, l / 2 + 0.15);
      parts.push(bay);
    }

    // Commercial Shop Awning
    if (arch === 'COM_CORNER_SHOP' || arch === 'COM_SMALL_RETAIL') {
      const awning = new THREE.BoxGeometry(w * 0.85, 0.05, 0.25);
      awning.translate(0, 0.22, l / 2 + 0.12);
      parts.push(awning);
    }
  }

  return mergeGeometries(parts);
}

export function InstancedBuildingRenderer({
  grid,
  buildingRevision,
  nightFactor: _nightFactor,
  onBuildingBatchUpdate,
}: InstancedBuildingRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const prevRevisionRef = useRef<number>(-1);
  const buildingBatchesRef = useRef<Map<DetailedArchetype, BuildingInstanceData[]>>(new Map());

  // Group tiles and handle multi-tile footprints (1x1, 1x2, 2x2, 2x3)
  const buildingBatches = useMemo(() => {
    if (prevRevisionRef.current === buildingRevision && buildingBatchesRef.current.size > 0) {
      return Array.from(buildingBatchesRef.current.entries());
    }

    prevRevisionRef.current = buildingRevision;
    const batches = new Map<DetailedArchetype, BuildingInstanceData[]>();
    const processedTiles = new Set<string>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (processedTiles.has(key)) continue;

        const tile = grid[y][x];
        if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) continue;

        const lvl = tile.level || 1;

        // Determine Archetype & Footprint
        let arch: DetailedArchetype = 'RES_SUBURBAN';
        let fpW = 1;
        let fpL = 1;

        if (tile.type === TileType.RESIDENTIAL) {
          if (lvl === 1) arch = 'RES_SUBURBAN';
          else if (lvl === 2) arch = 'RES_COMPACT';
          else if (lvl === 3) {
            arch = 'RES_LOW_APARTMENT';
            fpW = 1; fpL = 2;
          } else if (lvl === 4) {
            arch = 'RES_MID_APARTMENT';
            fpW = 2; fpL = 2;
          } else {
            arch = (x + y) % 2 === 0 ? 'RES_TOWER' : 'RES_LUXURY_TOWER';
            fpW = 2; fpL = 2;
          }
        } else if (tile.type === TileType.COMMERCIAL) {
          if (lvl === 1) arch = 'COM_CORNER_SHOP';
          else if (lvl === 2) arch = 'COM_SMALL_RETAIL';
          else if (lvl === 3) {
            arch = 'COM_SUPERMARKET';
            fpW = 2; fpL = 2;
          } else if (lvl === 4) {
            arch = 'COM_OFFICE_MID';
            fpW = 2; fpL = 2;
          } else {
            arch = (x + y) % 2 === 0 ? 'COM_TOWER' : 'COM_PREMIUM_SKYSCRAPER';
            fpW = 2; fpL = 2;
          }
        } else if (tile.type === TileType.INDUSTRIAL) {
          if (lvl === 1) arch = 'IND_WORKSHOP';
          else if (lvl === 2) {
            arch = 'IND_WAREHOUSE';
            fpW = 1; fpL = 2;
          } else if (lvl === 3) {
            arch = 'IND_FACTORY';
            fpW = 2; fpL = 2;
          } else if (lvl === 4) {
            arch = 'IND_LOGISTICS';
            fpW = 2; fpL = 2;
          } else {
            arch = 'IND_HIGHTECH';
            fpW = 2; fpL = 2;
          }
        } else {
          // Services
          if (tile.type === TileType.POWER_PLANT) { arch = 'SRV_POWER'; fpW = 2; fpL = 2; }
          else if (tile.type === TileType.WATER_PUMP) { arch = 'SRV_WATER'; }
          else if (tile.type === TileType.FIRE_STATION) { arch = 'SRV_FIRE'; fpW = 1; fpL = 2; }
          else if (tile.type === TileType.POLICE_STATION) { arch = 'SRV_POLICE'; fpW = 1; fpL = 2; }
          else if (tile.type === TileType.CLINIC) { arch = 'SRV_CLINIC'; fpW = 2; fpL = 2; }
          else if (tile.type === TileType.SCHOOL) { arch = 'SRV_SCHOOL'; fpW = 2; fpL = 2; }
          else if (tile.type === TileType.WASTE_MANAGEMENT) { arch = 'SRV_WASTE'; fpW = 2; fpL = 2; }
          else if (tile.type === TileType.PARK) { arch = 'SRV_PARK'; }
        }

        // Verify if multi-tile space fits within grid
        if (x + fpW > width || y + fpL > height) {
          fpW = 1; fpL = 1;
        }

        // Mark footprint tiles as processed
        for (let dy = 0; dy < fpL; dy++) {
          for (let dx = 0; dx < fpW; dx++) {
            processedTiles.add(`${x + dx},${y + dy}`);
          }
        }

        // Compute world center position for building instance
        const [wx1, , wz1] = gridToWorld(x, y, width, height);
        const [wx2, , wz2] = gridToWorld(x + fpW - 1, y + fpL - 1, width, height);

        const centerX = (wx1 + wx2) / 2;
        const centerZ = (wz1 + wz2) / 2;

        const sampleGx = x + (fpW - 1) / 2;
        const sampleGy = y + (fpL - 1) / 2;
        const sample = TerrainMeshGenerator.sampleTerrain(grid, sampleGx, sampleGy, width, height);
        const elevation = sample.height;

        const variant = (x * 13 + y * 29) % 3;

        if (!batches.has(arch)) batches.set(arch, []);
        batches.get(arch)!.push({
          tile,
          worldX: centerX,
          worldZ: centerZ,
          elevation,
          footprintW: fpW,
          footprintL: fpL,
          variant,
        });
      }
    }

    buildingBatchesRef.current = batches;
    if (onBuildingBatchUpdate) onBuildingBatchUpdate(batches.size);
    return Array.from(batches.entries());
  }, [buildingRevision, grid, width, height, onBuildingBatchUpdate]);

  // Geometries and Materials per archetype
  const geometries = useMemo(() => {
    const geos: Record<string, THREE.BufferGeometry> = {};
    const archetypesList: DetailedArchetype[] = [
      'RES_SUBURBAN', 'RES_COMPACT', 'RES_TOWNHOUSE', 'RES_LOW_APARTMENT', 'RES_MID_APARTMENT', 'RES_TOWER', 'RES_LUXURY_TOWER',
      'COM_CORNER_SHOP', 'COM_SMALL_RETAIL', 'COM_SUPERMARKET', 'COM_OFFICE_LOW', 'COM_OFFICE_MID', 'COM_TOWER', 'COM_PREMIUM_SKYSCRAPER',
      'IND_WORKSHOP', 'IND_WAREHOUSE', 'IND_FACTORY', 'IND_LOGISTICS', 'IND_HEAVY', 'IND_HIGHTECH',
      'SRV_POWER', 'SRV_WATER', 'SRV_FIRE', 'SRV_POLICE', 'SRV_CLINIC', 'SRV_SCHOOL', 'SRV_WASTE', 'SRV_PARK'
    ];

    for (const a of archetypesList) {
      geos[a] = createProceduralBuildingGeo(a, 0);
    }
    return geos;
  }, []);

  // Sophisticated City Color Palette per zone
  const materials = useMemo(() => {
    return {
      RES_SUBURBAN: BuildingShaderMaterial('#e2d9cc', '#c87d55', 0),
      RES_COMPACT: BuildingShaderMaterial('#d1c7b7', '#a87352', 0),
      RES_TOWNHOUSE: BuildingShaderMaterial('#b98263', '#4a5568', 0),
      RES_LOW_APARTMENT: BuildingShaderMaterial('#cbd5e1', '#64748b', 0),
      RES_MID_APARTMENT: BuildingShaderMaterial('#94a3b8', '#475569', 0),
      RES_TOWER: BuildingShaderMaterial('#64748b', '#334155', 0),
      RES_LUXURY_TOWER: BuildingShaderMaterial('#38bdf8', '#0284c7', 1),

      COM_CORNER_SHOP: BuildingShaderMaterial('#bae6fd', '#0284c7', 1),
      COM_SMALL_RETAIL: BuildingShaderMaterial('#93c5fd', '#1d4ed8', 1),
      COM_SUPERMARKET: BuildingShaderMaterial('#60a5fa', '#1e40af', 1),
      COM_OFFICE_LOW: BuildingShaderMaterial('#38bdf8', '#0369a1', 1),
      COM_OFFICE_MID: BuildingShaderMaterial('#2563eb', '#1e3a8a', 1),
      COM_TOWER: BuildingShaderMaterial('#1d4ed8', '#0f172a', 1),
      COM_PREMIUM_SKYSCRAPER: BuildingShaderMaterial('#0284c7', '#090d16', 1),

      IND_WORKSHOP: BuildingShaderMaterial('#a8a29e', '#57534e', 2),
      IND_WAREHOUSE: BuildingShaderMaterial('#78716c', '#44403c', 2),
      IND_FACTORY: BuildingShaderMaterial('#71717a', '#3f3f46', 2),
      IND_LOGISTICS: BuildingShaderMaterial('#a1a1aa', '#52525b', 2),
      IND_HEAVY: BuildingShaderMaterial('#52525b', '#27272a', 2),
      IND_HIGHTECH: BuildingShaderMaterial('#0284c7', '#334155', 1),

      SRV_POWER: BuildingShaderMaterial('#d97706', '#451a03', 2),
      SRV_WATER: BuildingShaderMaterial('#0284c7', '#0c4a6e', 1),
      SRV_FIRE: BuildingShaderMaterial('#b91c1c', '#450a0a', 2),
      SRV_POLICE: BuildingShaderMaterial('#1e3a8a', '#172554', 1),
      SRV_CLINIC: BuildingShaderMaterial('#0284c7', '#f8fafc', 1),
      SRV_SCHOOL: BuildingShaderMaterial('#047857', '#064e3b', 0),
      SRV_WASTE: BuildingShaderMaterial('#65a30d', '#1a2e05', 2),
      SRV_PARK: BuildingShaderMaterial('#15803d', '#14532d', 0),
    };
  }, []);

  return (
    <group name="Buildings">
      {buildingBatches.map(([arch, instances]) => (
        <BuildingBatch
          key={arch}
          archetype={arch}
          instances={instances}
          geometry={geometries[arch]}
          material={materials[arch as keyof typeof materials]}
        />
      ))}
    </group>
  );
}

interface BuildingBatchProps {
  archetype: DetailedArchetype;
  instances: BuildingInstanceData[];
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
}

function BuildingBatch({ instances, geometry, material }: BuildingBatchProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  if (!instances || instances.length === 0) return null;

  useEffect(() => {
    if (!meshRef.current || instances.length === 0) return;
    const mesh = meshRef.current;

    const statusArray = new Float32Array(instances.length * 2);

    instances.forEach((inst, i) => {
      const { tile, worldX, worldZ, elevation } = inst;

      dummyMatrix.identity();
      dummyMatrix.setPosition(worldX, elevation + 0.01, worldZ);
      mesh.setMatrixAt(i, dummyMatrix);

      // Pass power & abandoned status to shader
      statusArray[i * 2 + 0] = tile.powered ? 1.0 : 0.0;
      statusArray[i * 2 + 1] = tile.abandoned ? 1.0 : 0.0;
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute('aStatus', new THREE.InstancedBufferAttribute(statusArray, 2));
  }, [instances]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instances.length]}
      castShadow
      receiveShadow
    />
  );
}

