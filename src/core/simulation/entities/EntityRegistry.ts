import { BuildingEntity } from './BuildingEntity';
import { TileType } from '../../../types';

export class EntityRegistry {
  private buildingsById = new Map<string, BuildingEntity>();
  private buildingsByChunk = new Map<string, Set<string>>();

  public addBuilding(building: BuildingEntity): void {
    this.buildingsById.set(building.id, building);
    
    // Determine chunk based on origin
    const chunkX = Math.floor(building.originX / 10); // Assume CHUNK_SIZE = 10 for now
    const chunkY = Math.floor(building.originY / 10);
    const chunkId = `${chunkX},${chunkY}`;
    
    let chunkSet = this.buildingsByChunk.get(chunkId);
    if (!chunkSet) {
      chunkSet = new Set<string>();
      this.buildingsByChunk.set(chunkId, chunkSet);
    }
    chunkSet.add(building.id);
  }

  public getBuilding(id: string): BuildingEntity | undefined {
    return this.buildingsById.get(id);
  }

  public removeBuilding(id: string): void {
    const building = this.buildingsById.get(id);
    if (!building) return;

    this.buildingsById.delete(id);

    const chunkX = Math.floor(building.originX / 10);
    const chunkY = Math.floor(building.originY / 10);
    const chunkId = `${chunkX},${chunkY}`;
    const chunkSet = this.buildingsByChunk.get(chunkId);
    if (chunkSet) {
      chunkSet.delete(id);
      if (chunkSet.size === 0) {
        this.buildingsByChunk.delete(chunkId);
      }
    }
  }

  public getAllBuildings(): BuildingEntity[] {
    return Array.from(this.buildingsById.values());
  }

  public getBuildingsAsRecord(): Record<string, BuildingEntity> {
    const record: Record<string, BuildingEntity> = {};
    for (const [id, building] of this.buildingsById.entries()) {
      record[id] = building;
    }
    return record;
  }
}
