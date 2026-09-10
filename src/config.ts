export const GAME_CONFIG = {
  // Financial Defaults
  STARTING_MONEY: 8000,
  LOW_TREASURY_THRESHOLD: 1500,
  
  // RCI Demands Boundaries
  DEMAND_MIN: -100,
  DEMAND_MAX: 100,
  
  // Tax Balancing
  DEFAULT_TAX_RATE: 9,      // Default tax percentage (1% to 20%)
  TAX_OPTIMAL: 9,           // Tax rates below this boost demand, above this hurt demand
  TAX_Friction_MULT: 12,    // Scale factor for high tax demand penalties
  
  // Base Tax Revenue Coefficients (per citizen/job per tick at optimal 9% tax)
  BASE_RES_TAX_COEFF: 1.2,  // Tax earned per citizen
  BASE_COM_TAX_COEFF: 2.2,  // Tax earned per filled commercial job
  BASE_IND_TAX_COEFF: 2.8,  // Tax earned per filled industrial job
  
  // Build and Maintenance Costs
  BUILD_COSTS: {
    EMPTY: 0,
    ROAD: 25,
    RESIDENTIAL: 60,
    COMMERCIAL: 120,
    INDUSTRIAL: 120,
    POWER_PLANT: 800,
    WATER_PUMP: 500,
    FIRE_STATION: 600,
    POLICE_STATION: 550,
    CLINIC: 700,
    SCHOOL: 650,
    WASTE_MANAGEMENT: 800,
    PARK: 300,
  },
  
  MAINTENANCE_COSTS: {
    EMPTY: 0,
    ROAD: 2,
    RESIDENTIAL: 1,
    COMMERCIAL: 1,
    INDUSTRIAL: 2,
    POWER_PLANT: 45,
    WATER_PUMP: 30,
    FIRE_STATION: 35,
    POLICE_STATION: 30,
    CLINIC: 40,
    SCHOOL: 35,
    WASTE_MANAGEMENT: 45,
    PARK: 15,
  },

  // City Services Specifications
  CITY_SERVICES: {
    FIRE_STATION: {
      ROAD_RANGE: 12,     // Max road path distance
      CAPACITY: 150,      // Max citizens/buildings served
      BASE_SAFETY: 90,    // Base safety rating within coverage
    },
    POLICE_STATION: {
      ROAD_RANGE: 12,
      CAPACITY: 160,
      CRIME_REDUCTION: 85,
    },
    CLINIC: {
      ROAD_RANGE: 14,
      CAPACITY: 140,
      HEALTH_BOOST: 85,
    },
    SCHOOL: {
      ROAD_RANGE: 12,
      CAPACITY: 120,
      EDU_BOOST: 90,
    },
    WASTE_MANAGEMENT: {
      ROAD_RANGE: 16,
      CAPACITY: 250,      // Tons of waste processed
      PER_POP_WASTE: 0.8, // Waste units produced per citizen
      PER_IND_WASTE: 1.5, // Waste units produced per industrial job
    },
  },
  
  // Policy & Upgrades Monthly Maintenance Fees
  UPGRADE_MAINTENANCE: {
    // Utilities
    smart_grid: 15,
    adv_turbines: 25,
    high_cap_pipes: 15,
    deep_pumps: 20,
    smart_sensors: 10,
    
    // Services
    asphalt_roads: 10,
    smart_lights: 10,
    bus_network: 35,
    tram_system: 50,
    bike_lanes: 15,
    
    // Policies
    solar_subsidies: 20,
    water_meters: -5,  // reduces cost!
    green_roofs: 15,
    recycling: 25,
    ai_management: 40,
    tourism: 30,
    prop_tax_hike: 0,
    wealth_tax: 0,
    mixed_use: 10,
    small_biz: 10,
    startup_hubs: 25,
    highway_conn: 20,
    corp_subsidies: 40,
    auto_logistics: 35,
    sky_permits: 30,
    high_dens_res: 15,
    high_dens_com: 20,
    high_dens_ind: 20,
    megacity: 50,
  } as Record<string, number>,
  
  // Demographic Constants
  WORKING_AGE_RATIO: 0.65,
  CONSUMPTION_POWER_BASE: 100, // baseline purchasing power index
  
  // Growth Speed Coefficients
  GROWTH_RES_RATE: 0.15,
  GROWTH_COM_RATE: 0.15,
  GROWTH_IND_RATE: 0.15,

  // Traffic Engine 2.0 & Road Network Constants
  ROAD_NETWORK: {
    BASE_CAPACITY: 20,              // Base vehicle capacity per road tile
    ASPHALT_CAPACITY_BONUS: 15,     // Capacity boost from asphalt roads upgrade
    ASPHALT_SPEED_MULT: 0.8,        // Travel time multiplier on asphalt roads
    BASE_INTERSECTION_PENALTY: 0.6, // Congestion penalty at 3-way/4-way intersections
    SMART_LIGHTS_PENALTY: 0.12,     // Reduced intersection penalty with smart traffic lights
    BIKE_LANE_MAX_DIST: 7,          // Max distance where bike lanes absorb commute traffic
    BIKE_LANE_ABSORPTION: 0.35,     // 35% car traffic reduction on short trips with bike lanes
    BUS_NETWORK_REDUCTION: 0.25,    // 25% traffic volume reduction with municipal bus network
    TRAM_SYSTEM_REDUCTION: 0.35,    // 35% traffic volume reduction with light rail / tram network
  },
  
  REGION_UNLOCK_COST: 15000,
};
