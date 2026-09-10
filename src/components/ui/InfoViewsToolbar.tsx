import React, { useState } from 'react';
import { OverlayMode } from '../../types';
import { 
  Eye, 
  Map, 
  Car, 
  Zap, 
  Droplet, 
  Trash2, 
  HeartPulse, 
  GraduationCap, 
  Flame, 
  Shield, 
  DollarSign, 
  Leaf, 
  Smile, 
  Activity,
  X
} from 'lucide-react';

interface InfoViewsToolbarProps {
  activeOverlay: OverlayMode;
  onSelectOverlay: (mode: OverlayMode) => void;
}

export function InfoViewsToolbar({ activeOverlay, onSelectOverlay }: InfoViewsToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] left-[calc(env(safe-area-inset-left,0px)+0.75rem)] z-35">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2.5 sm:p-3 bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-full shadow-lg text-gray-300 hover:text-white transition-all hover:scale-105 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center"
          title="Info Views"
        >
          <Eye size={18} className="sm:w-5 sm:h-5" />
        </button>
      </div>
    );
  }

  const renderBtn = (mode: OverlayMode, icon: React.ReactNode, label: string, colorClass: string) => {
    const isActive = activeOverlay === mode;
    return (
      <button
        onClick={() => onSelectOverlay(isActive ? 'NONE' : mode)}
        className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition-all ${
          isActive
            ? `${colorClass} shadow-inner`
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
        title={label}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] left-[calc(env(safe-area-inset-left,0px)+0.75rem)] z-35 bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-1 max-h-[50vh] sm:max-h-[60vh] max-w-[240px] sm:max-w-[280px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-left-2 duration-200">
      
      <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-white/10">
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Info Views</span>
        <button onClick={() => { setIsOpen(false); onSelectOverlay('NONE'); }} className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {renderBtn('TRAFFIC', <Car size={18} />, 'Traffic', 'bg-red-500/30 text-red-200')}
        {renderBtn('POWER', <Zap size={18} />, 'Power', 'bg-yellow-500/30 text-yellow-200')}
        {renderBtn('WATER', <Droplet size={18} />, 'Water', 'bg-cyan-500/30 text-cyan-200')}
        {renderBtn('WASTE', <Trash2 size={18} />, 'Waste', 'bg-stone-500/30 text-stone-200')}
        {renderBtn('HEALTH', <HeartPulse size={18} />, 'Health', 'bg-emerald-500/30 text-emerald-200')}
        {renderBtn('EDUCATION', <GraduationCap size={18} />, 'Education', 'bg-blue-500/30 text-blue-200')}
        {renderBtn('FIRE', <Flame size={18} />, 'Fire Safety', 'bg-orange-500/30 text-orange-200')}
        {renderBtn('POLICE', <Shield size={18} />, 'Police & Crime', 'bg-indigo-500/30 text-indigo-200')}
        {renderBtn('LAND_VALUE', <DollarSign size={18} />, 'Land Value', 'bg-emerald-500/30 text-emerald-200')}
        {renderBtn('POLLUTION', <Leaf size={18} />, 'Pollution', 'bg-purple-500/30 text-purple-200')}
        {renderBtn('NOISE', <Activity size={18} />, 'Noise', 'bg-pink-500/30 text-pink-200')}
        {renderBtn('HAPPINESS', <Smile size={18} />, 'Happiness', 'bg-yellow-500/30 text-yellow-200')}
        {renderBtn('NATURAL_RESOURCES', <Map size={18} />, 'Natural Resources', 'bg-lime-500/30 text-lime-200')}
      </div>

      {activeOverlay === 'NATURAL_RESOURCES' && (
        <div className="mt-2 p-2 bg-[#1e293b]/90 border border-white/10 rounded-lg text-xs space-y-1.5 animate-in fade-in duration-150">
          <div className="font-bold text-gray-300 border-b border-white/5 pb-1 mb-1">Resources Legend</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#84cc16]" />
            <span className="text-gray-300">Fertile Land (Farming)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#15803d]" />
            <span className="text-gray-300">Forest (Timber Industry)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#b45309]" />
            <span className="text-gray-300">Ore Minerals (Mining)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#1e1b4b]" />
            <span className="text-gray-300">Oil Reserves (Drilling)</span>
          </div>
        </div>
      )}
    </div>
  );
}
