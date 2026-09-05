import React from 'react';
import { X, ArrowUpCircle, Zap, Droplet, Smile, Users, Briefcase, Car, AlertTriangle, Hammer, XCircle } from 'lucide-react';
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

  return (
    <div className="absolute top-20 right-4 w-72 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col pointer-events-auto z-40 animate-in slide-in-from-right-4 duration-300">
      
      {/* Header */}
      <div className="flex items-start justify-between p-3 border-b border-white/10 bg-black/20">
        <div>
          <h2 className="text-white font-bold text-base leading-tight">{getTypeName(tile.type)}</h2>
          {isZoned && <p className="text-xs text-gray-400 mt-0.5">Level {tile.level}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      {/* Issues / Alerts */}
      {(tile.abandoned || !tile.powered || !tile.watered) && tile.type !== TileType.ROAD && tile.type !== TileType.EMPTY && (
        <div className="p-3 bg-red-950/40 border-b border-red-500/20 space-y-1">
          {tile.abandoned && <Alert text="Building is abandoned" />}
          {!tile.powered && <Alert text="No electricity" />}
          {!tile.watered && <Alert text="No water supply" />}
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4">
        
        {/* Zoned Building Stats */}
        {isZoned && (
          <div className="grid grid-cols-2 gap-3">
            {tile.type === TileType.RESIDENTIAL ? (
              <Stat icon={<Users size={16} className="text-emerald-400" />} label="Residents" value={tile.population || 0} />
            ) : (
              <Stat icon={<Briefcase size={16} className="text-blue-400" />} label="Workers" value={tile.jobs || 0} />
            )}
            
            <Stat icon={<Smile size={16} className={!tile.abandoned ? "text-yellow-400" : "text-gray-500"} />} label="Happiness" value={tile.abandoned ? 'N/A' : 'High'} />
          </div>
        )}

        {/* Road Stats */}
        {tile.type === TileType.ROAD && (
          <div className="space-y-3">
            <Stat icon={<Car size={16} className="text-orange-400" />} label="Traffic Flow" value={`${Math.max(0, 100 - (tile.traffic || 0))}%`} />
          </div>
        )}

        {/* Utility / Service Stats (Placeholder for efficiency) */}
        {!isZoned && tile.type !== TileType.ROAD && tile.type !== TileType.EMPTY && (
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Zap size={16} className="text-yellow-400" />} label="Efficiency" value={`${Math.round((tile.productivity || 1) * 100)}%`} />
          </div>
        )}
        
      </div>
      
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
