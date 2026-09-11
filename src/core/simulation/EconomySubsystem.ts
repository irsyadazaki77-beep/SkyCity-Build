import { TileData, TileType, ActiveEvent, ServiceBudgets, CityLoan } from '../../types';
import { GAME_CONFIG } from '../../config';

export interface TaxEfficiencyBreakdown {
  residential: number; // 0 to 100% compliance/efficiency
  commercial: number;
  industrial: number;
}

export interface EconomyResult {
  income: number;
  expenses: number;
  residentialTax: number;
  commercialTax: number;
  industrialTax: number;
  roadMaint: number;
  powerMaint: number;
  waterMaint: number;
  policeMaint: number;
  fireMaint: number;
  healthMaint: number;
  educationMaint: number;
  wasteMaint: number;
  parksMaint: number;
  serviceMaint: number;   // Backward-compatibility aggregate
  buildingMaint: number;  // Backward-compatibility aggregate
  loanRepayments: number;
  deficitPenalty: number;
  policyExpenses: number;
  netIncome: number;
  taxEfficiency: TaxEfficiencyBreakdown;
}

export interface CalculateEconomyOptions {
  serviceBudgets?: ServiceBudgets;
  cityLoans?: CityLoan[];
  currentMoney?: number;
  activePolicies?: string[];
  activeEvents?: ActiveEvent[];
  isFiscalCrisis?: boolean;
  strikingSectors?: string[];
  trafficAverage?: number;
  powerDemand?: number;
  powerCapacity?: number;
  waterDemand?: number;
  waterCapacity?: number;
  wasteProduction?: number;
  wasteCapacity?: number;
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
    activePoliciesOrOptions?: string[] | CalculateEconomyOptions,
    legacyEvents?: ActiveEvent[]
  ): EconomyResult {
    // Normalizing options to support both legacy and rich new signatures
    let options: CalculateEconomyOptions = {};
    if (Array.isArray(activePoliciesOrOptions)) {
      options = {
        activePolicies: activePoliciesOrOptions,
        activeEvents: legacyEvents || [],
      };
    } else if (activePoliciesOrOptions && typeof activePoliciesOrOptions === 'object') {
      options = activePoliciesOrOptions;
    }

    const height = grid.length;
    const width = grid[0]?.length || 0;
    const hasU = (id: string) => unlockedUpgrades.includes(id);

    const budgets: ServiceBudgets = {
      roads: options.serviceBudgets?.roads ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.roads,
      power: options.serviceBudgets?.power ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.power,
      water: options.serviceBudgets?.water ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.water,
      police: options.serviceBudgets?.police ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.police,
      fire: options.serviceBudgets?.fire ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.fire,
      health: options.serviceBudgets?.health ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.health,
      education: options.serviceBudgets?.education ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.education,
      waste: options.serviceBudgets?.waste ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.waste,
      parks: options.serviceBudgets?.parks ?? GAME_CONFIG.DEFAULT_SERVICE_BUDGETS.parks,
    };

    const activePolicies = options.activePolicies || [];
    const activeEvents = options.activeEvents || [];
    const cityLoans = options.cityLoans || [];
    const currentMoney = options.currentMoney ?? 0;
    const isCrisis = options.isFiscalCrisis ?? false;
    const striking = new Set(options.strikingSectors || []);

    const RES_TIER_MULT = [0, 1.0, 1.4, 2.0, 3.0, 4.5];
    const COM_TIER_MULT = [0, 1.0, 1.5, 2.2, 3.4, 5.0];
    const IND_TIER_MULT = [0, 1.0, 1.4, 2.0, 3.2, 5.0];

    let baseResTaxTotal = 0;
    let baseComTaxTotal = 0;
    let baseIndTaxTotal = 0;

    let roadTilesCount = 0;
    let powerPlantsCount = 0;
    let waterPumpsCount = 0;
    let fireStationsCount = 0;
    let policeStationsCount = 0;
    let clinicsCount = 0;
    let schoolsCount = 0;
    let wasteFacilitiesCount = 0;
    let parksCount = 0;

    const employmentRatio = workers > 0 ? Math.min(1, employedCitizens / workers) : 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];

        // 1. Zone Tax Collections
        if (tile.type === TileType.RESIDENTIAL && !tile.abandoned && tile.population > 0) {
          const lvl = Math.min(5, Math.max(1, tile.level || 1));
          const mult = RES_TIER_MULT[lvl] || 1.0;
          const pop = tile.population;
          const employedOnTile = pop * employmentRatio;
          const unemployedOnTile = pop - employedOnTile;
          const commuteTime = tile.commuteTime || 0;
          const commuteFactor = commuteTime > 12 ? 0.82 : (commuteTime > 6 ? 0.92 : 1.0);
          const healthFactor = 0.6 + 0.4 * ((tile.health !== undefined ? tile.health : 50) / 100);
          const eduFactor = 0.8 + 0.4 * ((tile.education !== undefined ? tile.education : 30) / 100);
          const taxUnit = (employedOnTile * 4.5 * commuteFactor * healthFactor * eduFactor + unemployedOnTile * 1.5) * mult;
          baseResTaxTotal += taxUnit;
        } else if (tile.type === TileType.COMMERCIAL && !tile.abandoned && tile.jobs > 0) {
          const lvl = Math.min(5, Math.max(1, tile.level || 1));
          const mult = COM_TIER_MULT[lvl] || 1.0;
          const activeJobs = Math.min(tile.jobs, Math.ceil(tile.jobs * employmentRatio));
          const prodFactor = (tile.productivity !== undefined ? tile.productivity : 100) / 100;
          const goodsFactor = 0.35 + 0.65 * ((tile.goodsStock !== undefined ? tile.goodsStock : 80) / 100);
          baseComTaxTotal += activeJobs * 7.5 * mult * prodFactor * goodsFactor;
        } else if (tile.type === TileType.INDUSTRIAL && !tile.abandoned && tile.jobs > 0) {
          const lvl = Math.min(5, Math.max(1, tile.level || 1));
          const mult = IND_TIER_MULT[lvl] || 1.0;
          const activeJobs = Math.min(tile.jobs, Math.ceil(tile.jobs * employmentRatio));
          const prodFactor = (tile.productivity !== undefined ? tile.productivity : 100) / 100;
          const logisticsFactor = 0.45 + 0.55 * ((tile.logisticsSatisfaction !== undefined ? tile.logisticsSatisfaction : 80) / 100);
          baseIndTaxTotal += activeJobs * 8.5 * mult * prodFactor * logisticsFactor;
        }

        // 2. Count Municipal Infrastructure & Services
        switch (tile.type) {
          case TileType.ROAD:
            roadTilesCount++;
            break;
          case TileType.POWER_PLANT:
            powerPlantsCount++;
            break;
          case TileType.WATER_PUMP:
            waterPumpsCount++;
            break;
          case TileType.FIRE_STATION:
            fireStationsCount++;
            break;
          case TileType.POLICE_STATION:
            policeStationsCount++;
            break;
          case TileType.CLINIC:
            clinicsCount++;
            break;
          case TileType.SCHOOL:
            schoolsCount++;
            break;
          case TileType.WASTE_MANAGEMENT:
            wasteFacilitiesCount++;
            break;
          case TileType.PARK:
            parksCount++;
            break;
        }
      }
    }

    // -------------------------------------------------------------
    // Tax Elasticity, Laffer Curve & Compliance Modeling
    // -------------------------------------------------------------
    // Optimal tax rate is 9%.
    // Rates < 9% yield high compliance & high citizen morale.
    // Rates > 10% begin showing tax friction.
    // Rates > 14% suffer progressive tax evasion and informal grey economy.
    const calculateTaxCompliance = (rate: number): number => {
      if (rate <= 9) return 1.0;
      if (rate <= 13) return Math.max(0.65, 1.0 - (rate - 9) * 0.025);
      if (rate <= 17) return Math.max(0.45, 0.90 - (rate - 13) * 0.055);
      return Math.max(0.30, 0.68 - (rate - 17) * 0.08);
    };

    const resCompliance = calculateTaxCompliance(resTax);
    const comCompliance = calculateTaxCompliance(comTax);
    const indCompliance = calculateTaxCompliance(indTax);

    let resTaxRateFactor = (resTax / GAME_CONFIG.DEFAULT_TAX_RATE) * resCompliance;
    if (hasU('prop_tax_hike')) resTaxRateFactor *= 1.25;
    if (hasU('wealth_tax')) resTaxRateFactor *= 1.15;

    let comTaxRateFactor = (comTax / GAME_CONFIG.DEFAULT_TAX_RATE) * comCompliance;
    if (hasU('digital_econ')) comTaxRateFactor *= 1.2;
    if (hasU('tourism')) comTaxRateFactor *= 1.15;

    let indTaxRateFactor = (indTax / GAME_CONFIG.DEFAULT_TAX_RATE) * indCompliance;
    if (hasU('heavy_industry')) indTaxRateFactor *= 1.3;
    if (hasU('automation')) indTaxRateFactor *= 1.2;

    // Crisis penalty: widespread tax strikes / economic disruption
    if (isCrisis) {
      resTaxRateFactor *= (1 - GAME_CONFIG.CRISIS_TAX_EVASION_PENALTY);
      comTaxRateFactor *= (1 - GAME_CONFIG.CRISIS_TAX_EVASION_PENALTY);
      indTaxRateFactor *= (1 - GAME_CONFIG.CRISIS_TAX_EVASION_PENALTY);
    }

    const residentialTax = Math.round(baseResTaxTotal * resTaxRateFactor);
    const commercialTax = Math.round(baseComTaxTotal * comTaxRateFactor);
    const industrialTax = Math.round(baseIndTaxTotal * indTaxRateFactor);

    let totalIncome = residentialTax + commercialTax + industrialTax;

    for (const ev of activeEvents) {
      if (ev.type === 'boom') totalIncome = Math.round(totalIncome * 1.3);
      else if (ev.type === 'recession') totalIncome = Math.round(totalIncome * 0.75);
    }

    // -------------------------------------------------------------
    // Departmental Maintenance & Operational Costs
    // -------------------------------------------------------------
    // 1. Road Maintenance: Base + Traffic Load Wear & Tear scaled by budget
    const trafficLoadFactor = (options.trafficAverage ?? 20) / 100;
    const roadWearCost = roadTilesCount * trafficLoadFactor * 0.5;
    const roadMaint = Math.round(
      (roadTilesCount * GAME_CONFIG.MAINTENANCE_COSTS.ROAD + roadWearCost) * (budgets.roads / 100)
    );

    // 2. Power Utility: Base plant upkeep + variable grid load cost scaled by budget
    const powerLoadFactor = Math.min(1.5, (options.powerDemand ?? 50) / Math.max(1, options.powerCapacity ?? 50));
    const powerVariableCost = powerPlantsCount * 8 * powerLoadFactor;
    let rawPowerMaint = (powerPlantsCount * GAME_CONFIG.MAINTENANCE_COSTS.POWER_PLANT + powerVariableCost) * (budgets.power / 100);
    if (hasU('smart_grid')) rawPowerMaint *= 0.85;
    const powerMaint = Math.round(rawPowerMaint);

    // 3. Water Utility: Base pump upkeep + variable flow load cost scaled by budget
    const waterLoadFactor = Math.min(1.5, (options.waterDemand ?? 50) / Math.max(1, options.waterCapacity ?? 50));
    const waterVariableCost = waterPumpsCount * 6 * waterLoadFactor;
    const waterMaint = Math.round(
      (waterPumpsCount * GAME_CONFIG.MAINTENANCE_COSTS.WATER_PUMP + waterVariableCost) * (budgets.water / 100)
    );

    // 4. Police Department
    const policeMaint = Math.round(
      policeStationsCount * GAME_CONFIG.MAINTENANCE_COSTS.POLICE_STATION * (budgets.police / 100)
    );

    // 5. Fire Department
    const fireMaint = Math.round(
      fireStationsCount * GAME_CONFIG.MAINTENANCE_COSTS.FIRE_STATION * (budgets.fire / 100)
    );

    // 6. Healthcare
    const healthMaint = Math.round(
      clinicsCount * GAME_CONFIG.MAINTENANCE_COSTS.CLINIC * (budgets.health / 100)
    );

    // 7. Education
    const educationMaint = Math.round(
      schoolsCount * GAME_CONFIG.MAINTENANCE_COSTS.SCHOOL * (budgets.education / 100)
    );

    // 8. Waste Management: Base + variable processing volume cost
    const wasteLoadFactor = Math.min(1.5, (options.wasteProduction ?? 50) / Math.max(1, options.wasteCapacity ?? 50));
    const wasteVariableCost = wasteFacilitiesCount * 10 * wasteLoadFactor;
    const wasteMaint = Math.round(
      (wasteFacilitiesCount * GAME_CONFIG.MAINTENANCE_COSTS.WASTE_MANAGEMENT + wasteVariableCost) * (budgets.waste / 100)
    );

    // 9. Parks & Recreation
    const parksMaint = Math.round(
      parksCount * GAME_CONFIG.MAINTENANCE_COSTS.PARK * (budgets.parks / 100)
    );

    // -------------------------------------------------------------
    // Debt Service & Deficit Overdraft Penalties
    // -------------------------------------------------------------
    let loanRepayments = 0;
    for (const loan of cityLoans) {
      if (loan.remainingDays > 0) {
        loanRepayments += loan.dailyPayment;
      }
    }
    loanRepayments = Math.round(loanRepayments);

    // Overdraft Fee on negative treasury
    let deficitPenalty = 0;
    if (currentMoney < 0) {
      deficitPenalty = Math.round(Math.abs(currentMoney) * GAME_CONFIG.DEFICIT_PENALTY_DAILY_RATE);
    }

    // Policy operational costs
    let policyExpenses = 0;
    if (activePolicies.includes('FREE_TRANSIT')) policyExpenses += Math.round(totalPop * 0.8);
    if (activePolicies.includes('GREEN_SUBSIDY')) policyExpenses += Math.round((powerMaint + waterMaint) * 0.15);

    // Backward-compatibility aggregate metrics
    const serviceMaint = fireMaint + policeMaint + healthMaint + educationMaint + wasteMaint + parksMaint + policyExpenses;
    const buildingMaint = powerMaint + waterMaint;

    const totalExpenses =
      roadMaint +
      powerMaint +
      waterMaint +
      policeMaint +
      fireMaint +
      healthMaint +
      educationMaint +
      wasteMaint +
      parksMaint +
      policyExpenses +
      loanRepayments +
      deficitPenalty;

    return {
      income: totalIncome,
      expenses: totalExpenses,
      residentialTax,
      commercialTax,
      industrialTax,
      roadMaint,
      powerMaint,
      waterMaint,
      policeMaint,
      fireMaint,
      healthMaint,
      educationMaint,
      wasteMaint,
      parksMaint,
      serviceMaint,
      buildingMaint,
      loanRepayments,
      deficitPenalty,
      policyExpenses,
      netIncome: totalIncome - totalExpenses,
      taxEfficiency: {
        residential: Math.round(resCompliance * 100),
        commercial: Math.round(comCompliance * 100),
        industrial: Math.round(indCompliance * 100),
      },
    };
  }
}
