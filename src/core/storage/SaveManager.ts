import { CityState } from '../../types';

export interface SaveMetadata {
  version: number;
  id: string;
  slotId?: string;
  cityName: string;
  timestamp: number;
  population: number;
  money: number;
  day: number;
  hasData: boolean;
  isAutosave?: boolean;
}

export type SaveSlotInfo = SaveMetadata;

export interface SavePayload {
  version: number;
  id: string;
  cityName: string;
  timestamp: number;
  gameState: CityState;
}

export type SaveData = SavePayload;

const DB_NAME = 'SkyCity3D_DB';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const LOCAL_STORAGE_PREFIX = 'skycity_save_';

export const CURRENT_SAVE_VERSION = 3;

class IndexedDBAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memStore: Map<string, SavePayload> = new Map();

  private getDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB not supported in this environment'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  public async setItem(key: string, data: SavePayload): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ ...data, id: key });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    } catch {}
    this.memStore.set(key, data);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(data));
      } catch {}
    }
  }

  public async getItem(key: string): Promise<SavePayload | null> {
    try {
      const db = await this.getDB();
      const res = await new Promise<SavePayload | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      if (res) return res;
    } catch {}
    if (this.memStore.has(key)) return this.memStore.get(key)!;
    if (typeof localStorage !== 'undefined') {
      try {
        const json = localStorage.getItem(LOCAL_STORAGE_PREFIX + key) || localStorage.getItem('skyline_sim_save_' + key);
        if (json) return JSON.parse(json);
      } catch {}
    }
    return null;
  }

  public async deleteItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
    this.memStore.delete(key);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LOCAL_STORAGE_PREFIX + key);
        localStorage.removeItem('skyline_sim_save_' + key);
      } catch {}
    }
  }
}

const idb = new IndexedDBAdapter();

export class SaveManager {
  private static autosaveIndex = 0;

  public static isValidCityState(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.money !== 'number') return false;
    if (typeof obj.population !== 'number') return false;
    if (typeof obj.day !== 'number') return false;
    if (!Array.isArray(obj.grid)) return false;
    
    // Check some elements of grid to verify structure
    const grid = obj.grid;
    if (grid.length === 0 || !Array.isArray(grid[0])) return false;
    
    // Check rectangular grid and first tile
    const width = grid[0].length;
    for (let y = 0; y < Math.min(grid.length, 5); y++) {
        if (!Array.isArray(grid[y]) || grid[y].length !== width) return false;
        for (let x = 0; x < Math.min(width, 5); x++) {
            const tile = grid[y][x];
            if (!tile || typeof tile !== 'object') return false;
            if (typeof tile.x !== 'number' || typeof tile.y !== 'number' || typeof tile.type !== 'number') return false;
            if (typeof tile.level !== 'number' || typeof tile.population !== 'number' || typeof tile.jobs !== 'number') return false;
            if (typeof tile.elevation !== 'number' || typeof tile.water !== 'boolean') return false;
        }
    }
    
    return true;
  }

  public static async saveGame(slotId: string, state: CityState, cityName = 'SkyCity Metropolis'): Promise<boolean> {
    try {
      if (!this.isValidCityState(state)) {
        console.error('SaveManager: Rejected saving due to invalid state schema');
        return false;
      }

      const payload: SavePayload = {
        version: CURRENT_SAVE_VERSION,
        id: slotId,
        cityName,
        timestamp: Date.now(),
        gameState: state,
      };

      await idb.setItem(slotId, payload);

      // Defers synchronous stringification/write to prevent frame drops in active render loop
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(LOCAL_STORAGE_PREFIX + slotId, JSON.stringify(payload));
            } catch (err) {
              console.warn('LocalStorage save failed:', err);
            }
          }
          resolve();
        }, 0);
      });

      return true;
    } catch (err) {
      console.error('SaveManager: failed to save game', err);
      return false;
    }
  }

  public static async loadGame(slotId: string): Promise<SavePayload | null> {
    try {
      let data = await idb.getItem(slotId);
      if (!data && typeof localStorage !== 'undefined') {
        try {
          const fallbackJson = localStorage.getItem(LOCAL_STORAGE_PREFIX + slotId) || localStorage.getItem('skyline_sim_save_' + slotId);
          if (fallbackJson) {
            data = JSON.parse(fallbackJson);
          }
        } catch {}
      }

      if (!data) return null;

      if (data.version < CURRENT_SAVE_VERSION) {
        data = this.migrateSaveData(data);
      }

      if (!this.isValidCityState(data.gameState)) {
        console.error('SaveManager: Rejected loading due to invalid state schema in save');
        return null;
      }

      return data;
    } catch (err) {
      console.error('SaveManager: failed to load game', err);
      return null;
    }
  }

  public static async deleteSave(slotId: string): Promise<void> {
    await idb.deleteItem(slotId);
  }

  public static async listSlots(): Promise<SaveMetadata[]> {
    const slotKeys = ['autosave', 'autosave_2', 'autosave_3', 'slot_1', 'slot_2', 'slot_3', 'slot_4'];
    const results: SaveMetadata[] = [];

    for (const slotId of slotKeys) {
      const data = await this.loadGame(slotId);
      if (data && data.gameState) {
        results.push({
          version: data.version,
          id: slotId,
          slotId,
          cityName: data.cityName || 'SkyCity',
          timestamp: data.timestamp,
          population: data.gameState.population || 0,
          money: data.gameState.money || 0,
          day: data.gameState.day || 1,
          hasData: true,
          isAutosave: slotId.startsWith('autosave'),
        });
      } else {
        results.push({
          version: CURRENT_SAVE_VERSION,
          id: slotId,
          slotId,
          cityName: 'Empty Slot',
          timestamp: 0,
          population: 0,
          money: 0,
          day: 0,
          hasData: false,
          isAutosave: slotId.startsWith('autosave'),
        });
      }
    }

    return results;
  }

  public static async triggerAutosave(state: CityState): Promise<string> {
    this.autosaveIndex = (this.autosaveIndex % 3) + 1;
    const slotId = this.autosaveIndex === 1 ? 'autosave' : `autosave_${this.autosaveIndex}`;
    await this.saveGame(slotId, state, 'Autosave');
    return slotId;
  }

  public static async exportJson(slotId: string): Promise<string | null> {
    const data = await this.loadGame(slotId);
    if (!data) return null;
    return JSON.stringify(data, null, 2);
  }

  public static async importJson(slotId: string, jsonStr: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.gameState || !this.isValidCityState(parsed.gameState)) {
        return false;
      }
      return await this.saveGame(slotId, parsed.gameState, parsed.cityName || 'Imported Metropolis');
    } catch (err) {
      console.error('SaveManager: invalid import format', err);
      return false;
    }
  }

  private static migrateSaveData(oldData: any): SavePayload {
    const migratedState: CityState = {
      ...oldData.gameState,
      unlockedRegions: oldData.gameState.unlockedRegions || ['1,1'],
      activeEvents: oldData.gameState.activeEvents || [],
      activePolicies: oldData.gameState.activePolicies || [],
      history: oldData.gameState.history || [],
    };

    return {
      version: CURRENT_SAVE_VERSION,
      id: oldData.id || 'slot_1',
      cityName: oldData.cityName || 'SkyCity Metropolis',
      timestamp: oldData.timestamp || Date.now(),
      gameState: migratedState,
    };
  }
}

