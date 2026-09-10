import React, { useState, useEffect } from 'react';
import { X, Sliders, Shield, Laptop, HelpCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface GameSettings {
  difficulty: 'easy' | 'normal' | 'hard';
  autosave: boolean;
  shadowQuality: 'low' | 'medium' | 'high';
  antialiasing: boolean;
  renderScale: number; // 50, 75, 100, 120
  trafficDensity: 'low' | 'medium' | 'high';
  vegetationDensity: 'low' | 'medium' | 'high';
  dayNightCycle: 'enabled' | 'disabled' | 'locked_day' | 'locked_night';
  vsync: boolean;
  volume: number; // 0 to 100
  musicVolume: number; // 0 to 100
}

const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'normal',
  autosave: true,
  shadowQuality: 'medium',
  antialiasing: true,
  renderScale: 100,
  trafficDensity: 'medium',
  vegetationDensity: 'medium',
  dayNightCycle: 'enabled',
  vsync: true,
  volume: 75,
  musicVolume: 50,
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'gameplay' | 'graphics' | 'audio' | 'controls'>('gameplay');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem('skyline_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  const saveSettings = (updated: GameSettings) => {
    setSettings(updated);
    localStorage.setItem('skyline_settings', JSON.stringify(updated));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] px-[calc(env(safe-area-inset-left,0px)+0.75rem)] pr-[calc(env(safe-area-inset-right,0px)+0.75rem)] animate-in fade-in duration-200 select-none">
      <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] text-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-4 border-b border-white/10 bg-black/20 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-blue-400" />
            <h2 className="text-white font-bold text-sm sm:text-base">Game Settings</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center"
            aria-label="Close Settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 p-2 bg-black/15 border-b border-white/10 overflow-x-auto no-scrollbar shrink-0 touch-pan-x">
          <TabButton active={activeTab === 'gameplay'} onClick={() => setActiveTab('gameplay')} label="Gameplay" icon={<Shield size={14} />} />
          <TabButton active={activeTab === 'graphics'} onClick={() => setActiveTab('graphics')} label="Graphics" icon={<Laptop size={14} />} />
          <TabButton active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} label="Audio" icon={<Sliders size={14} />} />
          <TabButton active={activeTab === 'controls'} onClick={() => setActiveTab('controls')} label="Controls" icon={<HelpCircle size={14} />} />
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5 sm:space-y-6 custom-scrollbar">
          
          {activeTab === 'gameplay' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Gameplay Rules</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="Difficulty"
                  value={settings.difficulty}
                  onChange={(val) => saveSettings({ ...settings, difficulty: val as any })}
                  options={[
                    { value: 'easy', label: 'Easy (Bonus Funds & Growth)' },
                    { value: 'normal', label: 'Normal (Standard Balance)' },
                    { value: 'hard', label: 'Hard (Strict Utility & Demands)' },
                  ]}
                />
                <ToggleField
                  label="Auto-Save Game"
                  checked={settings.autosave}
                  onChange={(val) => saveSettings({ ...settings, autosave: val })}
                />
              </div>
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Graphics Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="Shadow Quality"
                  value={settings.shadowQuality}
                  onChange={(val) => saveSettings({ ...settings, shadowQuality: val as any })}
                  options={[
                    { value: 'low', label: 'Low (Performance)' },
                    { value: 'medium', label: 'Medium (Balanced)' },
                    { value: 'high', label: 'High (Cinematic)' },
                  ]}
                />
                <ToggleField
                  label="Anti-Aliasing"
                  checked={settings.antialiasing}
                  onChange={(val) => saveSettings({ ...settings, antialiasing: val })}
                />
                <SelectField
                  label="Render Scale"
                  value={settings.renderScale.toString()}
                  onChange={(val) => saveSettings({ ...settings, renderScale: parseInt(val) })}
                  options={[
                    { value: '50', label: '50% (High Speed)' },
                    { value: '75', label: '75%' },
                    { value: '100', label: '100% (Native)' },
                    { value: '120', label: '120% (Crisp Visuals)' },
                  ]}
                />
                <SelectField
                  label="Day/Night Cycle"
                  value={settings.dayNightCycle}
                  onChange={(val) => saveSettings({ ...settings, dayNightCycle: val as any })}
                  options={[
                    { value: 'enabled', label: 'Dynamic Loop' },
                    { value: 'disabled', label: 'Static Afternoon' },
                    { value: 'locked_day', label: 'Lock Day' },
                    { value: 'locked_night', label: 'Lock Night' },
                  ]}
                />
                <SelectField
                  label="Traffic Density"
                  value={settings.trafficDensity}
                  onChange={(val) => saveSettings({ ...settings, trafficDensity: val as any })}
                  options={[
                    { value: 'low', label: 'Low (Optimized)' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High (Immersive)' },
                  ]}
                />
                <SelectField
                  label="Vegetation Density"
                  value={settings.vegetationDensity}
                  onChange={(val) => saveSettings({ ...settings, vegetationDensity: val as any })}
                  options={[
                    { value: 'low', label: 'Low (Fast)' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High (Lush)' },
                  ]}
                />
                <ToggleField
                  label="V-Sync & Frame Cap"
                  checked={settings.vsync}
                  onChange={(val) => saveSettings({ ...settings, vsync: val })}
                />
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Audio Settings</h3>
              <div className="space-y-4">
                <SliderField
                  label="Master Volume"
                  value={settings.volume}
                  onChange={(v) => saveSettings({ ...settings, volume: v })}
                />
                <SliderField
                  label="Music Volume"
                  value={settings.musicVolume}
                  onChange={(v) => saveSettings({ ...settings, musicVolume: v })}
                />
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Keyboard Bindings</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm font-mono border border-white/5 p-4 rounded-xl bg-black/10">
                <div className="text-gray-400">WASD / Arrows</div>
                <div className="text-white text-right">Camera Pan</div>
                
                <div className="text-gray-400">Mouse Wheel</div>
                <div className="text-white text-right">Zoom In / Out</div>
                
                <div className="text-gray-400">Middle Mouse / Q-E</div>
                <div className="text-white text-right">Orbit / Rotate</div>
                
                <div className="text-gray-400">Right Click</div>
                <div className="text-white text-right">Cancel Placement / tool</div>
                
                <div className="text-gray-400">Space / Key 0</div>
                <div className="text-white text-right">Pause / Resume</div>
                
                <div className="text-gray-400">Keys 1, 2, 3</div>
                <div className="text-white text-right">Adjust Speed Rate</div>
                
                <div className="text-gray-400">Key T</div>
                <div className="text-white text-right">Tech Tree</div>
                
                <div className="text-gray-400">Key P</div>
                <div className="text-white text-right">Policies Panel</div>
                
                <div className="text-gray-400">Key M</div>
                <div className="text-white text-right">Missions / Objectives</div>
                
                <div className="text-gray-400">Key B</div>
                <div className="text-white text-right">Toggle Bulldozer</div>
                
                <div className="text-gray-400">Escape</div>
                <div className="text-white text-right">Close Modals / Deselect</div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
}

// --- Inner Helper UI Components ---

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap min-h-[40px] ${
        active
          ? 'bg-blue-500/20 text-blue-300 font-semibold shadow-inner'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
      <span className="text-sm font-semibold text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full p-0.5 transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-700'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center text-sm font-semibold">
        <span className="text-gray-300">{label}</span>
        <span className="text-white">{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-blue-500"
      />
    </div>
  );
}
