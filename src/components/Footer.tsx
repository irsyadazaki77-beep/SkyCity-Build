import React from 'react';
import { Pause, Play, FastForward } from 'lucide-react';

interface FooterProps {
  speed: 0 | 1 | 2;
  setSpeed: (speed: 0 | 1 | 2) => void;
  onOpenUpgrades: () => void;
}

export function Footer({ speed, setSpeed, onOpenUpgrades }: FooterProps) {
  return (
    <footer id="app-footer" className="h-12 bg-[#0A0B0D] border-t border-white/5 flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-4 text-[10px] tracking-widest text-gray-500 uppercase">
        <span className="text-white/80">Sim Speed</span>
        <button 
          onClick={onOpenUpgrades} 
          className="ml-4 flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37] rounded transition-all text-[9px] tracking-widest uppercase cursor-pointer"
        >
          City Upgrades
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setSpeed(0)} 
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
            speed === 0 ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
          }`}
          title="Pause Simulation"
        >
          <Pause size={14}/>
        </button>
        <button 
          onClick={() => setSpeed(1)} 
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
            speed === 1 ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-500 hover:text-white hover:bg-white/5'
          }`}
          title="Normal Speed"
        >
          <Play size={14}/>
        </button>
        <button 
          onClick={() => setSpeed(2)} 
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
            speed === 2 ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-500 hover:text-white hover:bg-white/5'
          }`}
          title="Fast Speed"
        >
          <FastForward size={14}/>
        </button>
      </div>
    </footer>
  );
}
