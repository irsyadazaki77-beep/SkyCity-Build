import React, { useState } from 'react';
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
  Expand
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('SELECT');

  const handleSelectCategory = (cat: CategoryType) => {
    setSelectedCategory(cat);
    if (setMapExpansionMode && mapExpansionMode) {
      setMapExpansionMode(false);
    }
    if (cat === 'SELECT') {
      setActiveTool('POINTER');
    } else if (cat === 'BULLDOZE') {
      setActiveTool('BULLDOZER');
    } else if (cat === 'ROADS') {
      setActiveTool(TileType.ROAD);
    } else if (cat === 'LANDSCAPING') {
      setActiveTool('RAISE_TERRAIN');
    }
  };

  const isTerraformingActive = ['RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'].includes(activeTool as string);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 w-full max-w-4xl px-4 pointer-events-none select-none">
      
      {/* Secondary Toolbar (Sub-menu) */}
      <div className="pointer-events-auto flex items-center justify-center min-h-[48px] w-full">
        {selectedCategory === 'ZONING' && (
          <div className="bg-[#1e293b]/90 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <SubToolButton icon={<Home size={18} className="text-[#10b981]" />} label="Residential" type={TileType.RESIDENTIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            <SubToolButton icon={<Briefcase size={18} className="text-[#3b82f6]" />} label="Commercial" type={TileType.COMMERCIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            <SubToolButton icon={<Factory size={18} className="text-[#eab308]" />} label="Industrial" type={TileType.INDUSTRIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
          </div>
        )}

        {selectedCategory === 'UTILITIES' && (
          <div className="bg-[#1e293b]/90 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <SubToolButton icon={<Zap size={18} className="text-yellow-400" />} label="Power Plant" type={TileType.POWER_PLANT} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            <SubToolButton icon={<Droplet size={18} className="text-cyan-400" />} label="Water Pump" type={TileType.WATER_PUMP} {...{activeTool, setActiveTool, money, milestoneLevel}} />
          </div>
        )}

        {selectedCategory === 'SERVICES' && (
          <div className="bg-[#1e293b]/90 backdrop-blur-md border border-white/10 p-1 rounded-xl flex items-center shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <SubToolButton icon={<Flame size={18} className="text-red-400" />} label="Fire Station" type={TileType.FIRE_STATION} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            <SubToolButton icon={<Shield size={18} className="text-blue-400" />} label="Police HQ" type={TileType.POLICE_STATION} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            <SubToolButton icon={<HeartPulse size={18} className="text-teal-400" />} label="Clinic" type={TileType.CLINIC} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            <SubToolButton icon={<GraduationCap size={18} className="text-amber-400" />} label="School" type={TileType.SCHOOL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            <SubToolButton icon={<Trash2 size={18} className="text-slate-400" />} label="Waste Plant" type={TileType.WASTE_MANAGEMENT} {...{activeTool, setActiveTool, money, milestoneLevel}} />
          </div>
        )}

        {selectedCategory === 'LANDSCAPING' && (
          <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-2 rounded-2xl flex flex-col md:flex-row items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-full">
            {/* Tools list */}
            <div className="flex items-center gap-1.5 border-r border-white/10 pr-3 mr-1">
              <button
                onClick={() => { setActiveTool('RAISE_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                className={`p-2 rounded-lg flex flex-col items-center gap-1 min-w-[65px] transition-all ${activeTool === 'RAISE_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
              >
                <ArrowUp size={16} className="text-cyan-400" />
                <span className="text-[10px] font-mono">$15/tile</span>
              </button>
              <button
                onClick={() => { setActiveTool('LOWER_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                className={`p-2 rounded-lg flex flex-col items-center gap-1 min-w-[65px] transition-all ${activeTool === 'LOWER_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
              >
                <ArrowDown size={16} className="text-cyan-400" />
                <span className="text-[10px] font-mono">$15/tile</span>
              </button>
              <button
                onClick={() => { setActiveTool('LEVEL_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                className={`p-2 rounded-lg flex flex-col items-center gap-1 min-w-[65px] transition-all ${activeTool === 'LEVEL_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
              >
                <Minus size={16} className="text-cyan-400" />
                <span className="text-[10px] font-mono">$15/tile</span>
              </button>
              <button
                onClick={() => { setActiveTool('SMOOTH_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                className={`p-2 rounded-lg flex flex-col items-center gap-1 min-w-[65px] transition-all ${activeTool === 'SMOOTH_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
              >
                <Sparkles size={16} className="text-cyan-400" />
                <span className="text-[10px] font-mono">$15/tile</span>
              </button>
              <SubToolButton icon={<Trees size={18} className="text-[#10b981]" />} label="City Park" type={TileType.PARK} {...{activeTool, setActiveTool, money, milestoneLevel}} />
            </div>

            {/* Brush Size Slider */}
            {isTerraformingActive && setBrushSize && (
              <div className="flex items-center gap-1 border-r border-white/10 pr-3 mr-1">
                <span className="text-[10px] font-bold text-gray-400 mr-1.5">BRUSH:</span>
                {[1, 2, 3].map((size) => (
                  <button
                    key={`brush-${size}`}
                    onClick={() => setBrushSize(size)}
                    className={`px-2.5 py-1 text-xs font-bold rounded ${brushSize === size ? 'bg-cyan-500 text-white shadow-inner' : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700 hover:text-white'}`}
                  >
                    {size === 1 ? 'S' : size === 2 ? 'M' : 'L'}
                  </button>
                ))}
              </div>
            )}

            {/* Region Unlock Land Expansion Toggle */}
            {setMapExpansionMode && (
              <button
                onClick={() => {
                  setMapExpansionMode(!mapExpansionMode);
                  if (!mapExpansionMode) {
                    setActiveTool('POINTER');
                  }
                }}
                className={`p-2 rounded-xl flex items-center gap-2 transition-all ${mapExpansionMode ? 'bg-yellow-500/30 text-white border border-yellow-500/40' : 'text-gray-300 hover:bg-white/10 border border-transparent'}`}
              >
                <Expand size={16} className={mapExpansionMode ? 'text-yellow-400 animate-pulse' : 'text-yellow-400'} />
                <span className="text-xs font-bold font-sans">Buy Regions ($50K)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Primary Toolbar */}
      <div className="pointer-events-auto bg-[#0f172a]/80 backdrop-blur-lg border border-white/10 p-1.5 rounded-2xl flex items-center justify-between w-full shadow-2xl">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <CategoryTab label="Select" icon={<MousePointer2 size={18} />} active={selectedCategory === 'SELECT'} onClick={() => handleSelectCategory('SELECT')} />
          <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
          <CategoryTab label="Roads" icon={<Grid size={18} />} active={selectedCategory === 'ROADS'} onClick={() => handleSelectCategory('ROADS')} />
          <CategoryTab label="Zoning" icon={<Layers size={18} />} active={selectedCategory === 'ZONING'} onClick={() => handleSelectCategory('ZONING')} />
          <CategoryTab label="Electricity & Water" icon={<Zap size={18} />} active={selectedCategory === 'UTILITIES'} onClick={() => handleSelectCategory('UTILITIES')} />
          <CategoryTab label="Services" icon={<Shield size={18} />} active={selectedCategory === 'SERVICES'} onClick={() => handleSelectCategory('SERVICES')} />
          <CategoryTab label="Landscape & Hills" icon={<Trees size={18} />} active={selectedCategory === 'LANDSCAPING'} onClick={() => handleSelectCategory('LANDSCAPING')} />
        </div>
        
        <div className="flex items-center gap-1 pl-2 border-l border-white/10 ml-2">
          <CategoryTab label="Bulldoze" icon={<Eraser size={18} className="text-red-400" />} active={selectedCategory === 'BULLDOZE'} onClick={() => handleSelectCategory('BULLDOZE')} />
        </div>
      </div>

    </div>
  );
}

function CategoryTab({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-xl flex items-center justify-center transition-all ${
        active
          ? 'bg-white/15 text-white shadow-inner'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
      title={label}
    >
      {icon}
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
      className={`relative px-4 py-2 rounded-lg flex flex-col items-center justify-center min-w-[70px] gap-1 transition-all ${
        !isUnlocked
          ? 'text-gray-600 opacity-50 cursor-not-allowed'
          : active
          ? 'bg-blue-500/30 text-white'
          : canAfford
          ? 'text-gray-300 hover:bg-white/10 hover:text-white'
          : 'text-red-400/80 hover:bg-red-500/10'
      }`}
      title={label}
    >
      {!isUnlocked ? <Lock size={18} className="text-gray-500" /> : icon}
      <span className={`text-[10px] font-mono font-medium ${!isUnlocked ? 'text-gray-600' : (active ? 'text-blue-200' : '')}`}>
        {!isUnlocked ? 'Locked' : `${cost}`}
      </span>
    </button>
  );
}
