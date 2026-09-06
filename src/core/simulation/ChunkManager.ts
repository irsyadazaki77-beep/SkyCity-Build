import { TileData, TileType } from '../../types';
import { REGION_SIZE } from '../../mapGenerator';

export const CHUNK_SIZE = 12; // 12x12 tiles per chunk

export interface ChunkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WorldChunk {
  id: string;
  cx: number;
  cy: number;
  bounds: ChunkBounds;
  isDirty: boolean;
  terrainDirty: boolean;
  buildingsDirty: boolean;
  roadsDirty: boolean;
  tiles: TileData[][];
  buildingCount: number;
  roadCount: number;
  unlocked: boolean;
}

export class ChunkManager {
  private chunks: Map<string, WorldChunk> = new Map();
  public width: number;
  public height: number;
  public chunksX: number;
  public chunksY: number;

  public dirtyTerrainChunkKeys: Set<string> = new Set();
  public dirtyRoadChunkKeys: Set<string> = new Set();
  public dirtyBuildingChunkKeys: Set<string> = new Set();

  constructor(width = 60, height = 60) {
    this.width = width;
    this.height = height;
    this.chunksX = Math.ceil(width / CHUNK_SIZE);
    this.chunksY = Math.ceil(height / CHUNK_SIZE);
  }

  public getChunkKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  public getChunkForTile(x: number, y: number): { cx: number; cy: number } {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    return { cx, cy };
  }

  public initFromGrid(grid: TileData[][], unlockedRegions: string[] = ['1,1']): void {
    this.chunks.clear();
    this.dirtyTerrainChunkKeys.clear();
    this.dirtyRoadChunkKeys.clear();
    this.dirtyBuildingChunkKeys.clear();

    this.height = grid.length;
    this.width = grid[0]?.length || 0;
    this.chunksX = Math.ceil(this.width / CHUNK_SIZE);
    this.chunksY = Math.ceil(this.height / CHUNK_SIZE);

    for (let cy = 0; cy < this.chunksY; cy++) {
      for (let cx = 0; cx < this.chunksX; cx++) {
        const minX = cx * CHUNK_SIZE;
        const minY = cy * CHUNK_SIZE;
        const maxX = Math.min(this.width - 1, (cx + 1) * CHUNK_SIZE - 1);
        const maxY = Math.min(this.height - 1, (cy + 1) * CHUNK_SIZE - 1);

        const chunkTiles: TileData[][] = [];
        let buildingCount = 0;
        let roadCount = 0;

        for (let y = minY; y <= maxY; y++) {
          const row: TileData[] = [];
          for (let x = minX; x <= maxX; x++) {
            const tile = grid[y]?.[x];
            if (tile) {
              row.push(tile);
              if (tile.type === TileType.ROAD) roadCount++;
              else if (tile.type !== TileType.EMPTY) buildingCount++;
            }
          }
          chunkTiles.push(row);
        }

        const id = this.getChunkKey(cx, cy);
        const regionKey = `${Math.floor((cx * CHUNK_SIZE) / REGION_SIZE)},${Math.floor((cy * CHUNK_SIZE) / REGION_SIZE)}`;
        const unlocked = unlockedRegions.includes(regionKey) || unlockedRegions.includes(id);

        this.chunks.set(id, {
          id,
          cx,
          cy,
          bounds: { minX, minY, maxX, maxY },
          isDirty: true,
          terrainDirty: true,
          buildingsDirty: true,
          roadsDirty: true,
          tiles: chunkTiles,
          buildingCount,
          roadCount,
          unlocked,
        });

        this.dirtyTerrainChunkKeys.add(id);
        this.dirtyRoadChunkKeys.add(id);
        this.dirtyBuildingChunkKeys.add(id);
      }
    }
  }

  public markTerrainDirty(x: number, y: number, includeSeams = true): void {
    const { cx, cy } = this.getChunkForTile(x, y);
    const key = this.getChunkKey(cx, cy);
    this.dirtyTerrainChunkKeys.add(key);

    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.isDirty = true;
      chunk.terrainDirty = true;
    }

    // Seam neighbor propagation (terrain mesh overlaps 1 unit for smooth continuous normal calculation)
    if (includeSeams) {
      const modX = x % CHUNK_SIZE;
      const modY = y % CHUNK_SIZE;

      if (modX === 0 && cx > 0) {
        this.markChunkTerrainDirty(cx - 1, cy);
      } else if (modX === CHUNK_SIZE - 1 && cx < this.chunksX - 1) {
        this.markChunkTerrainDirty(cx + 1, cy);
      }

      if (modY === 0 && cy > 0) {
        this.markChunkTerrainDirty(cx, cy - 1);
      } else if (modY === CHUNK_SIZE - 1 && cy < this.chunksY - 1) {
        this.markChunkTerrainDirty(cx, cy + 1);
      }

      // Corners
      if (modX === 0 && modY === 0 && cx > 0 && cy > 0) {
        this.markChunkTerrainDirty(cx - 1, cy - 1);
      } else if (modX === CHUNK_SIZE - 1 && modY === 0 && cx < this.chunksX - 1 && cy > 0) {
        this.markChunkTerrainDirty(cx + 1, cy - 1);
      } else if (modX === 0 && modY === CHUNK_SIZE - 1 && cx > 0 && cy < this.chunksY - 1) {
        this.markChunkTerrainDirty(cx - 1, cy + 1);
      } else if (modX === CHUNK_SIZE - 1 && modY === CHUNK_SIZE - 1 && cx < this.chunksX - 1 && cy < this.chunksY - 1) {
        this.markChunkTerrainDirty(cx + 1, cy + 1);
      }
    }
  }

  private markChunkTerrainDirty(cx: number, cy: number): void {
    const k = this.getChunkKey(cx, cy);
    this.dirtyTerrainChunkKeys.add(k);
    const c = this.chunks.get(k);
    if (c) {
      c.isDirty = true;
      c.terrainDirty = true;
    }
  }

  public markRoadDirty(x: number, y: number): void {
    const { cx, cy } = this.getChunkForTile(x, y);
    const key = this.getChunkKey(cx, cy);
    this.dirtyRoadChunkKeys.add(key);

    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.isDirty = true;
      chunk.roadsDirty = true;
    }
  }

  public markBuildingDirty(x: number, y: number): void {
    const { cx, cy } = this.getChunkForTile(x, y);
    const key = this.getChunkKey(cx, cy);
    this.dirtyBuildingChunkKeys.add(key);

    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.isDirty = true;
      chunk.buildingsDirty = true;
    }
  }

  public markTileDirty(x: number, y: number, type?: TileType): void {
    if (type === TileType.ROAD) {
      this.markRoadDirty(x, y);
    } else if (type !== undefined && type !== TileType.EMPTY) {
      this.markBuildingDirty(x, y);
    } else {
      this.markTerrainDirty(x, y, true);
      this.markBuildingDirty(x, y);
      this.markRoadDirty(x, y);
    }
  }

  public consumeDirtyChunks(): { terrain: string[]; roads: string[]; buildings: string[] } {
    const res = {
      terrain: Array.from(this.dirtyTerrainChunkKeys),
      roads: Array.from(this.dirtyRoadChunkKeys),
      buildings: Array.from(this.dirtyBuildingChunkKeys),
    };
    this.dirtyTerrainChunkKeys.clear();
    this.dirtyRoadChunkKeys.clear();
    this.dirtyBuildingChunkKeys.clear();
    return res;
  }


  public getChunk(cx: number, cy: number): WorldChunk | undefined {
    return this.chunks.get(this.getChunkKey(cx, cy));
  }

  public getAllChunks(): WorldChunk[] {
    return Array.from(this.chunks.values());
  }

  public getUnlockedChunks(): WorldChunk[] {
    return Array.from(this.chunks.values()).filter((c) => c.unlocked);
  }

  public setRegionUnlocked(rx: number, ry: number, unlocked: boolean): void {
    const regionKey = `${rx},${ry}`;
    for (const chunk of this.chunks.values()) {
      const cRegionKey = `${Math.floor((chunk.cx * CHUNK_SIZE) / REGION_SIZE)},${Math.floor((chunk.cy * CHUNK_SIZE) / REGION_SIZE)}`;
      if (cRegionKey === regionKey || chunk.id === regionKey) {
        chunk.unlocked = unlocked;
        chunk.isDirty = true;
      }
    }
  }
}
