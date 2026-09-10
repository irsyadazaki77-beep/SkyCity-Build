import React from 'react';
import { CityMilestone } from '../progression';
import { Landmark, Trophy, Sparkles, X } from 'lucide-react';

interface MilestoneBannerProps {
  milestone: CityMilestone | null;
  onClose: () => void;
}

export function MilestoneBanner({ milestone, onClose }: MilestoneBannerProps) {
  if (!milestone) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] px-[calc(env(safe-area-inset-left,0px)+0.75rem)] pr-[calc(env(safe-area-inset-right,0px)+0.75rem)] select-none animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#0f172a] border-2 border-[#D4AF37] rounded-2xl w-full max-w-md p-4 sm:p-6 text-white text-center shadow-[0_0_50px_rgba(212,175,55,0.3)] relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Close Milestone Banner"
        >
          <X size={18} />
        </button>

        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#D4AF37]/20 border border-[#D4AF37] rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-[#D4AF37] shadow-lg animate-bounce">
          <Trophy size={28} className="sm:w-8 sm:h-8" />
        </div>

        <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-[0.25em] sm:tracking-[0.3em] text-[#D4AF37] font-bold block mb-1">
          City Promotion Achieved
        </span>

        <h2 className="font-serif italic text-2xl sm:text-3xl font-bold text-white mb-2">
          {milestone.name} Status
        </h2>

        <p className="text-xs text-gray-300 leading-relaxed mb-4">{milestone.description}</p>

        {milestone.unlockedBuildingTypes.length > 0 && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-left mb-4 sm:mb-6">
            <span className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">
              New Services & Zones Unlocked:
            </span>
            <div className="flex flex-wrap gap-1">
              {milestone.unlockedBuildingTypes.map((b) => (
                <span
                  key={b}
                  className="px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-mono font-bold border border-[#D4AF37]/30"
                >
                  Unlocks {b === 7 ? 'Fire Station' : b === 8 ? 'Police HQ' : b === 9 ? 'Clinic' : b === 10 ? 'School' : b === 11 ? 'Waste Plant' : 'Park'}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 sm:py-3 bg-[#D4AF37] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#c29f2e] transition-colors shadow-lg min-h-[40px]"
        >
          Continue Building
        </button>
      </div>
    </div>
  );
}
