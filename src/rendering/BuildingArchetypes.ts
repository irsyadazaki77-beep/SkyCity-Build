export type BuildingArchitecture =
  | 'RES_TENT' | 'RES_CABIN' | 'RES_HOUSE' | 'RES_APARTMENT' | 'RES_HIGHRISE'
  | 'COM_STALL' | 'COM_SHOP' | 'COM_MALL' | 'COM_TOWER' | 'COM_PREMIUM_SKYSCRAPER'
  | 'IND_WORKSHOP' | 'IND_WAREHOUSE' | 'IND_FACTORY' | 'IND_LOGISTICS' | 'IND_HIGHTECH'
  | 'SRV_POWER' | 'SRV_WATER' | 'SRV_FIRE' | 'SRV_POLICE' | 'SRV_CLINIC' | 'SRV_SCHOOL' | 'SRV_WASTE' | 'SRV_PARK';

export function getArchitectureColors(arch: BuildingArchitecture): { base: string; accent: string; patternType: number } {
  if (arch.startsWith('RES_')) {
    return { base: '#e2e8f0', accent: '#94a3b8', patternType: 0 };
  } else if (arch.startsWith('COM_')) {
    return { base: '#dbeafe', accent: '#60a5fa', patternType: 1 };
  } else if (arch.startsWith('IND_')) {
    return { base: '#fef3c7', accent: '#f59e0b', patternType: 2 };
  } else {
    return { base: '#f3f4f6', accent: '#6b7280', patternType: 2 };
  }
}
