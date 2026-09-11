export type BuildingArchitecture =
  | 'RES_TENT' | 'RES_CABIN' | 'RES_HOUSE' | 'RES_APARTMENT' | 'RES_HIGHRISE'
  | 'COM_STALL' | 'COM_SHOP' | 'COM_MALL' | 'COM_TOWER' | 'COM_PREMIUM_SKYSCRAPER'
  | 'IND_WORKSHOP' | 'IND_WAREHOUSE' | 'IND_FACTORY' | 'IND_LOGISTICS' | 'IND_HIGHTECH'
  | 'SRV_POWER' | 'SRV_WATER' | 'SRV_FIRE' | 'SRV_POLICE' | 'SRV_CLINIC' | 'SRV_SCHOOL' | 'SRV_WASTE' | 'SRV_PARK';

export function getArchitectureColors(arch: BuildingArchitecture): { base: string; accent: string; patternType: number } {
  switch (arch) {
    // Residential Tier 1-5 (Warm Scandinavian & Contemporary Urban)
    case 'RES_TENT':
      return { base: '#f3f4f6', accent: '#78350f', patternType: 0 };
    case 'RES_CABIN':
      return { base: '#d7c4b7', accent: '#a16207', patternType: 0 };
    case 'RES_HOUSE':
      return { base: '#f8fafc', accent: '#c2410c', patternType: 0 };
    case 'RES_APARTMENT':
      return { base: '#f1f5f9', accent: '#334155', patternType: 0 };
    case 'RES_HIGHRISE':
      return { base: '#ffffff', accent: '#1e293b', patternType: 0 };

    // Commercial Tier 1-5 (Storefronts to Glass Curtain Wall Towers)
    case 'COM_STALL':
      return { base: '#ffedd5', accent: '#ea580c', patternType: 1 };
    case 'COM_SHOP':
      return { base: '#f0f9ff', accent: '#2563eb', patternType: 1 };
    case 'COM_MALL':
      return { base: '#e0f2fe', accent: '#0284c7', patternType: 1 };
    case 'COM_TOWER':
      return { base: '#cbd5e1', accent: '#0369a1', patternType: 1 };
    case 'COM_PREMIUM_SKYSCRAPER':
      return { base: '#94a3b8', accent: '#0284c7', patternType: 1 };

    // Industrial Tier 1-5 (Heavy manufacturing to Clean Tech)
    case 'IND_WORKSHOP':
      return { base: '#e2e8f0', accent: '#b45309', patternType: 2 };
    case 'IND_WAREHOUSE':
      return { base: '#cbd5e1', accent: '#475569', patternType: 2 };
    case 'IND_FACTORY':
      return { base: '#94a3b8', accent: '#d97706', patternType: 2 };
    case 'IND_LOGISTICS':
      return { base: '#cbd5e1', accent: '#1d4ed8', patternType: 2 };
    case 'IND_HIGHTECH':
      return { base: '#f1f5f9', accent: '#0891b2', patternType: 2 };

    // Civic Services & Public Infrastructure
    case 'SRV_POWER':
      return { base: '#64748b', accent: '#f59e0b', patternType: 2 };
    case 'SRV_WATER':
      return { base: '#475569', accent: '#0284c7', patternType: 2 };
    case 'SRV_FIRE':
      return { base: '#ffffff', accent: '#dc2626', patternType: 2 };
    case 'SRV_POLICE':
      return { base: '#1e3a8a', accent: '#f8fafc', patternType: 2 };
    case 'SRV_CLINIC':
      return { base: '#ffffff', accent: '#0d9488', patternType: 2 };
    case 'SRV_SCHOOL':
      return { base: '#b45309', accent: '#15803d', patternType: 2 };
    case 'SRV_WASTE':
      return { base: '#4b5563', accent: '#65a30d', patternType: 2 };
    case 'SRV_PARK':
      return { base: '#15803d', accent: '#78350f', patternType: 0 };

    default:
      return { base: '#e2e8f0', accent: '#64748b', patternType: 0 };
  }
}

