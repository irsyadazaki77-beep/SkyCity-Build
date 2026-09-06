import { TileData, TileType } from '../../types';

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
        const regionKey = `${Math.floor(cx / 2)},${Math.floor(cy / 2)}`;
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
      }
    }
  }

  public markTileDirty(x: number, y: number, type?: TileType): void {
    const { cx, cy } = this.getChunkForTile(x, y);
    const key = this.getChunkKey(cx, cy);
    const chunk = this.chunks.get(key);
    if (chunk) {
      chunk.isDirty = true;
      if (type === TileType.ROAD) chunk.roadsDirty = true;
      else if (type !== undefined && type !== TileType.EMPTY) chunk.buildingsDirty = true;
      else {
        chunk.terrainDirty = true;
        chunk.buildingsDirty = true;
        chunk.roadsDirty = true;
      }
    }
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
      const cRegionKey = `${Math.floor(chunk.cx / 2)},${Math.floor(chunk.cy / 2)}`;
      if (cRegionKey === regionKey || chunk.id === regionKey) {
        chunk.unlocked = unlocked;
        chunk.isDirty = true;
      }
    }
  }
}
