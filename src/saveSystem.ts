import { CityState } from './types';

export interface SaveData {
  version: number;
  id: string;
  cityName: string;
  timestamp: number;
  gameState: CityState;
}

export interface SaveSlotInfo {
  slotId: string;
  cityName: string;
  timestamp: number;
  population: number;
  money: number;
  day: number;
  hasData: boolean;
  isAutosave?: boolean;
}

const SAVE_KEY_PREFIX = 'skyline_sim_save_';
export const CURRENT_SAVE_VERSION = 1;

export function saveGame(slotId: string, state: CityState, cityName = 'Skyline City'): boolean {
  try {
    const saveData: SaveData = {
      version: CURRENT_SAVE_VERSION,
      id: slotId,
      cityName,
      timestamp: Date.now(),
      gameState: state,
    };
    const json = JSON.stringify(saveData);
    localStorage.setItem(SAVE_KEY_PREFIX + slotId, json);
    return true;
  } catch (err) {
    console.error('Failed to save game:', err);
    return false;
  }
}

export function loadGame(slotId: string): SaveData | null {
  try {
    const json = localStorage.getItem(SAVE_KEY_PREFIX + slotId);
    if (!json) return null;
    const saveData: SaveData = JSON.parse(json);
    
    // Migration checks if version differs in future releases
    if (!saveData.version) {
      saveData.version = 1;
    }
    
    return saveData;
  } catch (err) {
    console.error('Failed to load game:', err);
    return null;
  }
}

export function deleteSave(slotId: string): void {
  try {
    localStorage.removeItem(SAVE_KEY_PREFIX + slotId);
  } catch (err) {
    console.error('Failed to delete save:', err);
  }
}

export function listSaveSlots(): SaveSlotInfo[] {
  const slots = ['autosave', 'slot_1', 'slot_2', 'slot_3'];
  return slots.map((slotId) => {
    const data = loadGame(slotId);
    if (data) {
      return {
        slotId,
        cityName: data.cityName || 'Skyline City',
        timestamp: data.timestamp,
        population: data.gameState?.population || 0,
        money: data.gameState?.money || 0,
        day: data.gameState?.day || 1,
        hasData: true,
        isAutosave: slotId === 'autosave',
      };
    }
    return {
      slotId,
      cityName: 'Empty Slot',
      timestamp: 0,
      population: 0,
      money: 0,
      day: 0,
      hasData: false,
      isAutosave: slotId === 'autosave',
    };
  });
}

export function exportSaveJson(slotId: string): string | null {
  const data = loadGame(slotId);
  if (!data) return null;
  return JSON.stringify(data, null, 2);
}

export function importSaveJson(slotId: string, jsonStr: string): boolean {
  try {
    const parsed: SaveData = JSON.parse(jsonStr);
    if (!parsed.gameState || typeof parsed.gameState.money !== 'number') {
      return false;
    }
    saveGame(slotId, parsed.gameState, parsed.cityName || 'Imported City');
    return true;
  } catch (err) {
    console.error('Failed to import save:', err);
    return false;
  }
}
