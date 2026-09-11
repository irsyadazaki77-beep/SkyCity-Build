import React from 'react';
import { CityState, TileType, MAINTENANCE_COSTS } from '../types';
import { X, DollarSign, TrendingUp, TrendingDown, Percent, Landmark } from 'lucide-react';

interface TreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  setTaxRates: (res: number, com: number, ind: number) => void;
}

export function TreasuryModal({ isOpen, onClose, gameState, setTaxRates }: TreasuryModalProps) {
  if (!isOpen) return null;

  const {
    money,
    income,
    expenses,
    residentialTaxRate = 9,
    commercialTaxRate = 9,
    industrialTaxRate = 9,
    history = [],
    grid,
  } = gameState;

  const netCashflow = income - expenses;

  // Calculate detailed upkeep expenses per sector
  let roadUpkeep = 0;
  let powerUpkeep = 0;
  let waterUpkeep = 0;
  let serviceUpkeep = 0;

  const budgets = gameState.serviceBudgets || {
    roads: 100,
    power: 100,
    water: 100,
    police: 100,
    fire: 100,
    health: 100,
    education: 100,
    waste: 100,
    parks: 100,
  };

  grid.forEach((row) => {
    row.forEach((tile) => {
      const upkeep = MAINTENANCE_COSTS[tile.type] || 0;
      if (tile.type === TileType.ROAD) roadUpkeep += Math.round(upkeep * (budgets.roads / 100));
      else if (tile.type === TileType.POWER_PLANT) powerUpkeep += Math.round(upkeep * (budgets.power / 100));
      else if (tile.type === TileType.WATER_PUMP) waterUpkeep += Math.round(upkeep * (budgets.water / 100));
      else if (tile.type === TileType.FIRE_STATION) serviceUpkeep += Math.round(upkeep * (budgets.fire / 100));
      else if (tile.type === TileType.POLICE_STATION) serviceUpkeep += Math.round(upkeep * (budgets.police / 100));
      else if (tile.type === TileType.CLINIC) serviceUpkeep += Math.round(upkeep * (budgets.health / 100));
      else if (tile.type === TileType.SCHOOL) serviceUpkeep += Math.round(upkeep * (budgets.education / 100));
      else if (tile.type === TileType.WASTE_MANAGEMENT) serviceUpkeep += Math.round(upkeep * (budgets.waste / 100));
      else if (tile.type === TileType.PARK) serviceUpkeep += Math.round(upkeep * (budgets.parks / 100));
    });
  });

  if (gameState.dailyDebtService) {
    serviceUpkeep += gameState.dailyDebtService;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] px-[calc(env(safe-area-inset-left,0px)+0.75rem)] pr-[calc(env(safe-area-inset-right,0px)+0.75rem)] select-none animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl text-[#D4AF37]">
              <Landmark size={18} />
            </div>
            <div>
              <h2 className="font-serif italic text-sm sm:text-xl text-[#D4AF37]">City Treasury</h2>
              <p className="text-[8px] sm:text-[9px] text-gray-400 font-mono uppercase tracking-widest">
                Budget & Taxes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center"
            aria-label="Close Treasury"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3 sm:p-6 space-y-3 sm:space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Main Financial Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Total Treasury</span>
              <span className="font-mono text-xl sm:text-2xl font-bold text-white mt-1">
                ${money.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Tax Revenue / Day</span>
              <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingUp size={18} /> +${income.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Net Cashflow</span>
              <span
                className={`font-mono text-xl sm:text-2xl font-bold mt-1 flex items-center gap-1 ${
                  netCashflow >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {netCashflow >= 0 ? '+' : ''}${netCashflow.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Tax Sliders Section */}
          <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
            <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-[#D4AF37] flex items-center gap-2">
              <Percent size={14} /> Sector Tax Rates
            </h3>

            <div className="space-y-3">
              {/* Residential Tax */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold">Residential Tax</span>
                  <span>{residentialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={residentialTaxRate}
                  onChange={(e) =>
                    setTaxRates(Number(e.target.value), commercialTaxRate, industrialTaxRate)
                  }
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />
              </div>

              {/* Commercial Tax */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-blue-400 font-bold">Commercial Tax</span>
                  <span>{commercialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={commercialTaxRate}
                  onChange={(e) =>
                    setTaxRates(residentialTaxRate, Number(e.target.value), industrialTaxRate)
                  }
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />
              </div>

              {/* Industrial Tax */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold">Industrial Tax</span>
                  <span>{industrialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={industrialTaxRate}
                  onChange={(e) =>
                    setTaxRates(residentialTaxRate, commercialTaxRate, Number(e.target.value))
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Detailed Expense Breakdown */}
          <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-gray-300">
              City Operations Upkeep Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs font-mono">
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Road Infrastructure</span>
                <span className="text-red-300">-${roadUpkeep}</span>
              </div>
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Power Utilities</span>
                <span className="text-red-300">-${powerUpkeep}</span>
              </div>
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Water Network</span>
                <span className="text-red-300">-${waterUpkeep}</span>
              </div>
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Public Services & Parks</span>
                <span className="text-red-300">-${serviceUpkeep}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-black/40 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#D4AF37] text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl hover:bg-[#c29f2e] transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
