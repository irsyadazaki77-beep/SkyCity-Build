import * as THREE from 'three';
import { TileData } from '../../types';
import { TILE_SIZE } from '../../components/world/types3D';

export const WATER_LEVEL = 0.0;

// Palette for procedural slope & elevation blending
const COLOR_DEEP_BED = new THREE.Color('#0c4a6e');
const COLOR_SHALLOW_BED = new THREE.Color('#0284c7');
const COLOR_WET_SAND = new THREE.Color('#bfa068');
const COLOR_DRY_SAND = new THREE.Color('#e0c48e');
const COLOR_GRASS_LUSH = new THREE.Color('#437a28');
const COLOR_GRASS_MID = new THREE.Color('#2e6c23');
const COLOR_FOREST_FLOOR = new THREE.Color('#195427');
const COLOR_DIRT = new THREE.Color('#785329');
const COLOR_CLIFF_ROCK = new THREE.Color('#4b5563');
const COLOR_HIGH_ROCK = new THREE.Color('#374151');
const COLOR_SNOW = new THREE.Color('#f1f5f9');

export interface TerrainSample {
  height: number;
  waterWeight: number;
  isForest: number;
  isOre: number;
}

export class TerrainMeshGenerator {
  /**
   * Continuous dual-grid sampling function.
   * Samples smooth elevation and water factor at any continuous grid coordinate (gx, gy).
   */
  public static sampleTerrain(
    grid: TileData[][],
    gx: number,
    gy: number,
    gridWidth: number,
    gridHeight: number
  ): TerrainSample {
    const minGx = Math.max(0, Math.min(gridWidth - 1, Math.floor(gx)));
    const maxGx = Math.max(0, Math.min(gridWidth - 1, Math.ceil(gx)));
    const minGy = Math.max(0, Math.min(gridHeight - 1, Math.floor(gy)));
    const maxGy = Math.max(0, Math.min(gridHeight - 1, Math.ceil(gy)));

    const fx = gx - Math.floor(gx);
    const fy = gy - Math.floor(gy);

    // 4-corner tile sampling
    const t00 = grid[minGy]?.[minGx];
    const t10 = grid[minGy]?.[maxGx];
    const t01 = grid[maxGy]?.[minGx];
    const t11 = grid[maxGy]?.[maxGx];

    const getH = (t?: TileData) => (t?.elevation || 0) * 0.45;
    const getW = (t?: TileData) => (t?.water ? 1.0 : 0.0);
    const getF = (t?: TileData) => (t?.resource === 'forest' ? 1.0 : 0.0);
    const getO = (t?: TileData) => (t?.resource === 'ore' ? 1.0 : 0.0);

    // Bilinear height
    const h0 = (1 - fx) * getH(t00) + fx * getH(t10);
    const h1 = (1 - fx) * getH(t01) + fx * getH(t11);
    const rawHeight = (1 - fy) * h0 + fy * h1;

    // Bilinear water factor
    const w0 = (1 - fx) * getW(t00) + fx * getW(t10);
    const w1 = (1 - fx) * getW(t01) + fx * getW(t11);
    const waterWeight = (1 - fy) * w0 + fy * w1;

    // Bilinear forest factor
    const f0 = (1 - fx) * getF(t00) + fx * getF(t10);
    const f1 = (1 - fx) * getF(t01) + fx * getF(t11);
    const isForest = (1 - fy) * f0 + fy * f1;

    // Bilinear ore factor
    const o0 = (1 - fx) * getO(t00) + fx * getO(t10);
    const o1 = (1 - fx) * getO(t01) + fx * getO(t11);
    const isOre = (1 - fy) * o0 + fy * o1;

    // Smooth shoreline transition & clear water separation:
    // Dry land sits at (rawHeight + 0.04) strictly ABOVE WATER_LEVEL (0.0).
    // Riverbed dips down smoothly to riverbedDepth (-0.38) strictly BELOW WATER_LEVEL (0.0).
    const landHeight = rawHeight + 0.04;
    let finalHeight = landHeight;

    if (waterWeight > 0.0) {
      const riverbedDepth = -0.38;
      // Smooth Hermite curve for organic riverbank slope
      const smoothW = waterWeight * waterWeight * (3 - 2 * waterWeight);
      finalHeight = (1 - smoothW) * landHeight + smoothW * riverbedDepth;
    }

    return {
      height: finalHeight,
      waterWeight,
      isForest,
      isOre,
    };
  }

  /**
   * Computes analytic normal at continuous grid coordinate (gx, gy).
   * Guaranteed 100% continuous across chunk borders with zero lighting seams.
   */
  public static sampleNormal(
    grid: TileData[][],
    gx: number,
    gy: number,
    gridWidth: number,
    gridHeight: number
  ): THREE.Vector3 {
    const eps = 0.25;
    const hL = this.sampleTerrain(grid, gx - eps, gy, gridWidth, gridHeight).height;
    const hR = this.sampleTerrain(grid, gx + eps, gy, gridWidth, gridHeight).height;
    const hU = this.sampleTerrain(grid, gx, gy - eps, gridWidth, gridHeight).height;
    const hD = this.sampleTerrain(grid, gx, gy + eps, gridWidth, gridHeight).height;

    const dx = (hR - hL) / (2 * eps * TILE_SIZE);
    const dz = (hD - hU) / (2 * eps * TILE_SIZE);

    const normal = new THREE.Vector3(-dx, 1.0, -dz);
    return normal.normalize();
  }

  public static generateChunkGeometry(
    grid: TileData[][],
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    gridWidth: number,
    gridHeight: number,
    lod: number = 0 // 0 = High (2x subdivisions), 1 = Standard (1x), 2 = Low
  ): THREE.BufferGeometry {
    // Determine resolution based on LOD
    const subdivPerTile = lod === 0 ? 2 : 1;
    const tilesX = maxX - minX + 1;
    const tilesY = maxY - minY + 1;

    const segmentsX = tilesX * subdivPerTile;
    const segmentsY = tilesY * subdivPerTile;

    const verticesX = segmentsX + 1;
    const verticesY = segmentsY + 1;
    const numVertices = verticesX * verticesY;
    const numQuads = segmentsX * segmentsY;

    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    const colors = new Float32Array(numVertices * 3);
    const uvs = new Float32Array(numVertices * 2);
    const terrainData = new Float32Array(numVertices * 4); // [elevation, slope, waterWeight, resource]
    const indices = new Uint32Array(numQuads * 6);

    const tempColor = new THREE.Color();
    let vIdx = 0;
    let uvIdx = 0;

    for (let j = 0; j <= segmentsY; j++) {
      const gy = minY + j / subdivPerTile;
      for (let i = 0; i <= segmentsX; i++) {
        const gx = minX + i / subdivPerTile;

        const sample = this.sampleTerrain(grid, gx, gy, gridWidth, gridHeight);
        const norm = this.sampleNormal(grid, gx, gy, gridWidth, gridHeight);

        const wx = (gx - gridWidth / 2) * TILE_SIZE;
        const wz = (gy - gridHeight / 2) * TILE_SIZE;

        positions[vIdx * 3 + 0] = wx;
        positions[vIdx * 3 + 1] = sample.height;
        positions[vIdx * 3 + 2] = wz;

        normals[vIdx * 3 + 0] = norm.x;
        normals[vIdx * 3 + 1] = norm.y;
        normals[vIdx * 3 + 2] = norm.z;

        uvs[uvIdx * 2 + 0] = i / segmentsX;
        uvs[uvIdx * 2 + 1] = j / segmentsY;

        const slope = Math.sqrt(norm.x * norm.x + norm.z * norm.z) / Math.max(0.1, norm.y);

        // Store data for shader
        terrainData[vIdx * 4 + 0] = sample.height;
        terrainData[vIdx * 4 + 1] = slope;
        terrainData[vIdx * 4 + 2] = sample.waterWeight;
        terrainData[vIdx * 4 + 3] = sample.isForest > 0.5 ? 1.0 : (sample.isOre > 0.5 ? 2.0 : 0.0);

        // Fallback vertex colors (original logic preserved)
        if (sample.waterWeight > 0.75) {
          tempColor.copy(COLOR_DEEP_BED);
        } else if (sample.waterWeight > 0.4) {
          const t = (sample.waterWeight - 0.4) / 0.35;
          tempColor.copy(COLOR_WET_SAND).lerp(COLOR_SHALLOW_BED, t);
        } else if (sample.height < 0.18) {
          tempColor.copy(COLOR_DRY_SAND);
        } else if (slope > 0.62) {
          tempColor.copy(COLOR_CLIFF_ROCK);
          if (sample.height > 2.5) tempColor.lerp(COLOR_HIGH_ROCK, 0.5);
        } else if (slope > 0.38) {
          tempColor.copy(COLOR_DIRT).lerp(COLOR_CLIFF_ROCK, (slope - 0.38) / 0.24);
        } else if (sample.height > 3.4) {
          tempColor.copy(COLOR_HIGH_ROCK).lerp(COLOR_SNOW, Math.min(1, (sample.height - 3.4) / 0.8));
        } else if (sample.height > 2.0) {
          tempColor.copy(COLOR_GRASS_MID).lerp(COLOR_DIRT, Math.min(1, (sample.height - 2.0) / 1.4));
        } else if (sample.isForest > 0.35) {
          tempColor.copy(COLOR_FOREST_FLOOR);
        } else {
          const grassBlend = Math.min(1, sample.height / 1.5);
          tempColor.copy(COLOR_GRASS_LUSH).lerp(COLOR_GRASS_MID, grassBlend);
        }

        colors[vIdx * 3 + 0] = tempColor.r;
        colors[vIdx * 3 + 1] = tempColor.g;
        colors[vIdx * 3 + 2] = tempColor.b;

        vIdx++;
        uvIdx++;
      }
    }

    let iIdx = 0;
    for (let j = 0; j < segmentsY; j++) {
      for (let i = 0; i < segmentsX; i++) {
        const row1 = j * verticesX + i;
        const row2 = (j + 1) * verticesX + i;

        indices[iIdx++] = row1;
        indices[iIdx++] = row2;
        indices[iIdx++] = row1 + 1;

        indices[iIdx++] = row1 + 1;
        indices[iIdx++] = row2;
        indices[iIdx++] = row2 + 1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('aTerrainData', new THREE.BufferAttribute(terrainData, 4));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    return geometry;
  }

  /**
   * Generates water surface geometry ONLY for chunk regions that contain water (waterWeight > 0.01).
   * Returns null if the chunk is completely dry land.
   */
  public static generateChunkWaterGeometry(
    grid: TileData[][],
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    gridWidth: number,
    gridHeight: number,
    lod: number = 0
  ): THREE.BufferGeometry | null {
    const subdivPerTile = lod === 0 ? 2 : 1;
    const tilesX = maxX - minX + 1;
    const tilesY = maxY - minY + 1;

    const segmentsX = tilesX * subdivPerTile;
    const segmentsY = tilesY * subdivPerTile;

    const verticesX = segmentsX + 1;
    const verticesY = segmentsY + 1;
    const numVertices = verticesX * verticesY;

    // First pass: sample all vertices in the chunk
    const samples: TerrainSample[] = new Array(numVertices);
    let maxWaterWeight = 0;

    for (let j = 0; j <= segmentsY; j++) {
      const gy = minY + j / subdivPerTile;
      for (let i = 0; i <= segmentsX; i++) {
        const gx = minX + i / subdivPerTile;
        const sample = this.sampleTerrain(grid, gx, gy, gridWidth, gridHeight);
        const idx = j * verticesX + i;
        samples[idx] = sample;
        if (sample.waterWeight > maxWaterWeight) {
          maxWaterWeight = sample.waterWeight;
        }
      }
    }

    // Completely dry chunk: return null (zero draw calls & zero water mesh overhead)
    if (maxWaterWeight < 0.01) {
      return null;
    }

    const positions = new Float32Array(numVertices * 3);
    const uvs = new Float32Array(numVertices * 2);
    const waterWeights = new Float32Array(numVertices);
    const waterDepths = new Float32Array(numVertices);

    let vIdx = 0;
    for (let j = 0; j <= segmentsY; j++) {
      const gy = minY + j / subdivPerTile;
      for (let i = 0; i <= segmentsX; i++) {
        const gx = minX + i / subdivPerTile;
        const sample = samples[vIdx];

        const wx = (gx - gridWidth / 2) * TILE_SIZE;
        const wz = (gy - gridHeight / 2) * TILE_SIZE;

        positions[vIdx * 3 + 0] = wx;
        positions[vIdx * 3 + 1] = WATER_LEVEL;
        positions[vIdx * 3 + 2] = wz;

        uvs[vIdx * 2 + 0] = i / segmentsX;
        uvs[vIdx * 2 + 1] = j / segmentsY;

        waterWeights[vIdx] = sample.waterWeight;
        waterDepths[vIdx] = Math.max(0, WATER_LEVEL - sample.height);

        vIdx++;
      }
    }

    // Only add indices for quads where at least one corner has waterWeight > 0.01
    const quadIndices: number[] = [];
    for (let j = 0; j < segmentsY; j++) {
      for (let i = 0; i < segmentsX; i++) {
        const r1c1 = j * verticesX + i;
        const r1c2 = j * verticesX + i + 1;
        const r2c1 = (j + 1) * verticesX + i;
        const r2c2 = (j + 1) * verticesX + i + 1;

        const w1 = samples[r1c1].waterWeight;
        const w2 = samples[r1c2].waterWeight;
        const w3 = samples[r2c1].waterWeight;
        const w4 = samples[r2c2].waterWeight;

        if (w1 > 0.01 || w2 > 0.01 || w3 > 0.01 || w4 > 0.01) {
          quadIndices.push(r1c1, r2c1, r1c2);
          quadIndices.push(r1c2, r2c1, r2c2);
        }
      }
    }

    if (quadIndices.length === 0) {
      return null;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('aWaterWeight', new THREE.BufferAttribute(waterWeights, 1));
    geometry.setAttribute('aWaterDepth', new THREE.BufferAttribute(waterDepths, 1));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(quadIndices), 1));
    geometry.computeVertexNormals();

    return geometry;
  }
}

