import * as THREE from 'three';
import { TileType } from '../../types';

export const TILE_SIZE = 1; // 1 unit in 3D world per tile
export const GRID_WIDTH = 30;
export const GRID_HEIGHT = 20;

export function getOffsetX(gridWidth = GRID_WIDTH) {
  return -(gridWidth * TILE_SIZE) / 2 + TILE_SIZE / 2;
}

export function getOffsetZ(gridHeight = GRID_HEIGHT) {
  return -(gridHeight * TILE_SIZE) / 2 + TILE_SIZE / 2;
}

export function gridToWorld(x: number, y: number, gridWidth = GRID_WIDTH, gridHeight = GRID_HEIGHT): [number, number, number] {
  return [getOffsetX(gridWidth) + x * TILE_SIZE, 0, getOffsetZ(gridHeight) + y * TILE_SIZE];
}

export function worldToGrid(wx: number, wz: number, gridWidth = GRID_WIDTH, gridHeight = GRID_HEIGHT): [number, number] | null {
  const x = Math.floor((wx - getOffsetX(gridWidth) + TILE_SIZE / 2) / TILE_SIZE);
  const y = Math.floor((wz - getOffsetZ(gridHeight) + TILE_SIZE / 2) / TILE_SIZE);
  if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
    return [x, y];
  }
  return null;
}

export interface DayNightState {
  timeOfDay: number; // 0.0 to 1.0 (0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0.0 = midnight)
  isNight: boolean;
  nightFactor: number; // 0.0 (full day) to 1.0 (full night)
  sunPosition: [number, number, number];
  skyColor: string;
  fogColor: string;
  ambientIntensity: number;
  sunIntensity: number;
  emissiveIntensity: number;
}
