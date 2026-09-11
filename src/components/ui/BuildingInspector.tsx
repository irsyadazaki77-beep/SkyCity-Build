import React from 'react';
import { X, ArrowUpCircle, Zap, Droplet, Smile, Users, Briefcase, Car, AlertTriangle, Shield, Flame, HeartPulse, GraduationCap, Trash2, TrendingUp } from 'lucide-react';
import { TileData, TileType } from '../../types';

interface BuildingInspectorProps {
  tile: TileData;
  onClose: () => void;
}

export function BuildingInspector({ tile, onClose }: BuildingInspectorProps) {
  const getTypeName = (type: TileType) => {
    switch (type) {
      case TileType.RESIDENTIAL: return 'Residential Zone';
      case TileType.COMMERCIAL: return 'Commercial Zone';
      case TileType.INDUSTRIAL: return 'Industrial Zone';
      case TileType.POWER_PLANT: return 'Coal Power Plant';
      case TileType.WATER_PUMP: return 'Water Pumping Station';
      case TileType.FIRE_STATION: return 'Fire Station';
      case TileType.POLICE_STATION: return 'Police Headquarters';
      case TileType.CLINIC: return 'Medical Clinic';
      case TileType.SCHOOL: return 'Elementary School';
      case TileType.PARK: return 'City Park';
      case TileType.ROAD: return 'Road';
      case TileType.WASTE_MANAGEMENT: return 'Waste Management';
      default: return 'Empty Land';
    }
  };

  const isZoned = [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL].includes(tile.type);
  const currentLvl = tile.level || 1;
  const upgradeProgress = Math.max(0, Math.min(100, tile.upgradeProgress || 0));

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:bottom-auto sm:top-20 left-3 right-3 sm:left-auto sm:right-4 w-auto sm:w-80 max-w-sm mx-auto sm:mx-0 max-h-[55vh] sm:max-h-[80vh] overflow-y-auto custom-scrollbar bg-[#0f172a]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl flex flex-col pointer-events-auto z-35 animate-in slide-in-from-bottom-3 sm:slide-in-from-right-4 duration-200">
      
      {/* Header */}
      <div className="flex items-start justify-between p-3.5 border-b border-white/10 bg-black/20 sticky top-0 z-10 backdrop-blur-md">
        <div>
          <h2 className="text-white font-bold text-sm sm:text-base leading-tight">{getTypeName(tile.type)}</h2>
          {isZoned && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-semibold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-500/30">
                Tier {currentLvl} / 5
              </span>
              {tile.abandoned && (
                <span className="text-[10px] font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/30">
                  Abandoned
                </span>
              )}
            </div>
          )}
        </div>
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Close Inspector"
        >
          <X size={16} />
        </button>
      </div>

      {/* Issues / Alerts */}
      {(tile.abandoned || !tile.powered || !tile.watered) && tile.type !== TileType.ROAD && tile.type !== TileType.EMPTY && (
        <div className="p-3 bg-red-950/40 border-b border-red-500/20 space-y-1">
          {tile.abandoned && <Alert text="Building is abandoned due to poor conditions" />}
          {!tile.powered && <Alert text="No electricity grid connection" />}
          {!tile.watered && <Alert text="No water supply connection" />}
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4">
        
        {/* Upgrade Progress for Zoned Buildings */}
        {isZoned && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium flex items-center gap-1.5">
                <TrendingUp size={14} className="text-sky-400" />
                Evolution to Tier {Math.min(5, currentLvl + 1)}
              </span>
              <span className="text-white font-bold">{currentLvl >= 5 ? 'MAX' : `${upgradeProgress}%`}</span>
            </div>
            {currentLvl < 5 && (
              <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${upgradeProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Zoned Building Stats */}
        {isZoned && (
          <div className="grid grid-cols-2 gap-3">
            {tile.type === TileType.RESIDENTIAL ? (
              <Stat icon={<Users size={16} className="text-emerald-400" />} label="Residents" value={tile.population || 0} />
            ) : (
              <Stat icon={<Briefcase size={16} className="text-blue-400" />} label="Jobs Filled" value={tile.jobs || 0} />
            )}
            
            <Stat icon={<Smile size={16} className={!tile.abandoned ? "text-yellow-400" : "text-gray-500"} />} label="Land Value" value={`$${Math.round(tile.landValue ?? 35)}/m²`} />
          </div>
        )}

        {/* Environmental Indicators */}
        {isZoned && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/10">
            <div className="flex items-center justify-between p-2 rounded-lg bg-black/20">
              <span className="text-gray-400">Pollution:</span>
              <span className={`font-semibold ${(tile.pollution ?? 0) > 40 ? 'text-red-400' : 'text-emerald-400'}`}>
                {Math.round(tile.pollution ?? 0)}%
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-black/20">
              <span className="text-gray-400">Crime Risk:</span>
              <span className={`font-semibold ${(tile.crime ?? 30) > 40 ? 'text-red-400' : 'text-emerald-400'}`}>
                {Math.round(tile.crime ?? 30)}%
              </span>
            </div>
          </div>
        )}

        {/* Services Coverage Chips */}
        {isZoned && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Service Coverage</span>
            <div className="grid grid-cols-3 gap-1.5">
              <ServiceChip label="Power" active={!!tile.powered} icon={<Zap size={11} />} />
              <ServiceChip label="Water" active={!!tile.watered} icon={<Droplet size={11} />} />
              <ServiceChip label="Police" active={!!tile.policeCovered} icon={<Shield size={11} />} />
              <ServiceChip label="Fire" active={!!tile.fireCovered} icon={<Flame size={11} />} />
              <ServiceChip label="Health" active={!!tile.healthCovered} icon={<HeartPulse size={11} />} />
              <ServiceChip label="School" active={!!tile.schoolCovered} icon={<GraduationCap size={11} />} />
            </div>
          </div>
        )}

        {/* Road Stats */}
        {tile.type === TileType.ROAD && (
          <div className="space-y-3">
            <Stat icon={<Car size={16} className="text-orange-400" />} label="Traffic Flow" value={`${Math.max(0, 100 - (tile.traffic || 0))}%`} />
          </div>
        )}

        {/* Utility / Service Stats */}
        {!isZoned && tile.type !== TileType.ROAD && tile.type !== TileType.EMPTY && (
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Zap size={16} className="text-yellow-400" />} label="Productivity" value={`${Math.round((tile.productivity || 1) * 100)}%`} />
            <Stat icon={<Smile size={16} className="text-emerald-400" />} label="Status" value={tile.powered && tile.watered ? 'Operational' : 'Unserviced'} />
          </div>
        )}
        
      </div>
      
    </div>
  );
}

function ServiceChip({ label, active, icon }: { label: string; active: boolean; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-medium border ${
      active 
        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
        : 'bg-white/5 border-white/5 text-gray-500'
    }`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <span className="text-white text-sm font-semibold pl-5">{value}</span>
    </div>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
      <AlertTriangle size={12} />
      <span>{text}</span>
    </div>
  );
}
