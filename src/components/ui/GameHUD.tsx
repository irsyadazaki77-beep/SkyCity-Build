import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Bell, Smile, Target, Calendar, Users, DollarSign } from 'lucide-react';
import { MILESTONES } from '../../progression';
import { GameMenu } from './GameMenu';

interface GameHUDProps {
  population: number;
  money: number;
  income: number;
  expenses: number;
  speed: number;
  setSpeed: (s: number) => void;
  day: number;
  milestoneLevel: number;
  happiness: number;
  unreadNotificationsCount: number;
  onToggleNotifications: () => void;
  onOpenCityInfo: () => void;
  onOpenEconomy: () => void;
  onOpenTech: () => void;
  onOpenPolicies: () => void;
  onOpenObjectives: () => void;
  onOpenSaveLoad: () => void;
  onOpenSettings: () => void;
  onNewGame: () => void;
}

export function GameHUD({
  population,
  money,
  income,
  expenses,
  speed,
  setSpeed,
  day,
  milestoneLevel,
  happiness,
  unreadNotificationsCount,
  onToggleNotifications,
  onOpenCityInfo,
  onOpenEconomy,
  onOpenTech,
  onOpenPolicies,
  onOpenObjectives,
  onOpenSaveLoad,
  onOpenSettings,
  onNewGame,
}: GameHUDProps) {
  const safePopulation = Math.max(0, isNaN(population) || !isFinite(population) ? 0 : population);
  const safeMoney = isNaN(money) || !isFinite(money) ? 0 : money;
  const netIncome = income - expenses;
  const safeNetIncome = isNaN(netIncome) || !isFinite(netIncome) ? 0 : netIncome;
  const currentMilestone = MILESTONES[milestoneLevel] || MILESTONES[0];

  // Remember the last active playing speed to toggle back to
  const [lastActiveSpeed, setLastActiveSpeed] = useState<number>(1);

  useEffect(() => {
    if (speed > 0) {
      setLastActiveSpeed(speed);
    }
  }, [speed]);

  const togglePlayPause = () => {
    if (speed === 0) {
      setSpeed(lastActiveSpeed);
    } else {
      setSpeed(0);
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
    setSpeed(nextSpeed);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none p-1.5 sm:p-3 pt-[calc(env(safe-area-inset-top,0px)+0.375rem)] px-[calc(env(safe-area-inset-left,0px)+0.5rem)] pr-[calc(env(safe-area-inset-right,0px)+0.5rem)] select-none flex flex-col items-center gap-1.5">
      
      {/* Primary top row: Brand on left, Desktop Stats in center, Time/Actions on right */}
      <div className="flex items-center justify-between w-full gap-1.5 sm:gap-2">
        
        {/* LEFT COMPACT SECTION: City Badge & Level */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 bg-[#0f172a]/95 backdrop-blur-md border border-white/10 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-full shadow-lg shrink-0">
          <span className="text-white font-bold text-xs sm:text-sm font-sans tracking-wide">SkyCity</span>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[8px] sm:text-[9px] font-mono text-blue-300">
            <Target size={10} className="text-blue-400 shrink-0" />
            <span className="max-w-[45px] sm:max-w-none truncate font-bold uppercase tracking-wider">{currentMilestone.name}</span>
          </div>
        </div>

        {/* DESKTOP CENTER STATS SECTION: Unified simulator metrics (Hidden on mobile row, shown on sm+) */}
        <div className="pointer-events-auto hidden sm:flex items-center bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 gap-4 md:gap-6 shadow-lg">
          {/* Treasury */}
          <div className="flex items-center gap-1 cursor-pointer hover:bg-white/5 px-1 py-0.5 rounded-full transition-colors" onClick={onOpenEconomy}>
            <DollarSign size={13} className="text-emerald-400 shrink-0" />
            <div className="flex items-center gap-1">
              <span className="text-white font-bold text-xs sm:text-sm font-mono">${safeMoney.toLocaleString()}</span>
              <span className={`text-[9px] font-mono font-bold ${safeNetIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({safeNetIncome >= 0 ? '+' : ''}${Math.abs(safeNetIncome) >= 1000 ? `${(safeNetIncome / 1000).toFixed(1)}k` : safeNetIncome})
              </span>
            </div>
          </div>

          <div className="w-[1px] h-3 sm:h-4 bg-white/10"></div>

          {/* Population */}
          <div className="flex items-center gap-1">
            <Users size={13} className="text-blue-400 shrink-0" />
            <span className="text-white font-bold text-xs sm:text-sm font-mono">
              {safePopulation >= 1000 ? `${(safePopulation / 1000).toFixed(1)}k` : safePopulation.toLocaleString()}
            </span>
          </div>

          <div className="w-[1px] h-3 sm:h-4 bg-white/10"></div>

          {/* Happiness */}
          <div className="flex items-center gap-1">
            <Smile size={13} className={`shrink-0 ${happiness >= 70 ? 'text-emerald-400' : happiness >= 40 ? 'text-yellow-400' : 'text-rose-400'}`} />
            <span className="text-white font-bold text-xs sm:text-sm font-mono">{happiness}%</span>
          </div>
        </div>

        {/* RIGHT CONTROLS SECTION: Streamlined Time & System Triggers */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          
          {/* Calendar & Space-saving Speed Cycler */}
          <div className="flex items-center bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-full p-0.5 pl-2 sm:pl-2.5 gap-1 sm:gap-1.5 shadow-lg">
            <div className="flex items-center gap-1 text-white font-mono text-[9px] sm:text-xs font-semibold whitespace-nowrap">
              <Calendar size={11} className="text-gray-400 shrink-0" />
              <span>D{day}</span>
            </div>
            
            <div className="w-[1px] h-3 bg-white/10"></div>
            
            {/* Play / Pause Toggle Button */}
            <button 
              onClick={togglePlayPause} 
              className={`p-1 sm:p-1.5 rounded-full transition-all flex items-center justify-center min-h-[26px] min-w-[26px] sm:min-h-[28px] sm:min-w-[28px] ${
                speed === 0 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
              title={speed === 0 ? "Resume Simulation" : "Pause Simulation"}
            >
              {speed === 0 ? <Play size={10} fill="currentColor" /> : <Pause size={10} />}
            </button>

            {/* Cycling Speed multiplier button */}
            <button 
              onClick={cycleSpeed} 
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-mono font-bold transition-all min-h-[26px] sm:min-h-[28px] flex items-center justify-center ${
                speed === 0 
                  ? 'text-gray-500 bg-black/20' 
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
              title="Cycle Game Speed"
              disabled={speed === 0}
            >
              {speed === 2 ? '2x' : speed === 3 ? '3x' : '1x'}
            </button>
          </div>

          {/* Quick Notification Alert Button */}
          <button
            onClick={onToggleNotifications}
            className={`p-1.5 sm:p-2 bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-full text-gray-400 hover:text-white transition-all relative min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center shadow-lg active:scale-95 ${
              unreadNotificationsCount > 0 ? 'text-blue-400 border-blue-500/20' : ''
            }`}
          >
            <Bell size={13} className={unreadNotificationsCount > 0 ? 'animate-bounce text-blue-400' : ''} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-blue-500 text-white text-[7px] font-mono font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[#0f172a]">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          
          {/* Secondary Features Game Menu */}
          <GameMenu
            onOpenCityInfo={onOpenCityInfo}
            onOpenEconomy={onOpenEconomy}
            onOpenTech={onOpenTech}
            onOpenPolicies={onOpenPolicies}
            onOpenObjectives={onOpenObjectives}
            onOpenSaveLoad={onOpenSaveLoad}
            onOpenSettings={onOpenSettings}
            onNewGame={onNewGame}
          />

        </div>

      </div>

      {/* MOBILE CENTER STATS BAR: Dedicated second compact row on small screens */}
      <div className="pointer-events-auto flex sm:hidden items-center bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1 gap-2.5 shadow-lg max-w-full overflow-hidden text-[10px] font-mono">
        {/* Treasury */}
        <div className="flex items-center gap-1 cursor-pointer hover:bg-white/5 rounded-full transition-colors" onClick={onOpenEconomy}>
          <DollarSign size={11} className="text-emerald-400 shrink-0" />
          <span className="text-white font-bold">
            ${safeMoney >= 1000000 ? `${(safeMoney / 1000000).toFixed(1)}M` : safeMoney >= 10000 ? `${(safeMoney / 1000).toFixed(0)}k` : safeMoney.toLocaleString()}
          </span>
          <span className={`text-[8px] font-bold ${safeNetIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ({safeNetIncome >= 0 ? '+' : ''}${Math.abs(safeNetIncome) >= 1000 ? `${(safeNetIncome / 1000).toFixed(0)}k` : safeNetIncome})
          </span>
        </div>

        <div className="w-[1px] h-2.5 bg-white/15"></div>

        {/* Population */}
        <div className="flex items-center gap-1" onClick={onOpenCityInfo}>
          <Users size={11} className="text-blue-400 shrink-0" />
          <span className="text-white font-bold">
            {safePopulation >= 1000 ? `${(safePopulation / 1000).toFixed(1)}k` : safePopulation.toLocaleString()}
          </span>
        </div>

        <div className="w-[1px] h-2.5 bg-white/15"></div>

        {/* Happiness */}
        <div className="flex items-center gap-1">
          <Smile size={11} className={`shrink-0 ${happiness >= 70 ? 'text-emerald-400' : happiness >= 40 ? 'text-yellow-400' : 'text-rose-400'}`} />
          <span className="text-white font-bold">{happiness}%</span>
        </div>
      </div>

    </header>
  );
}
