import React, { useState } from 'react';
import { 
  Home, 
  Briefcase, 
  Factory, 
  Zap, 
  Droplet, 
  MousePointer2, 
  Eraser,
  Flame,
  Shield,
  HeartPulse,
  GraduationCap,
  Trash2,
  Trees,
  Layers,
  Sparkles
} from 'lucide-react';
import { TileType, BUILD_COSTS } from '../types';

export type BuildCategory = 'ROADS' | 'ZONING' | 'UTILITIES' | 'SERVICES';

interface SidebarProps {
  activeTool: TileType | 'POINTER' | 'BULLDOZER';
  setActiveTool: (tool: TileType | 'POINTER' | 'BULLDOZER') => void;
}

export function Sidebar({ activeTool, setActiveTool }: SidebarProps) {
  const [category, setCategory] = useState<BuildCategory>('ZONING');

  return (
    <aside id="app-sidebar" className="w-28 bg-[#14161A] border-r border-white/5 flex flex-col items-center py-4 gap-2 z-20 overflow-y-auto select-none">
      {/* Category Picker Tabs */}
      <div className="w-full px-2 flex flex-col gap-1 mb-2">
        <div className="text-[8px] uppercase tracking-widest text-gray-500 font-mono text-center mb-1">
          Build Category
        </div>
        <div className="grid grid-cols-2 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setCategory('ROADS')}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'ROADS' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Roads
          </button>
          <button
            onClick={() => setCategory('ZONING')}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'ZONING' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Zoning
          </button>
          <button
            onClick={() => setCategory('UTILITIES')}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'UTILITIES' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Utilities
          </button>
          <button
            onClick={() => setCategory('SERVICES')}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'SERVICES' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Services
          </button>
        </div>
      </div>

      {/* General Tools */}
      <div className="w-full px-2 flex flex-col gap-1.5">
        <ToolButton 
          icon={<MousePointer2 size={18} />} 
          label="Select" 
          active={activeTool === 'POINTER'} 
          onClick={() => setActiveTool('POINTER')} 
        />
        <ToolButton 
          icon={<Eraser size={18} className="text-red-400" />} 
          label="Bulldoze" 
          active={activeTool === 'BULLDOZER'} 
          onClick={() => setActiveTool('BULLDOZER')} 
        />
      </div>

      <div className="w-20 h-px bg-white/5 my-1" />

      {/* Category Specific Tools */}
      <div className="w-full px-2 flex flex-col gap-2">
        {category === 'ROADS' && (
          <ToolButton 
            icon={<div className="w-5 h-5 bg-[#2A2D35] border border-white/40 rounded-sm" />} 
            label="Road" 
            cost={BUILD_COSTS[TileType.ROAD]} 
            active={activeTool === TileType.ROAD} 
            onClick={() => setActiveTool(TileType.ROAD)} 
          />
        )}

        {category === 'ZONING' && (
          <>
            <ToolButton 
              icon={<Home size={18} className="text-green-400" />} 
              label="Residential" 
              cost={BUILD_COSTS[TileType.RESIDENTIAL]} 
              active={activeTool === TileType.RESIDENTIAL} 
              onClick={() => setActiveTool(TileType.RESIDENTIAL)} 
            />
            <ToolButton 
              icon={<Briefcase size={18} className="text-blue-400" />} 
              label="Commercial" 
              cost={BUILD_COSTS[TileType.COMMERCIAL]} 
              active={activeTool === TileType.COMMERCIAL} 
              onClick={() => setActiveTool(TileType.COMMERCIAL)} 
            />
            <ToolButton 
              icon={<Factory size={18} className="text-yellow-400" />} 
              label="Industrial" 
              cost={BUILD_COSTS[TileType.INDUSTRIAL]} 
              active={activeTool === TileType.INDUSTRIAL} 
              onClick={() => setActiveTool(TileType.INDUSTRIAL)} 
            />
          </>
        )}

        {category === 'UTILITIES' && (
          <>
            <ToolButton 
              icon={<Zap size={18} className="text-purple-400" />} 
              label="Power Plant" 
              cost={BUILD_COSTS[TileType.POWER_PLANT]} 
              active={activeTool === TileType.POWER_PLANT} 
              onClick={() => setActiveTool(TileType.POWER_PLANT)} 
            />
            <ToolButton 
              icon={<Droplet size={18} className="text-cyan-400" />} 
              label="Water Pump" 
              cost={BUILD_COSTS[TileType.WATER_PUMP]} 
              active={activeTool === TileType.WATER_PUMP} 
              onClick={() => setActiveTool(TileType.WATER_PUMP)} 
            />
          </>
        )}

        {category === 'SERVICES' && (
          <>
            <ToolButton 
              icon={<Flame size={18} className="text-red-400" />} 
              label="Fire Station" 
              cost={BUILD_COSTS[TileType.FIRE_STATION]} 
              active={activeTool === TileType.FIRE_STATION} 
              onClick={() => setActiveTool(TileType.FIRE_STATION)} 
            />
            <ToolButton 
              icon={<Shield size={18} className="text-blue-400" />} 
              label="Police HQ" 
              cost={BUILD_COSTS[TileType.POLICE_STATION]} 
              active={activeTool === TileType.POLICE_STATION} 
              onClick={() => setActiveTool(TileType.POLICE_STATION)} 
            />
            <ToolButton 
              icon={<HeartPulse size={18} className="text-teal-400" />} 
              label="Clinic" 
              cost={BUILD_COSTS[TileType.CLINIC]} 
              active={activeTool === TileType.CLINIC} 
              onClick={() => setActiveTool(TileType.CLINIC)} 
            />
            <ToolButton 
              icon={<GraduationCap size={18} className="text-amber-400" />} 
              label="School" 
              cost={BUILD_COSTS[TileType.SCHOOL]} 
              active={activeTool === TileType.SCHOOL} 
              onClick={() => setActiveTool(TileType.SCHOOL)} 
            />
            <ToolButton 
              icon={<Trash2 size={18} className="text-slate-400" />} 
              label="Waste Plant" 
              cost={BUILD_COSTS[TileType.WASTE_MANAGEMENT]} 
              active={activeTool === TileType.WASTE_MANAGEMENT} 
              onClick={() => setActiveTool(TileType.WASTE_MANAGEMENT)} 
            />
            <ToolButton 
              icon={<Trees size={18} className="text-emerald-400" />} 
              label="Park" 
              cost={BUILD_COSTS[TileType.PARK]} 
              active={activeTool === TileType.PARK} 
              onClick={() => setActiveTool(TileType.PARK)} 
            />
          </>
        )}
      </div>
    </aside>
  );
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  cost?: number;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, cost, active, onClick }: ToolButtonProps) {
  return (
    <div 
      onClick={onClick}
      title={`${label} ${cost !== undefined ? `($${cost})` : ''}`}
      className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border ${
        active 
          ? 'bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
          : 'bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200'
      }`}
    >
      <div className="mb-0.5">{icon}</div>
      <div className="text-[8px] uppercase tracking-wider text-center truncate max-w-full">{label}</div>
      {cost !== undefined && <div className="text-[8px] text-[#D4AF37] font-mono mt-0.5">${cost}</div>}
    </div>
  );
}
