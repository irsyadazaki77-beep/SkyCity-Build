export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'Infrastructure' | 'Utilities' | 'Zoning' | 'Economy' | 'Environment';
}

export const UPGRADES: Upgrade[] = [
  { id: 'asphalt_roads', name: 'Asphalt Roads', description: 'Smoother roads reduce traffic buildup slightly.', cost: 5000, category: 'Infrastructure' },
  { id: 'smart_lights', name: 'Smart Traffic Lights', description: 'Optimized signals reduce traffic by 10%.', cost: 10000, category: 'Infrastructure' },
  { id: 'bike_lanes', name: 'Bike Lanes', description: 'Promotes cycling, reducing traffic by 10%.', cost: 12000, category: 'Infrastructure' },
  { id: 'bus_network', name: 'Bus Network', description: 'Public transit reduces traffic by 20%.', cost: 25000, category: 'Infrastructure' },
  { id: 'tram_system', name: 'Tram System', description: 'High-capacity transit reduces traffic by 30%.', cost: 50000, category: 'Infrastructure' },
  { id: 'highway_conn', name: 'Highway Connections', description: 'Boosts Industrial income by 15%.', cost: 30000, category: 'Infrastructure' },
  
  { id: 'water_meters', name: 'Water Meters', description: 'Reduces city water demand by 10%.', cost: 12000, category: 'Utilities' },
  { id: 'high_cap_pipes', name: 'High-Capacity Pipes', description: 'Water capacity +20%.', cost: 15000, category: 'Utilities' },
  { id: 'smart_grid', name: 'Smart Power Grid', description: 'Power capacity +20%.', cost: 15000, category: 'Utilities' },
  { id: 'solar_subsidies', name: 'Solar Subsidies', description: 'Reduces city power demand by 10%.', cost: 20000, category: 'Utilities' },
  { id: 'deep_pumps', name: 'Deep Water Pumps', description: 'Water pumps output +50%.', cost: 35000, category: 'Utilities' },
  { id: 'adv_turbines', name: 'Advanced Turbines', description: 'Power plants output +50%, maintenance +10%.', cost: 40000, category: 'Utilities' },
  
  { id: 'mixed_use', name: 'Mixed-Use Zoning', description: 'Boosts Commercial income by 10%.', cost: 25000, category: 'Zoning' },
  { id: 'high_dens_res', name: 'High-Density Res.', description: 'Doubles max population per residential tile.', cost: 30000, category: 'Zoning' },
  { id: 'high_dens_com', name: 'High-Density Com.', description: 'Doubles max jobs per commercial tile.', cost: 30000, category: 'Zoning' },
  { id: 'high_dens_ind', name: 'High-Density Ind.', description: 'Doubles max jobs per industrial tile.', cost: 30000, category: 'Zoning' },
  { id: 'urban_planning', name: 'Urban Planning', description: 'Reduces overall maintenance by 10%.', cost: 40000, category: 'Zoning' },
  { id: 'sky_permits', name: 'Skyscraper Permits', description: 'Doubles population and jobs limits again.', cost: 80000, category: 'Zoning' },
  
  { id: 'prop_tax_hike', name: 'Property Tax Hike', description: 'Residential income +20%.', cost: 5000, category: 'Economy' },
  { id: 'wealth_tax', name: 'Wealth Tax', description: 'Residential income +15%.', cost: 10000, category: 'Economy' },
  { id: 'small_biz', name: 'Small Business Grants', description: 'Commercial income +20%.', cost: 20000, category: 'Economy' },
  { id: 'corp_subsidies', name: 'Corporate Subsidies', description: 'Industrial income +20%.', cost: 25000, category: 'Economy' },
  { id: 'startup_hubs', name: 'Startup Hubs', description: 'Commercial income +15%.', cost: 35000, category: 'Economy' },
  { id: 'tourism', name: 'Tourism Campaign', description: 'Commercial income +30%.', cost: 50000, category: 'Economy' },
  { id: 'auto_logistics', name: 'Automated Logistics', description: 'Industrial income +30%.', cost: 60000, category: 'Economy' },
  
  { id: 'recycling', name: 'Recycling Mandate', description: 'Reduces overall maintenance by 5%.', cost: 15000, category: 'Environment' },
  { id: 'green_roofs', name: 'Green Roofs', description: 'Reduces overall maintenance by 5%.', cost: 20000, category: 'Environment' },
  { id: 'smart_sensors', name: 'Smart City Sensors', description: 'Power & Water capacity +10%.', cost: 45000, category: 'Environment' },
  { id: 'ai_management', name: 'AI City Management', description: 'Reduces overall maintenance by 20%.', cost: 100000, category: 'Environment' },
  { id: 'megacity', name: 'Megacity Protocol', description: 'Unlocks ultimate growth, +20% all income.', cost: 250000, category: 'Environment' }
];
