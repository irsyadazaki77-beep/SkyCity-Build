import React, { useState, useEffect } from 'react';
import { 
  MousePointer2, 
  Eraser, 
  Grid, 
  Layers, 
  Zap, 
  Shield, 
  Trees,
  Home,
  Briefcase,
  Factory,
  Droplet,
  Flame,
  HeartPulse,
  GraduationCap,
  Trash2,
  Lock,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Expand,
  Hammer
} from 'lucide-react';
import { TileType, BUILD_COSTS } from '../../types';
import { isBuildingUnlocked } from '../../progression';

export type CategoryType = 'ROADS' | 'ZONING' | 'UTILITIES' | 'SERVICES' | 'LANDSCAPING' | 'BULLDOZE' | 'SELECT';

interface BottomToolbarProps {
  activeTool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
  setActiveTool: (tool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN') => void;
  money: number;
  milestoneLevel: number;
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  mapExpansionMode?: boolean;
  setMapExpansionMode?: (mode: boolean) => void;
}

function getCategoryFromTool(tool: any): CategoryType {
  if (tool === 'POINTER') return 'SELECT';
  if (tool === 'BULLDOZER') return 'BULLDOZE';
  if (tool === TileType.ROAD) return 'ROADS';
  if (tool === TileType.RESIDENTIAL || tool === TileType.COMMERCIAL || tool === TileType.INDUSTRIAL) return 'ZONING';
  if (tool === TileType.POWER_PLANT || tool === TileType.WATER_PUMP) return 'UTILITIES';
  if (
    tool === TileType.FIRE_STATION || 
    tool === TileType.POLICE_STATION || 
    tool === TileType.CLINIC || 
    tool === TileType.SCHOOL || 
    tool === TileType.WASTE_MANAGEMENT
  ) return 'SERVICES';
  if (
    tool === 'RAISE_TERRAIN' || 
    tool === 'LOWER_TERRAIN' || 
    tool === 'LEVEL_TERRAIN' || 
    tool === 'SMOOTH_TERRAIN' || 
    tool === TileType.PARK
  ) return 'LANDSCAPING';
  return 'SELECT';
}

export function BottomToolbar({ 
  activeTool, 
  setActiveTool, 
  money, 
  milestoneLevel,
  brushSize = 1,
  setBrushSize,
  mapExpansionMode = false,
  setMapExpansionMode
}: BottomToolbarProps) {
  const activeCategory = getCategoryFromTool(activeTool);
  
  // Track whether the build drawer is visible.
  // It is visible if the active tool is a build tool, or if the user explicitly opened it.
  const isBuildingMode = activeCategory !== 'SELECT' && activeCategory !== 'BULLDOZE';
  const [isBuildDrawerOpen, setIsBuildDrawerOpen] = useState(isBuildingMode);
  const [selectedBuildCategory, setSelectedBuildCategory] = useState<'ROADS' | 'ZONING' | 'UTILITIES' | 'SERVICES' | 'LANDSCAPING'>('ROADS');

  // Keep state in sync with external changes
  useEffect(() => {
    if (isBuildingMode) {
      setIsBuildDrawerOpen(true);
      const cat = activeCategory as any;
      if (['ROADS', 'ZONING', 'UTILITIES', 'SERVICES', 'LANDSCAPING'].includes(cat)) {
        setSelectedBuildCategory(cat);
      }
    } else {
      setIsBuildDrawerOpen(false);
    }
  }, [activeTool]);

  const handleInspectClick = () => {
    setActiveTool('POINTER');
    setIsBuildDrawerOpen(false);
    if (setMapExpansionMode) setMapExpansionMode(false);
  };

  const handleDemolishClick = () => {
    setActiveTool('BULLDOZER');
    setIsBuildDrawerOpen(false);
    if (setMapExpansionMode) setMapExpansionMode(false);
  };

  const handleBuildClick = () => {
    if (isBuildDrawerOpen) {
      // Toggle off to inspect mode
      handleInspectClick();
    } else {
      setIsBuildDrawerOpen(true);
      // Default to last selected build category or Roads
      handleSelectCategory(selectedBuildCategory);
    }
  };

  const handleSelectCategory = (cat: 'ROADS' | 'ZONING' | 'UTILITIES' | 'SERVICES' | 'LANDSCAPING') => {
    setSelectedBuildCategory(cat);
    if (setMapExpansionMode && mapExpansionMode) {
      setMapExpansionMode(false);
    }
    
    if (cat === 'ROADS') {
      setActiveTool(TileType.ROAD);
    } else if (cat === 'ZONING') {
      setActiveTool(TileType.RESIDENTIAL);
    } else if (cat === 'UTILITIES') {
      setActiveTool(TileType.POWER_PLANT);
    } else if (cat === 'SERVICES') {
      setActiveTool(TileType.FIRE_STATION);
    } else if (cat === 'LANDSCAPING') {
      setActiveTool('RAISE_TERRAIN');
    }
  };

  return (
    <div className="fixed bottom-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 w-full max-w-lg px-2 sm:px-4 pointer-events-none select-none">
      
      {/* TIER 3: Active Sub-Tools Panel (Floats at the very top of the construction dock) */}
      {isBuildDrawerOpen && (
        <div className="pointer-events-auto flex items-center justify-center min-h-[40px] sm:min-h-[44px] w-full max-w-full px-1">
          {selectedBuildCategory === 'ZONING' && (
            <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-full overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x">
              <SubToolButton icon={<Home size={15} className="text-[#10b981]" />} label="Residential" type={TileType.RESIDENTIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              <SubToolButton icon={<Briefcase size={15} className="text-[#3b82f6]" />} label="Commercial" type={TileType.COMMERCIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              <SubToolButton icon={<Factory size={15} className="text-[#eab308]" />} label="Industrial" type={TileType.INDUSTRIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            </div>
          )}

          {selectedBuildCategory === 'UTILITIES' && (
            <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-full overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x">
              <SubToolButton icon={<Zap size={15} className="text-yellow-400" />} label="Power Plant" type={TileType.POWER_PLANT} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              <SubToolButton icon={<Droplet size={15} className="text-cyan-400" />} label="Water Pump" type={TileType.WATER_PUMP} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            </div>
          )}

          {selectedBuildCategory === 'SERVICES' && (
            <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-full overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x">
              <SubToolButton icon={<Flame size={15} className="text-red-400" />} label="Fire Station" type={TileType.FIRE_STATION} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              <SubToolButton icon={<Shield size={15} className="text-blue-400" />} label="Police HQ" type={TileType.POLICE_STATION} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              <SubToolButton icon={<HeartPulse size={15} className="text-teal-400" />} label="Clinic" type={TileType.CLINIC} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              <SubToolButton icon={<GraduationCap size={15} className="text-amber-400" />} label="School" type={TileType.SCHOOL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              <SubToolButton icon={<Trash2 size={15} className="text-slate-400" />} label="Waste Plant" type={TileType.WASTE_MANAGEMENT} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            </div>
          )}

          {selectedBuildCategory === 'LANDSCAPING' && (
            <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center gap-1 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-full overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x">
              {/* Terrain Tools */}
              <div className="flex items-center gap-0.5 sm:gap-1 border-r border-white/10 pr-1.5 sm:pr-2 mr-1 flex-shrink-0">
                <button
                  onClick={() => { setActiveTool('RAISE_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                  className={`p-1 sm:p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[42px] sm:min-w-[50px] min-h-[40px] sm:min-h-[44px] transition-all ${activeTool === 'RAISE_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                >
                  <ArrowUp size={13} className="text-cyan-400" />
                  <span className="text-[8px] sm:text-[9px] font-mono">$15</span>
                </button>
                <button
                  onClick={() => { setActiveTool('LOWER_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                  className={`p-1 sm:p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[42px] sm:min-w-[50px] min-h-[40px] sm:min-h-[44px] transition-all ${activeTool === 'LOWER_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                >
                  <ArrowDown size={13} className="text-cyan-400" />
                  <span className="text-[8px] sm:text-[9px] font-mono">$15</span>
                </button>
                <button
                  onClick={() => { setActiveTool('LEVEL_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                  className={`p-1 sm:p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[42px] sm:min-w-[50px] min-h-[40px] sm:min-h-[44px] transition-all ${activeTool === 'LEVEL_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                >
                  <Minus size={13} className="text-cyan-400" />
                  <span className="text-[8px] sm:text-[9px] font-mono">$15</span>
                </button>
                <button
                  onClick={() => { setActiveTool('SMOOTH_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                  className={`p-1 sm:p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[42px] sm:min-w-[50px] min-h-[40px] sm:min-h-[44px] transition-all ${activeTool === 'SMOOTH_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                >
                  <Sparkles size={13} className="text-cyan-400" />
                  <span className="text-[8px] sm:text-[9px] font-mono">$15</span>
                </button>
                <SubToolButton icon={<Trees size={15} className="text-[#10b981]" />} label="City Park" type={TileType.PARK} {...{activeTool, setActiveTool, money, milestoneLevel}} />
              </div>

              {/* Brush Size */}
              {setBrushSize && (
                <div className="flex items-center gap-1 border-r border-white/10 pr-1.5 sm:pr-2 mr-1 flex-shrink-0">
                  {[1, 2, 3].map((size) => (
                    <button
                      key={`brush-${size}`}
                      onClick={() => setBrushSize(size)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-[10px] sm:text-xs font-bold rounded ${brushSize === size ? 'bg-cyan-500 text-white font-mono' : 'bg-slate-700/50 text-gray-400 font-mono hover:text-white'}`}
                    >
                      {size === 1 ? 'S' : size === 2 ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              )}

              {/* Land Expansion Option */}
              {setMapExpansionMode && (
                <button
                  onClick={() => {
                    setMapExpansionMode(!mapExpansionMode);
                    if (!mapExpansionMode) {
                      setActiveTool('POINTER');
                    }
                  }}
                  className={`px-2 py-1 rounded-xl flex items-center gap-1 transition-all flex-shrink-0 min-h-[40px] sm:min-h-[44px] ${mapExpansionMode ? 'bg-yellow-500/35 text-white border border-yellow-500/40' : 'text-gray-300 hover:bg-white/10 border border-transparent'}`}
                >
                  <Expand size={13} className={mapExpansionMode ? 'text-yellow-400 animate-pulse' : 'text-yellow-400'} />
                  <span className="text-[9px] sm:text-[10px] font-bold font-sans">Expand ($50k)</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TIER 2: Expandable Build Categories (Show only in build mode) */}
      {isBuildDrawerOpen && (
        <div className="pointer-events-auto bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl flex items-center justify-around w-[96%] sm:w-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CategoryTab label="Roads" icon={<Grid size={15} />} active={selectedBuildCategory === 'ROADS'} onClick={() => handleSelectCategory('ROADS')} />
          <CategoryTab label="Zones" icon={<Layers size={15} />} active={selectedBuildCategory === 'ZONING'} onClick={() => handleSelectCategory('ZONING')} />
          <CategoryTab label="Utilities" icon={<Zap size={15} />} active={selectedBuildCategory === 'UTILITIES'} onClick={() => handleSelectCategory('UTILITIES')} />
          <CategoryTab label="Services" icon={<Shield size={15} />} active={selectedBuildCategory === 'SERVICES'} onClick={() => handleSelectCategory('SERVICES')} />
          <CategoryTab label="Landscape" icon={<Trees size={15} />} active={selectedBuildCategory === 'LANDSCAPING'} onClick={() => handleSelectCategory('LANDSCAPING')} />
        </div>
      )}

      {/* TIER 1: Core Navigation Dock (Always visible, simple, compact) */}
      <div className="pointer-events-auto bg-[#0f172a]/95 backdrop-blur-lg border border-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-2xl sm:rounded-3xl flex items-center justify-between w-[96%] sm:w-full shadow-2xl">
        {/* Inspect/Pointer Action */}
        <button
          onClick={handleInspectClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl sm:rounded-2xl transition-all min-h-[42px] sm:min-h-[48px] ${
            activeCategory === 'SELECT'
              ? 'bg-blue-500/20 text-blue-300 font-bold'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <MousePointer2 size={16} className={activeCategory === 'SELECT' ? 'scale-110' : ''} />
          <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-wide font-medium">Inspect</span>
        </button>

        {/* Build Mode Toggle */}
        <button
          onClick={handleBuildClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl sm:rounded-2xl transition-all min-h-[42px] sm:min-h-[48px] relative ${
            isBuildingMode
              ? 'bg-emerald-500/20 text-emerald-300 font-bold'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Hammer size={16} className={isBuildingMode ? 'scale-110 rotate-12' : ''} />
          <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-wide font-medium">Build</span>
          {isBuildingMode && (
            <span className="absolute top-1 right-[25%] w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
          )}
        </button>

        {/* Bulldozer/Demolish Action */}
        <button
          onClick={handleDemolishClick}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl sm:rounded-2xl transition-all min-h-[42px] sm:min-h-[48px] ${
            activeCategory === 'BULLDOZE'
              ? 'bg-rose-500/20 text-rose-300 font-bold'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Eraser size={16} className={activeCategory === 'BULLDOZE' ? 'scale-110 -rotate-12' : ''} />
          <span className="text-[9px] sm:text-[10px] mt-0.5 tracking-wide font-medium">Demolish</span>
        </button>
      </div>

    </div>
  );
}

function CategoryTab({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center transition-all min-h-[40px] sm:min-h-[44px] min-w-[48px] sm:min-w-[54px] flex-1 ${
        active
          ? 'bg-white/15 text-white font-bold'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="text-[8px] sm:text-[9px] mt-0.5 whitespace-nowrap">{label}</span>
    </button>
  );
}

function SubToolButton({ 
  icon, 
  label, 
  type, 
  activeTool, 
  setActiveTool, 
  money, 
  milestoneLevel 
}: { 
  icon: React.ReactNode; 
  label: string; 
  type: TileType; 
  activeTool: string | TileType; 
  setActiveTool: (t: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN') => void; 
  money: number; 
  milestoneLevel: number;
}) {
  const isUnlocked = isBuildingUnlocked(type, milestoneLevel);
  const cost = BUILD_COSTS[type] || 0;
  const canAfford = money >= cost;
  const active = activeTool === type;

  return (
    <button
      disabled={!isUnlocked}
      onClick={() => setActiveTool(type)}
      className={`relative px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg flex flex-col items-center justify-center min-w-[50px] sm:min-w-[56px] min-h-[40px] sm:min-h-[44px] gap-0.5 transition-all flex-shrink-0 ${
        !isUnlocked
          ? 'text-gray-600 opacity-50 cursor-not-allowed'
          : active
          ? 'bg-blue-500/30 text-white font-semibold'
          : canAfford
          ? 'text-gray-300 hover:bg-white/10 hover:text-white'
          : 'text-red-400/80 hover:bg-red-500/10'
      }`}
      title={`${label} - $${cost}`}
    >
      {!isUnlocked ? <Lock size={12} className="text-gray-500" /> : icon}
      <span className={`text-[8px] font-mono ${!isUnlocked ? 'text-gray-600' : (active ? 'text-blue-200' : 'text-gray-400')}`}>
        {!isUnlocked ? 'Locked' : `$${cost >= 1000 ? `${(cost / 1000).toFixed(0)}k` : cost}`}
      </span>
      <span className="text-[7px] font-sans text-gray-400 truncate max-w-[46px] leading-tight select-none">
        {label}
      </span>
    </button>
  );
}
