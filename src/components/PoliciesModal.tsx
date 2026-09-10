import React from 'react';
import { POLICIES, Policy, MILESTONES } from '../progression';
import { X, Landmark, Check, Lock, DollarSign } from 'lucide-react';

interface PoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneLevel: number;
  activePolicies: string[];
  onTogglePolicy: (policyId: string) => void;
}

export function PoliciesModal({
  isOpen,
  onClose,
  milestoneLevel,
  activePolicies,
  onTogglePolicy,
}: PoliciesModalProps) {
  if (!isOpen) return null;

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
              <h2 className="font-serif italic text-sm sm:text-xl text-[#D4AF37]">Municipal Policies</h2>
              <p className="text-[8px] sm:text-[9px] text-gray-400 font-mono uppercase tracking-widest">
                Active Policies: {activePolicies.length}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center"
            aria-label="Close Policies"
          >
            <X size={18} />
          </button>
        </div>

        {/* Policies List */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-2.5 sm:space-y-3 flex-1 custom-scrollbar">
          {POLICIES.map((policy) => {
            const isActive = activePolicies.includes(policy.id);
            const isUnlocked = milestoneLevel >= policy.unlockedMilestoneLevel;
            const milestoneName = MILESTONES[policy.unlockedMilestoneLevel]?.name || 'Village';

            return (
              <div
                key={policy.id}
                className={`p-3 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${
                  isActive
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-white shadow-lg'
                    : isUnlocked
                    ? 'bg-white/5 border-white/10 text-gray-200'
                    : 'bg-black/40 border-white/5 text-gray-500 opacity-60'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h4 className="font-mono text-xs sm:text-sm font-bold">{policy.name}</h4>
                    {policy.dailyUpkeep > 0 ? (
                      <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                        -${policy.dailyUpkeep}/day upkeep
                      </span>
                    ) : (
                      <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                        Free Upkeep
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed">{policy.description}</p>
                  {!isUnlocked && (
                    <span className="text-[9px] font-mono text-red-400 flex items-center gap-1 mt-1">
                      <Lock size={10} /> Requires {milestoneName} Milestone Level
                    </span>
                  )}
                </div>

                {/* Toggle Switch Button */}
                <button
                  disabled={!isUnlocked}
                  onClick={() => onTogglePolicy(policy.id)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-mono text-xs font-bold transition-all shrink-0 min-h-[36px] flex items-center justify-center ${
                    isActive
                      ? 'bg-emerald-500 text-black shadow-md'
                      : isUnlocked
                      ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                      : 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {isActive ? 'Enacted' : isUnlocked ? 'Enact Policy' : 'Locked'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
