import React, { useState } from 'react';
import { TECH_NODES, MILESTONES, TechNode } from '../progression';
import { X, Cpu, Check, Lock, ArrowRight, Zap, Layers, DollarSign, Trees, Grid } from 'lucide-react';

interface TechTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  money: number;
  unlockedUpgrades: string[];
  milestoneLevel: number;
  onUnlockTech: (id: string, cost: number) => void;
}

export function TechTreeModal({
  isOpen,
  onClose,
  money,
  unlockedUpgrades,
  milestoneLevel,
  onUnlockTech,
}: TechTreeModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    'Infrastructure' | 'Utilities' | 'Zoning' | 'Economy' | 'Environment'
  >('Infrastructure');

  if (!isOpen) return null;

  const filteredNodes = TECH_NODES.filter((n) => n.category === selectedCategory);

  const categories = [
    { id: 'Infrastructure', label: 'Infrastructure', icon: <Grid size={14} /> },
    { id: 'Utilities', label: 'Utilities', icon: <Zap size={14} /> },
    { id: 'Zoning', label: 'Zoning', icon: <Layers size={14} /> },
    { id: 'Economy', label: 'Economy', icon: <DollarSign size={14} /> },
    { id: 'Environment', label: 'Environment', icon: <Trees size={14} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl text-[#D4AF37]">
              <Cpu size={22} />
            </div>
            <div>
              <h2 className="font-serif italic text-xl text-[#D4AF37]">City Tech Tree & Innovations</h2>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                Research Prerequisite Tech • Current Milestone: {MILESTONES[milestoneLevel]?.name || 'Village'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Tabs Bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 bg-black/30 overflow-x-auto shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#D4AF37] text-black font-bold shadow'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Tech Tree Nodes List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNodes.map((node) => {
              const isUnlocked = unlockedUpgrades.includes(node.id);
              const prereqMet = !node.prerequisiteId || unlockedUpgrades.includes(node.prerequisiteId);
              const milestoneMet = milestoneLevel >= node.requiredMilestoneLevel;
              const canAfford = money >= node.cost;

              const prereqNode = node.prerequisiteId ? TECH_NODES.find((t) => t.id === node.prerequisiteId) : null;
              const milestoneName = MILESTONES[node.requiredMilestoneLevel]?.name || 'Village';

              return (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isUnlocked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100'
                      : prereqMet && milestoneMet
                      ? 'bg-white/5 border-white/10 text-white'
                      : 'bg-black/40 border-white/5 text-gray-500 opacity-60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isUnlocked ? (
                          <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                            <Check size={16} />
                          </div>
                        ) : !prereqMet || !milestoneMet ? (
                          <div className="p-1.5 bg-gray-800 rounded-lg text-gray-400">
                            <Lock size={16} />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
                            <Cpu size={16} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-mono text-sm font-bold">{node.name}</h4>
                          <span className="text-[9px] uppercase font-mono tracking-wider opacity-75 text-gray-400">
                            {node.category}
                          </span>
                        </div>
                      </div>

                      <span className="font-mono text-xs font-bold text-[#D4AF37]">
                        ${node.cost.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed">{node.description}</p>

                    {/* Prerequisite & Milestone Badges */}
                    <div className="flex flex-wrap gap-2 text-[9px] font-mono pt-1">
                      {prereqNode && (
                        <div
                          className={`px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                            unlockedUpgrades.includes(node.prerequisiteId!)
                              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                              : 'bg-red-950/40 border-red-500/30 text-red-300'
                          }`}
                        >
                          Requires: {prereqNode.name}
                        </div>
                      )}

                      <div
                        className={`px-2 py-0.5 rounded-full border ${
                          milestoneMet
                            ? 'bg-blue-950/40 border-blue-500/30 text-blue-300'
                            : 'bg-red-950/40 border-red-500/30 text-red-300'
                        }`}
                      >
                        Requires: {milestoneName} Milestone
                      </div>
                    </div>
                  </div>

                  {/* Unlock Button */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                    {isUnlocked ? (
                      <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                        <Check size={14} /> Researched
                      </span>
                    ) : (
                      <button
                        disabled={!prereqMet || !milestoneMet || !canAfford}
                        onClick={() => onUnlockTech(node.id, node.cost)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                          prereqMet && milestoneMet && canAfford
                            ? 'bg-[#D4AF37] text-black hover:bg-[#c29f2e] shadow-md cursor-pointer'
                            : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {!prereqMet
                          ? 'Prerequisite Locked'
                          : !milestoneMet
                          ? 'Milestone Locked'
                          : !canAfford
                          ? 'Insufficient Funds'
                          : 'Research Tech'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
