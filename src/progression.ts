import { TileType, CityState } from './types';

export interface CityMilestone {
  level: number;
  name: string;
  minPopulation: number;
  minMoney: number;
  description: string;
  unlockedBuildingTypes: TileType[];
}

export const MILESTONES: CityMilestone[] = [
  {
    level: 0,
    name: 'Village',
    minPopulation: 0,
    minMoney: 0,
    description: 'Basic rural settlement with simple roads and utility needs.',
    unlockedBuildingTypes: [
      TileType.ROAD,
      TileType.RESIDENTIAL,
      TileType.COMMERCIAL,
      TileType.INDUSTRIAL,
      TileType.POWER_PLANT,
      TileType.WATER_PUMP,
    ],
  },
  {
    level: 1,
    name: 'Town',
    minPopulation: 50,
    minMoney: 12000,
    description: 'A growing town demanding emergency care, health, and leisure.',
    unlockedBuildingTypes: [
      TileType.PARK,
      TileType.CLINIC,
      TileType.FIRE_STATION,
    ],
  },
  {
    level: 2,
    name: 'City',
    minPopulation: 200,
    minMoney: 25000,
    description: 'A burgeoning urban center requiring law enforcement and education.',
    unlockedBuildingTypes: [
      TileType.POLICE_STATION,
      TileType.SCHOOL,
    ],
  },
  {
    level: 3,
    name: 'Large City',
    minPopulation: 600,
    minMoney: 60000,
    description: 'Industrial hub needing waste management and high-density zones.',
    unlockedBuildingTypes: [
      TileType.WASTE_MANAGEMENT,
    ],
  },
  {
    level: 4,
    name: 'Metropolis',
    minPopulation: 1500,
    minMoney: 150000,
    description: 'Sprawling metropolis demanding smart infrastructure and tech innovation.',
    unlockedBuildingTypes: [],
  },
  {
    level: 5,
    name: 'Megacity',
    minPopulation: 3500,
    minMoney: 400000,
    description: 'Pinnacle of human architecture with skyscraper permits and megastructures.',
    unlockedBuildingTypes: [],
  },
];

export function getCurrentMilestone(pop: number, money: number): CityMilestone {
  let current = MILESTONES[0];
  for (const m of MILESTONES) {
    if (pop >= m.minPopulation && money >= m.minMoney) {
      current = m;
    }
  }
  return current;
}

export function isBuildingUnlocked(type: TileType, milestoneLevel: number): boolean {
  if (type === TileType.EMPTY || type === TileType.ROAD || type === TileType.RESIDENTIAL || type === TileType.COMMERCIAL || type === TileType.INDUSTRIAL || type === TileType.POWER_PLANT || type === TileType.WATER_PUMP) {
    return true;
  }
  for (let lvl = 0; lvl <= milestoneLevel; lvl++) {
    const m = MILESTONES[lvl];
    if (m && m.unlockedBuildingTypes.includes(type)) {
      return true;
    }
  }
  return false;
}

// Policies
export interface Policy {
  id: string;
  name: string;
  description: string;
  dailyUpkeep: number;
  unlockedMilestoneLevel: number;
}

export const POLICIES: Policy[] = [
  {
    id: 'FREE_TRANSIT',
    name: 'Free Public Transit',
    description: 'Provides free bus and tram tickets. Traffic -25%, Happiness +5%.',
    dailyUpkeep: 400,
    unlockedMilestoneLevel: 1,
  },
  {
    id: 'RECYCLING_MANDATE',
    name: 'Recycling Mandate',
    description: 'Mandates city-wide sorting. Waste output -30%, Pollution -15%.',
    dailyUpkeep: 200,
    unlockedMilestoneLevel: 2,
  },
  {
    id: 'GREEN_SUBSIDY',
    name: 'Green Energy Subsidies',
    description: 'Subsidizes solar and conservation. Power Demand -15%, Happiness +3%.',
    dailyUpkeep: 300,
    unlockedMilestoneLevel: 2,
  },
  {
    id: 'IND_TAX_BREAK',
    name: 'Industrial Expansion Break',
    description: 'Tax breaks for factories. Industrial Demand +25%, Ind Income +15%, Pollution +10%.',
    dailyUpkeep: 0,
    unlockedMilestoneLevel: 1,
  },
  {
    id: 'HEAVY_TRAFFIC_BAN',
    name: 'Residential Noise Restrictions',
    description: 'Bans heavy freight trucks in neighborhood centers. Noise -20%, Commercial Tax -5%.',
    dailyUpkeep: 150,
    unlockedMilestoneLevel: 2,
  },
  {
    id: 'HEALTH_CARE_ALL',
    name: 'Universal Clinic Access',
    description: 'Subsidizes medical clinic operations. Health Index +10, Coverage +20%.',
    dailyUpkeep: 500,
    unlockedMilestoneLevel: 3,
  },
];

// Tech Tree Nodes (Upgrades with Prerequisites)
export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'Infrastructure' | 'Utilities' | 'Zoning' | 'Economy' | 'Environment';
  prerequisiteId?: string;
  requiredMilestoneLevel: number;
}

export const TECH_NODES: TechNode[] = [
  // Infrastructure
  { id: 'asphalt_roads', name: 'Asphalt Roadways', description: 'Smoother roads reduce traffic buildup.', cost: 5000, category: 'Infrastructure', requiredMilestoneLevel: 0 },
  { id: 'smart_lights', name: 'Smart Traffic Signals', description: 'Optimized light cycles reduce traffic congestion by 10%.', cost: 10000, category: 'Infrastructure', prerequisiteId: 'asphalt_roads', requiredMilestoneLevel: 1 },
  { id: 'bus_network', name: 'Municipal Bus Transit', description: 'Public transit network reduces traffic by 20%.', cost: 25000, category: 'Infrastructure', prerequisiteId: 'smart_lights', requiredMilestoneLevel: 2 },
  { id: 'tram_system', name: 'Electric Tram Network', description: 'High-capacity rail cuts traffic congestion by 30%.', cost: 50000, category: 'Infrastructure', prerequisiteId: 'bus_network', requiredMilestoneLevel: 3 },
  { id: 'highway_conn', name: 'Highway Logistics Bypass', description: 'Boosts Industrial revenue by 15%.', cost: 30000, category: 'Infrastructure', prerequisiteId: 'smart_lights', requiredMilestoneLevel: 2 },

  // Utilities
  { id: 'water_meters', name: 'Smart Water Meters', description: 'Reduces city water demand by 10%.', cost: 12000, category: 'Utilities', requiredMilestoneLevel: 0 },
  { id: 'high_cap_pipes', name: 'High-Capacity Main Pipes', description: 'Increases water network capacity by 20%.', cost: 15000, category: 'Utilities', prerequisiteId: 'water_meters', requiredMilestoneLevel: 1 },
  { id: 'deep_pumps', name: 'Subterranean Deep Pumps', description: 'Water pumping output boosted by 50%.', cost: 35000, category: 'Utilities', prerequisiteId: 'high_cap_pipes', requiredMilestoneLevel: 2 },
  { id: 'smart_grid', name: 'Smart Power Distribution', description: 'Increases power grid capacity by 20%.', cost: 15000, category: 'Utilities', requiredMilestoneLevel: 0 },
  { id: 'solar_subsidies', name: 'Rooftop Solar Incentives', description: 'Reduces overall city power demand by 10%.', cost: 20000, category: 'Utilities', prerequisiteId: 'smart_grid', requiredMilestoneLevel: 1 },
  { id: 'adv_turbines', name: 'Advanced Energy Turbines', description: 'Power plant generation output +50%.', cost: 40000, category: 'Utilities', prerequisiteId: 'solar_subsidies', requiredMilestoneLevel: 2 },

  // Zoning & Density
  { id: 'mixed_use', name: 'Mixed-Use Commercial Zoning', description: 'Boosts Commercial tax revenue by 10%.', cost: 25000, category: 'Zoning', requiredMilestoneLevel: 1 },
  { id: 'high_dens_res', name: 'High-Density Residential Permits', description: 'Allows Residential zones to evolve to Level 4 High-Rises.', cost: 30000, category: 'Zoning', prerequisiteId: 'mixed_use', requiredMilestoneLevel: 3 },
  { id: 'high_dens_com', name: 'High-Density Commercial Towers', description: 'Allows Commercial zones to evolve to Level 4 Glass Towers.', cost: 30000, category: 'Zoning', prerequisiteId: 'mixed_use', requiredMilestoneLevel: 3 },
  { id: 'high_dens_ind', name: 'High-Tech Automated Complexes', description: 'Allows Industrial zones to evolve to Level 4 Clean-Tech Hubs.', cost: 30000, category: 'Zoning', prerequisiteId: 'high_dens_res', requiredMilestoneLevel: 3 },
  { id: 'sky_permits', name: 'Skyscraper Construction Permits', description: 'Unlocks Level 5 Megastructures for all zones.', cost: 80000, category: 'Zoning', prerequisiteId: 'high_dens_res', requiredMilestoneLevel: 5 },

  // Economy
  { id: 'prop_tax_hike', name: 'Property Tax Optimization', description: 'Increases Residential tax revenue by 15%.', cost: 5000, category: 'Economy', requiredMilestoneLevel: 0 },
  { id: 'small_biz', name: 'Small Business Incubators', description: 'Increases Commercial revenue by 20%.', cost: 20000, category: 'Economy', prerequisiteId: 'prop_tax_hike', requiredMilestoneLevel: 1 },
  { id: 'startup_hubs', name: 'Innovation Hub Grants', description: 'Increases Commercial revenue by 15%.', cost: 35000, category: 'Economy', prerequisiteId: 'small_biz', requiredMilestoneLevel: 2 },
  { id: 'tourism', name: 'International Tourism Campaign', description: 'Boosts Commercial revenue by 30% and desirability +5%.', cost: 50000, category: 'Economy', prerequisiteId: 'startup_hubs', requiredMilestoneLevel: 3 },

  // Environment & Tech
  { id: 'recycling', name: 'Municipal Recycling Initiative', description: 'Reduces overall maintenance expenses by 5%.', cost: 15000, category: 'Environment', requiredMilestoneLevel: 2 },
  { id: 'green_roofs', name: 'Urban Green Roof Initiative', description: 'Reduces pollution and city maintenance expenses by 5%.', cost: 20000, category: 'Environment', prerequisiteId: 'recycling', requiredMilestoneLevel: 3 },
  { id: 'ai_management', name: 'AI City Management System', description: 'Reduces overall city maintenance expenses by 20%.', cost: 100000, category: 'Environment', prerequisiteId: 'green_roofs', requiredMilestoneLevel: 4 },
  { id: 'megacity_protocol', name: 'Megacity Growth Protocol', description: 'Unlocks ultimate metropolis synergy: +20% all tax revenues.', cost: 250000, category: 'Environment', prerequisiteId: 'ai_management', requiredMilestoneLevel: 5 },
];

// Dynamic Events
export interface ActiveEvent {
  id: string;
  type: 'boom' | 'recession' | 'heatwave' | 'power_shortage' | 'traffic_crisis' | 'industrial_boom' | 'disease';
  name: string;
  description: string;
  remainingDays: number;
}

export const EVENT_PROTOTYPES = [
  {
    type: 'boom',
    name: 'Population Boom',
    description: 'Immigrants flooding into the district! Residential demand +40%, Desirability +20%.',
  },
  {
    type: 'recession',
    name: 'Economic Recession',
    description: 'Global economic downturn! Tax revenue -25%, Commercial & Industrial demand -30%.',
  },
  {
    type: 'heatwave',
    name: 'Summer Heatwave',
    description: 'Severe weather spike! Power grid and water utility demand +50%.',
  },
  {
    type: 'power_shortage',
    name: 'Transformer Failure',
    description: 'Main substation fault! Power capacity temporarily reduced by 30%.',
  },
  {
    type: 'traffic_crisis',
    name: 'Road Gridlock Crisis',
    description: 'Major logistics backup! Traffic congestion +35%, average commute times spike.',
  },
  {
    type: 'industrial_boom',
    name: 'Industrial Tech Surge',
    description: 'High demand for manufactured goods! Industrial income +30%, but pollution +20%.',
  },
  {
    type: 'disease',
    name: 'Seasonal Flu Outbreak',
    description: 'Health emergency! Public health index -20% and productivity dips.',
  },
];

// Missions / Objectives
export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardMoney: number;
  check: (state: CityState) => boolean;
}

export const MISSIONS: Mission[] = [
  {
    id: 'm_pop_50',
    title: 'First Settlement',
    description: 'Reach a total city population of 50 residents.',
    rewardMoney: 5000,
    check: (s) => s.population >= 50,
  },
  {
    id: 'm_cashflow',
    title: 'Solvent Budget',
    description: 'Achieve a positive net daily cashflow (Income > Expenses).',
    rewardMoney: 8000,
    check: (s) => s.income > s.expenses && s.income > 0,
  },
  {
    id: 'm_pop_200',
    title: 'Town Expansion',
    description: 'Reach a population of 200 citizens.',
    rewardMoney: 15000,
    check: (s) => s.population >= 200,
  },
  {
    id: 'm_low_unemp',
    title: 'Full Employment',
    description: 'Maintain unemployment below 8% with a population of at least 100.',
    rewardMoney: 12000,
    check: (s) => s.population >= 100 && s.unemploymentRate < 8,
  },
  {
    id: 'm_pop_1000',
    title: 'Thriving City',
    description: 'Reach a total population of 1,000 residents.',
    rewardMoney: 50000,
    check: (s) => s.population >= 1000,
  },
  {
    id: 'm_happy_citizens',
    title: 'Civic Bliss',
    description: 'Achieve an overall city happiness index of at least 75%.',
    rewardMoney: 25000,
    check: (s) => s.happiness >= 75 && s.population >= 150,
  },
];

// Achievements
export interface Achievement {
  id: string;
  title: string;
  description: string;
  check: (state: CityState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_first_road',
    title: 'Civil Engineer',
    description: 'Build your city infrastructure.',
    check: (s) => s.grid.some((r) => r.some((t) => t.type === TileType.ROAD)),
  },
  {
    id: 'ach_town',
    title: 'Town Milestone',
    description: 'Promote your settlement to Town status.',
    check: (s) => s.milestoneLevel >= 1,
  },
  {
    id: 'ach_city',
    title: 'City Status',
    description: 'Promote your municipality to City status.',
    check: (s) => s.milestoneLevel >= 2,
  },
  {
    id: 'ach_treasury',
    title: 'Municipal Tycoon',
    description: 'Accumulate $100,000 in your city treasury.',
    check: (s) => s.money >= 100000,
  },
  {
    id: 'ach_megacity',
    title: 'Megacity Visionary',
    description: 'Reach the ultimate Megacity milestone level.',
    check: (s) => s.milestoneLevel >= 5,
  },
];
