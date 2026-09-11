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
  Hammer,
  X
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
  
  // Track whether build mode is active
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
      handleInspectClick();
    } else {
      setIsBuildDrawerOpen(true);
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
    <>
      {/* ========================================================================= */}
      {/* MOBILE INTERFACE (< sm): Single Compact Dock + 1 Contextual Bar Only      */}
      {/* ========================================================================= */}
      <div className="flex sm:hidden fixed bottom-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] left-1/2 -translate-x-1/2 z-35 flex-col items-center w-full px-2 pointer-events-none select-none">
        
        {/* Contextual Build Panel: Compact 2-row bottom sheet (Category pills + Subtools) */}
        {isBuildDrawerOpen && (
          <div className="pointer-events-auto w-full max-w-md bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 mb-1.5">
            
            {/* Category Switcher Row */}
            <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar touch-pan-x pb-0.5 border-b border-white/5">
              <MobileCategoryChip 
                label="Roads" 
                icon={<Grid size={15} />} 
                active={selectedBuildCategory === 'ROADS'} 
                onClick={() => handleSelectCategory('ROADS')} 
              />
              <MobileCategoryChip 
                label="Zones" 
                icon={<Layers size={15} />} 
                active={selectedBuildCategory === 'ZONING'} 
                onClick={() => handleSelectCategory('ZONING')} 
              />
              <MobileCategoryChip 
                label="Utilities" 
                icon={<Zap size={15} />} 
                active={selectedBuildCategory === 'UTILITIES'} 
                onClick={() => handleSelectCategory('UTILITIES')} 
              />
              <MobileCategoryChip 
                label="Services" 
                icon={<Shield size={15} />} 
                active={selectedBuildCategory === 'SERVICES'} 
                onClick={() => handleSelectCategory('SERVICES')} 
              />
              <MobileCategoryChip 
                label="Landscape" 
                icon={<Trees size={15} />} 
                active={selectedBuildCategory === 'LANDSCAPING'} 
                onClick={() => handleSelectCategory('LANDSCAPING')} 
              />
              <button
                onClick={handleInspectClick}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
                aria-label="Close Build Mode"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sub-tools Contextual Horizontal Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x py-0.5">
              {selectedBuildCategory === 'ROADS' && (
                <MobileSubToolButton 
                  icon={<Grid size={16} className="text-slate-300" />} 
                  label="Road" 
                  type={TileType.ROAD} 
                  {...{activeTool, setActiveTool, money, milestoneLevel}} 
                />
              )}

              {selectedBuildCategory === 'ZONING' && (
                <>
                  <MobileSubToolButton icon={<Home size={16} className="text-[#10b981]" />} label="Res" type={TileType.RESIDENTIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                  <MobileSubToolButton icon={<Briefcase size={16} className="text-[#3b82f6]" />} label="Com" type={TileType.COMMERCIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                  <MobileSubToolButton icon={<Factory size={16} className="text-[#eab308]" />} label="Ind" type={TileType.INDUSTRIAL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                </>
              )}

              {selectedBuildCategory === 'UTILITIES' && (
                <>
                  <MobileSubToolButton icon={<Zap size={16} className="text-yellow-400" />} label="Power" type={TileType.POWER_PLANT} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                  <MobileSubToolButton icon={<Droplet size={16} className="text-cyan-400" />} label="Water" type={TileType.WATER_PUMP} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                </>
              )}

              {selectedBuildCategory === 'SERVICES' && (
                <>
                  <MobileSubToolButton icon={<Flame size={16} className="text-red-400" />} label="Fire" type={TileType.FIRE_STATION} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                  <MobileSubToolButton icon={<Shield size={16} className="text-blue-400" />} label="Police" type={TileType.POLICE_STATION} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                  <MobileSubToolButton icon={<HeartPulse size={16} className="text-teal-400" />} label="Clinic" type={TileType.CLINIC} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                  <MobileSubToolButton icon={<GraduationCap size={16} className="text-amber-400" />} label="School" type={TileType.SCHOOL} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                  <MobileSubToolButton icon={<Trash2 size={16} className="text-slate-400" />} label="Waste" type={TileType.WASTE_MANAGEMENT} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                </>
              )}

              {selectedBuildCategory === 'LANDSCAPING' && (
                <>
                  <button
                    onClick={() => { setActiveTool('RAISE_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`min-h-[44px] min-w-[48px] px-2 rounded-xl flex flex-col items-center justify-center transition-all shrink-0 ${
                      activeTool === 'RAISE_TERRAIN' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/40' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <ArrowUp size={14} className="text-cyan-400" />
                    <span className="text-[9px] font-mono font-bold">$15</span>
                  </button>

                  <button
                    onClick={() => { setActiveTool('LOWER_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`min-h-[44px] min-w-[48px] px-2 rounded-xl flex flex-col items-center justify-center transition-all shrink-0 ${
                      activeTool === 'LOWER_TERRAIN' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/40' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <ArrowDown size={14} className="text-cyan-400" />
                    <span className="text-[9px] font-mono font-bold">$15</span>
                  </button>

                  <button
                    onClick={() => { setActiveTool('LEVEL_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`min-h-[44px] min-w-[48px] px-2 rounded-xl flex flex-col items-center justify-center transition-all shrink-0 ${
                      activeTool === 'LEVEL_TERRAIN' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/40' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Minus size={14} className="text-cyan-400" />
                    <span className="text-[9px] font-mono font-bold">$15</span>
                  </button>

                  <button
                    onClick={() => { setActiveTool('SMOOTH_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`min-h-[44px] min-w-[48px] px-2 rounded-xl flex flex-col items-center justify-center transition-all shrink-0 ${
                      activeTool === 'SMOOTH_TERRAIN' ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/40' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Sparkles size={14} className="text-cyan-400" />
                    <span className="text-[9px] font-mono font-bold">$15</span>
                  </button>

                  <MobileSubToolButton icon={<Trees size={16} className="text-[#10b981]" />} label="Park" type={TileType.PARK} {...{activeTool, setActiveTool, money, milestoneLevel}} />

                  {/* Brush Size */}
                  {setBrushSize && (
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl shrink-0 border border-white/5">
                      {[1, 2, 3].map((size) => (
                        <button
                          key={`m-brush-${size}`}
                          onClick={() => setBrushSize(size)}
                          className={`min-h-[40px] min-w-[34px] flex items-center justify-center text-xs font-mono font-bold rounded-lg ${
                            brushSize === size ? 'bg-cyan-500 text-white shadow' : 'text-gray-400 hover:text-white'
                          }`}
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
                      className={`min-h-[44px] px-3 rounded-xl flex items-center gap-1.5 transition-all shrink-0 ${
                        mapExpansionMode ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-500/50' : 'text-gray-300 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <Expand size={14} className="text-yellow-400" />
                      <span className="text-[10px] font-mono font-bold">Expand $50k</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Mobile Primary Dock: 3 Essential Actions with 44-48px Touch Targets */}
        <div className="pointer-events-auto bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 px-2 py-1.5 rounded-2xl flex items-center justify-between w-full max-w-md shadow-2xl">
          <button
            onClick={handleInspectClick}
            className={`flex items-center justify-center gap-2 flex-1 min-h-[46px] rounded-xl transition-all ${
              activeCategory === 'SELECT'
                ? 'bg-blue-500/25 text-blue-300 font-bold border border-blue-500/30 shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MousePointer2 size={18} />
            <span className="text-xs tracking-wide">Inspect</span>
          </button>

          <button
            onClick={handleBuildClick}
            className={`flex items-center justify-center gap-2 flex-1 min-h-[46px] rounded-xl transition-all relative ${
              isBuildingMode
                ? 'bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/30 shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Hammer size={18} className={isBuildingMode ? 'rotate-12' : ''} />
            <span className="text-xs tracking-wide">Build</span>
            {isBuildingMode && (
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={handleDemolishClick}
            className={`flex items-center justify-center gap-2 flex-1 min-h-[46px] rounded-xl transition-all ${
              activeCategory === 'BULLDOZE'
                ? 'bg-rose-500/25 text-rose-300 font-bold border border-rose-500/30 shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eraser size={18} />
            <span className="text-xs tracking-wide">Demolish</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP INTERFACE (sm:flex): Standard Construction Dock                   */}
      {/* ========================================================================= */}
      <div className="hidden sm:flex fixed bottom-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] left-1/2 -translate-x-1/2 z-30 flex-col items-center gap-1.5 w-full max-w-lg px-4 pointer-events-none select-none">
        
        {/* TIER 3: Active Sub-Tools Panel */}
        {isBuildDrawerOpen && (
          <div className="pointer-events-auto flex items-center justify-center min-h-[44px] w-full max-w-full px-1">
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
                <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1 flex-shrink-0">
                  <button
                    onClick={() => { setActiveTool('RAISE_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[50px] min-h-[44px] transition-all ${activeTool === 'RAISE_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  >
                    <ArrowUp size={13} className="text-cyan-400" />
                    <span className="text-[9px] font-mono">$15</span>
                  </button>
                  <button
                    onClick={() => { setActiveTool('LOWER_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[50px] min-h-[44px] transition-all ${activeTool === 'LOWER_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  >
                    <ArrowDown size={13} className="text-cyan-400" />
                    <span className="text-[9px] font-mono">$15</span>
                  </button>
                  <button
                    onClick={() => { setActiveTool('LEVEL_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[50px] min-h-[44px] transition-all ${activeTool === 'LEVEL_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  >
                    <Minus size={13} className="text-cyan-400" />
                    <span className="text-[9px] font-mono">$15</span>
                  </button>
                  <button
                    onClick={() => { setActiveTool('SMOOTH_TERRAIN'); if (setMapExpansionMode) setMapExpansionMode(false); }}
                    className={`p-1.5 rounded-lg flex flex-col items-center justify-center min-w-[50px] min-h-[44px] transition-all ${activeTool === 'SMOOTH_TERRAIN' ? 'bg-cyan-500/35 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  >
                    <Sparkles size={13} className="text-cyan-400" />
                    <span className="text-[9px] font-mono">$15</span>
                  </button>
                  <SubToolButton icon={<Trees size={15} className="text-[#10b981]" />} label="City Park" type={TileType.PARK} {...{activeTool, setActiveTool, money, milestoneLevel}} />
                </div>

                {setBrushSize && (
                  <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1 flex-shrink-0">
                    {[1, 2, 3].map((size) => (
                      <button
                        key={`d-brush-${size}`}
                        onClick={() => setBrushSize(size)}
                        className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded ${brushSize === size ? 'bg-cyan-500 text-white font-mono' : 'bg-slate-700/50 text-gray-400 font-mono hover:text-white'}`}
                      >
                        {size === 1 ? 'S' : size === 2 ? 'M' : 'L'}
                      </button>
                    ))}
                  </div>
                )}

                {setMapExpansionMode && (
                  <button
                    onClick={() => {
                      setMapExpansionMode(!mapExpansionMode);
                      if (!mapExpansionMode) {
                        setActiveTool('POINTER');
                      }
                    }}
                    className={`px-2 py-1 rounded-xl flex items-center gap-1 transition-all flex-shrink-0 min-h-[44px] ${mapExpansionMode ? 'bg-yellow-500/35 text-white border border-yellow-500/40' : 'text-gray-300 hover:bg-white/10 border border-transparent'}`}
                  >
                    <Expand size={13} className={mapExpansionMode ? 'text-yellow-400 animate-pulse' : 'text-yellow-400'} />
                    <span className="text-[10px] font-bold font-sans">Expand ($50k)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TIER 2: Expandable Build Categories */}
        {isBuildDrawerOpen && (
          <div className="pointer-events-auto bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl flex items-center justify-around w-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <CategoryTab label="Roads" icon={<Grid size={15} />} active={selectedBuildCategory === 'ROADS'} onClick={() => handleSelectCategory('ROADS')} />
            <CategoryTab label="Zones" icon={<Layers size={15} />} active={selectedBuildCategory === 'ZONING'} onClick={() => handleSelectCategory('ZONING')} />
            <CategoryTab label="Utilities" icon={<Zap size={15} />} active={selectedBuildCategory === 'UTILITIES'} onClick={() => handleSelectCategory('UTILITIES')} />
            <CategoryTab label="Services" icon={<Shield size={15} />} active={selectedBuildCategory === 'SERVICES'} onClick={() => handleSelectCategory('SERVICES')} />
            <CategoryTab label="Landscape" icon={<Trees size={15} />} active={selectedBuildCategory === 'LANDSCAPING'} onClick={() => handleSelectCategory('LANDSCAPING')} />
          </div>
        )}

        {/* TIER 1: Core Navigation Dock */}
        <div className="pointer-events-auto bg-[#0f172a]/95 backdrop-blur-lg border border-white/10 px-3 py-1.5 rounded-3xl flex items-center justify-between w-full shadow-2xl">
          <button
            onClick={handleInspectClick}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all min-h-[48px] ${
              activeCategory === 'SELECT'
                ? 'bg-blue-500/20 text-blue-300 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MousePointer2 size={16} className={activeCategory === 'SELECT' ? 'scale-110' : ''} />
            <span className="text-[10px] mt-0.5 tracking-wide font-medium">Inspect</span>
          </button>

          <button
            onClick={handleBuildClick}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all min-h-[48px] relative ${
              isBuildingMode
                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Hammer size={16} className={isBuildingMode ? 'scale-110 rotate-12' : ''} />
            <span className="text-[10px] mt-0.5 tracking-wide font-medium">Build</span>
            {isBuildingMode && (
              <span className="absolute top-1 right-[25%] w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            )}
          </button>

          <button
            onClick={handleDemolishClick}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all min-h-[48px] ${
              activeCategory === 'BULLDOZE'
                ? 'bg-rose-500/20 text-rose-300 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eraser size={16} className={activeCategory === 'BULLDOZE' ? 'scale-110 -rotate-12' : ''} />
            <span className="text-[10px] mt-0.5 tracking-wide font-medium">Demolish</span>
          </button>
        </div>

      </div>
    </>
  );
}

function MobileCategoryChip({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all text-xs font-medium shrink-0 ${
        active
          ? 'bg-white/20 text-white font-bold shadow-sm'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MobileSubToolButton({ 
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
      className={`min-h-[44px] min-w-[52px] px-2.5 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all shrink-0 ${
        !isUnlocked
          ? 'text-gray-600 bg-white/5 opacity-50 cursor-not-allowed'
          : active
          ? 'bg-blue-500/35 text-white font-bold border border-blue-400/50 shadow'
          : canAfford
          ? 'text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white'
          : 'text-red-400 bg-red-950/30 border border-red-500/30'
      }`}
    >
      {!isUnlocked ? <Lock size={13} className="text-gray-500" /> : icon}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold">{label}</span>
        <span className={`text-[9px] font-mono ${!isUnlocked ? 'text-gray-600' : active ? 'text-blue-200' : 'text-gray-400'}`}>
          {!isUnlocked ? '' : `$${cost >= 1000 ? `${(cost / 1000).toFixed(0)}k` : cost}`}
        </span>
      </div>
    </button>
  );
}

function CategoryTab({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl flex flex-col items-center justify-center transition-all min-h-[44px] min-w-[54px] flex-1 ${
        active
          ? 'bg-white/15 text-white font-bold'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="text-[9px] mt-0.5 whitespace-nowrap">{label}</span>
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
      className={`relative px-2.5 py-1.5 rounded-lg flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-all flex-shrink-0 ${
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
