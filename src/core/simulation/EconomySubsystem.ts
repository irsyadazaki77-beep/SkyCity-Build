import { TileData, TileType, ActiveEvent } from '../../types';
import { GAME_CONFIG } from '../../config';

export interface EconomyResult {
  income: number;
  expenses: number;
  residentialTax: number;
  commercialTax: number;
  industrialTax: number;
  roadMaint: number;
  serviceMaint: number;
  buildingMaint: number;
  netIncome: number;
}

export class EconomySubsystem {
  public calculateEconomy(
    grid: TileData[][],
    totalPop: number,
    employedCitizens: number,
    totalNominalJobs: number,
    workers: number,
    unlockedUpgrades: string[],
    resTax: number,
    comTax: number,
    indTax: number,
    activePolicies: string[] = [],
    activeEvents: ActiveEvent[] = []
  ): EconomyResult {
    const height = grid.length;
    const width = grid[0]?.length || 0;
    const hasU = (id: string) => unlockedUpgrades.includes(id);

    // 1. Tax Revenue calculation
    let resTaxPerCapita = 4.5 * (resTax / GAME_CONFIG.DEFAULT_TAX_RATE);
    if (hasU('prop_tax_hike')) resTaxPerCapita *= 1.25;
    if (hasU('wealth_tax')) resTaxPerCapita *= 1.15;
    const residentialTax = Math.round(totalPop * resTaxPerCapita);

    let comTaxPerJob = 8.0 * (comTax / GAME_CONFIG.DEFAULT_TAX_RATE);
    if (hasU('digital_econ')) comTaxPerJob *= 1.2;
    if (hasU('tourism')) comTaxPerJob *= 1.15;
    const commercialTax = Math.round(employedCitizens * 0.55 * comTaxPerJob);

    let indTaxPerJob = 10.0 * (indTax / GAME_CONFIG.DEFAULT_TAX_RATE);
    if (hasU('heavy_industry')) indTaxPerJob *= 1.3;
    if (hasU('automation')) indTaxPerJob *= 1.2;
    const industrialTax = Math.round(employedCitizens * 0.45 * indTaxPerJob);

    let totalIncome = residentialTax + commercialTax + industrialTax;

    // Apply active events on income
    for (const ev of activeEvents) {
      if (ev.type === 'boom') totalIncome = Math.round(totalIncome * 1.3);
      else if (ev.type === 'recession') totalIncome = Math.round(totalIncome * 0.75);
    }

    // 2. Expenditures calculation
    let roadMaint = 0;
    let serviceMaint = 0;
    let buildingMaint = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        switch (tile.type) {
          case TileType.ROAD:
            roadMaint += GAME_CONFIG.MAINTENANCE_COSTS.ROAD;
            break;
          case TileType.POWER_PLANT:
            buildingMaint += GAME_CONFIG.MAINTENANCE_COSTS.POWER_PLANT;
            break;
          case TileType.WATER_PUMP:
            buildingMaint += GAME_CONFIG.MAINTENANCE_COSTS.WATER_PUMP;
            break;
          case TileType.FIRE_STATION:
            serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.FIRE_STATION;
            break;
          case TileType.POLICE_STATION:
            serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.POLICE_STATION;
            break;
          case TileType.CLINIC:
            serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.CLINIC;
            break;
          case TileType.SCHOOL:
            serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.SCHOOL;
            break;
          case TileType.WASTE_MANAGEMENT:
            serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.WASTE_MANAGEMENT;
            break;
          case TileType.PARK:
            serviceMaint += GAME_CONFIG.MAINTENANCE_COSTS.PARK;
            break;
        }
      }
    }

    if (hasU('smart_grid')) buildingMaint = Math.round(buildingMaint * 0.85);
    if (activePolicies.includes('FREE_TRANSIT')) serviceMaint += Math.round(totalPop * 0.8);
    if (activePolicies.includes('GREEN_SUBSIDY')) buildingMaint += Math.round(buildingMaint * 0.15);

    const totalExpenses = roadMaint + serviceMaint + buildingMaint;

    return {
      income: totalIncome,
      expenses: totalExpenses,
      residentialTax,
      commercialTax,
      industrialTax,
      roadMaint,
      serviceMaint,
      buildingMaint,
      netIncome: totalIncome - totalExpenses,
    };
  }
}
