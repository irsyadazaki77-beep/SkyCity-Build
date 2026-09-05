import React from 'react';
import { TileType } from '../types';

interface Building3DProps {
  type: TileType;
  population: number;
  jobs: number;
  level: number;
  traffic: number;
  powered: boolean;
  watered: boolean;
  abandoned?: boolean;
}

export function Building3D({ type, population, jobs, level, traffic, powered, watered, abandoned }: Building3DProps) {
  // Determine height and visual attributes based on type, level, and occupants
  let height = 0;
  let topColor = '#14161A';
  let sideColorLeft = '#0F1115';
  let sideColorRight = '#1C1F26';
  let hasWindows = false;
  let isRound = false;

  const safeLevel = Math.max(1, isNaN(level) || !isFinite(level) ? 1 : level);
  const safePopulation = Math.max(0, isNaN(population) || !isFinite(population) ? 0 : population);
  const safeJobs = Math.max(0, isNaN(jobs) || !isFinite(jobs) ? 0 : jobs);

  if (abandoned) {
    // Abandoned building rendering
    height = 10 + safeLevel * 6;
    topColor = '#475569'; // Slate dark gray
    sideColorLeft = '#1e293b';
    sideColorRight = '#334155';
    hasWindows = false;
  } else {
    switch (type) {
      case TileType.RESIDENTIAL:
        if (safePopulation > 0) {
          // Height grows dynamically with level 1 to 5
          height = 8 + safeLevel * 10 + Math.min(20, safePopulation * 0.8);
          if (safeLevel === 5) {
            topColor = '#10b981'; // Emerald skyscraper crown
            sideColorLeft = '#047857';
            sideColorRight = '#065f46';
          } else if (safeLevel >= 3) {
            topColor = '#34d399';
            sideColorLeft = '#059669';
            sideColorRight = '#047857';
          } else {
            topColor = '#4ade80'; // Cottage / Townhouse
            sideColorLeft = '#166534';
            sideColorRight = '#15803d';
          }
          hasWindows = true;
        }
        break;

      case TileType.COMMERCIAL:
        if (powered && watered && safeJobs > 0) {
          // Commercial towers scaled through Level 1 to 5
          height = 10 + safeLevel * 14 + Math.min(25, safeJobs * 0.8);
          if (safeLevel === 5) {
            topColor = '#38bdf8'; // Crystal skyscraper spire
            sideColorLeft = '#0369a1';
            sideColorRight = '#075985';
          } else if (safeLevel >= 3) {
            topColor = '#60a5fa';
            sideColorLeft = '#1e3a8a';
            sideColorRight = '#1d4ed8';
          } else {
            topColor = '#93c5fd';
            sideColorLeft = '#2563eb';
            sideColorRight = '#1d4ed8';
          }
          hasWindows = true;
        }
        break;

      case TileType.INDUSTRIAL:
        if (powered && watered && safeJobs > 0) {
          // Factories & High-Tech Industrial Hubs
          if (safeLevel >= 4) {
            // Clean High-Tech Industry
            height = 16 + safeLevel * 8;
            topColor = '#a7f3d0'; // Mint green clean solar roofs
            sideColorLeft = '#0f766e';
            sideColorRight = '#115e59';
          } else {
            // Heavy Industrial
            height = 10 + safeLevel * 8;
            topColor = '#fbbf24'; // Yellow industrial tops
            sideColorLeft = '#78350f';
            sideColorRight = '#b45309';
          }
        }
        break;

      case TileType.PARK:
        height = 6; // Green park plaza
        topColor = '#15803d'; // Lush park green
        sideColorLeft = '#14532d';
        sideColorRight = '#166534';
        break;

      case TileType.POWER_PLANT:
        height = 45; // Tall cooling tower
        topColor = '#a855f7'; // Purple reactor details
        sideColorLeft = '#581c87';
        sideColorRight = '#7e22ce';
        isRound = true; // Cylindrical reactor tower
        break;

      case TileType.WATER_PUMP:
        height = 25; // Compact blue filtration tank
        topColor = '#06b6d4'; // Cyan tank top
        sideColorLeft = '#155e75';
        sideColorRight = '#0e7490';
        break;

      case TileType.FIRE_STATION:
        height = 22; // Firehouse with bay
        topColor = '#ef4444'; // Red roof
        sideColorLeft = '#991b1b';
        sideColorRight = '#b91c1c';
        break;

      case TileType.POLICE_STATION:
        height = 24; // Police HQ
        topColor = '#3b82f6'; // Police blue roof
        sideColorLeft = '#1e3a8a';
        sideColorRight = '#1d4ed8';
        break;

      case TileType.CLINIC:
        height = 26; // Medical facility
        topColor = '#f8fafc'; // White/clean roof
        sideColorLeft = '#0f766e';
        sideColorRight = '#14b8a6';
        break;

      case TileType.SCHOOL:
        height = 20; // Schoolhouse
        topColor = '#f59e0b'; // Amber/warm terracotta roof
        sideColorLeft = '#7c2d12';
        sideColorRight = '#9a3412';
        break;

      case TileType.WASTE_MANAGEMENT:
        height = 28; // Waste processing plant
        topColor = '#64748b'; // Slate recycling center
        sideColorLeft = '#334155';
        sideColorRight = '#475569';
        break;

      default:
        break;
    }
  }

  if (height === 0) return null;

  const finalHeight = height;

  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ 
        transformStyle: 'preserve-3d',
        transform: `translateZ(0px)`
      }}
    >
      <div 
        className="absolute inset-0"
        style={{ 
          transformStyle: 'preserve-3d',
          transform: `translateZ(0px)`
        }}
      >
        {/* Top Face */}
        <div 
          className={`absolute inset-0 border border-black/15 shadow-inner transition-all duration-300 ${isRound ? 'rounded-full' : ''}`}
          style={{ 
            backgroundColor: topColor, 
            transform: `translateZ(${finalHeight}px)`,
          }}
        >
          {/* Accent detail on top */}
          {!isRound && type === TileType.COMMERCIAL && (
            <div className="absolute inset-2 bg-[#1e293b]/50 border border-white/10 rounded-sm flex items-center justify-center">
              <div className="w-1 h-1 bg-[#fbbf24] animate-ping" />
            </div>
          )}

          {/* Fire Station Roof Siren/Cross */}
          {type === TileType.FIRE_STATION && (
            <div className="absolute inset-2 border border-red-300/40 rounded flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-red-200 rounded-full animate-pulse shadow-[0_0_4px_#ef4444]" />
            </div>
          )}

          {/* Police Station Beacon */}
          {type === TileType.POLICE_STATION && (
            <div className="absolute inset-2 border border-blue-300/40 rounded flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse shadow-[0_0_4px_#3b82f6]" />
            </div>
          )}

          {/* Clinic Medical Cross */}
          {type === TileType.CLINIC && (
            <div className="absolute inset-2 flex items-center justify-center">
              <div className="relative w-3 h-3 flex items-center justify-center">
                <div className="absolute w-3 h-1 bg-red-500 rounded-xs" />
                <div className="absolute w-1 h-3 bg-red-500 rounded-xs" />
              </div>
            </div>
          )}

          {/* School Clock / Roof Badge */}
          {type === TileType.SCHOOL && (
            <div className="absolute inset-2 border border-amber-200/50 rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-amber-100/80 rounded-full border border-amber-700/50" />
            </div>
          )}

          {/* Waste Management Facility Silhouette */}
          {type === TileType.WASTE_MANAGEMENT && (
            <div className="absolute inset-2 border border-slate-400/50 rounded flex items-center justify-center gap-0.5">
              <div className="w-1.5 h-2 bg-emerald-600/80 rounded-xs" />
              <div className="w-1.5 h-2 bg-slate-600/80 rounded-xs" />
            </div>
          )}
        </div>

        {/* Left Side Face */}
        <div 
          className={`absolute inset-y-0 left-0 border border-black/20 origin-left transition-all duration-300 ${isRound ? 'rounded-l-full' : ''}`}
          style={{ 
            backgroundColor: sideColorLeft, 
            width: `${finalHeight}px`,
            transform: `rotateY(-90deg)`,
          }}
        >
          {/* Windows / Windows Grid */}
          {hasWindows && (
            <div className="w-full h-full p-1 grid grid-cols-3 gap-0.5 opacity-80 overflow-hidden">
              {Array.from({ length: Math.min(12, Math.floor(finalHeight / 6)) }).map((_, i) => (
                <React.Fragment key={i}>
                  <div className={`w-1 h-1 rounded-sm ${powered ? 'bg-yellow-200/90 shadow-[0_0_2px_#fef08a]' : 'bg-gray-800'}`} />
                  <div className={`w-1 h-1 rounded-sm ${powered ? 'bg-yellow-200/90 shadow-[0_0_2px_#fef08a]' : 'bg-gray-800'}`} />
                  <div className={`w-1 h-1 rounded-sm ${powered ? 'bg-yellow-100/50' : 'bg-gray-800'}`} />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Right Side Face */}
        <div 
          className={`absolute inset-x-0 bottom-0 border border-black/20 origin-bottom transition-all duration-300 ${isRound ? 'rounded-b-full' : ''}`}
          style={{ 
            backgroundColor: sideColorRight, 
            height: `${finalHeight}px`,
            transform: `rotateX(90deg)`,
          }}
        >
          {/* Windows / Windows Grid */}
          {hasWindows && (
            <div className="w-full h-full p-1 grid grid-cols-3 gap-0.5 opacity-80 overflow-hidden">
              {Array.from({ length: Math.min(12, Math.floor(finalHeight / 6)) }).map((_, i) => (
                <React.Fragment key={i}>
                  <div className={`w-1 h-1 rounded-sm ${powered ? 'bg-yellow-200/90 shadow-[0_0_2px_#fef08a]' : 'bg-gray-800'}`} />
                  <div className={`w-1 h-1 rounded-sm ${powered ? 'bg-yellow-100/50' : 'bg-gray-800'}`} />
                  <div className={`w-1 h-1 rounded-sm ${powered ? 'bg-yellow-200/90 shadow-[0_0_2px_#fef08a]' : 'bg-gray-800'}`} />
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
