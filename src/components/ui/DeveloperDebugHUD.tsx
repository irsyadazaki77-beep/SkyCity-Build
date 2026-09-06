import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Layers, Car, Users, Zap, Eye, Settings2, Grid, Route, Box } from 'lucide-react';
import { GraphicsQualityTier } from '../../types';

interface DeveloperDebugHUDProps {
  simulationTimeMs?: number;
  activeVehiclesCount?: number;
  activePedestriansCount?: number;
  populationCount?: number;
  householdsCount?: number;
  day?: number;
  fps?: number;
  graphicsQuality?: GraphicsQualityTier;
  onGraphicsQualityChange?: (tier: GraphicsQualityTier) => void;
  isWorkerActive?: boolean;
  totalBuildingsCount?: number;
  activeChunksCount?: number;

  // Visual regression & developer debug toggles
  showChunkBoundaries?: boolean;
  onToggleChunkBoundaries?: (val: boolean) => void;
  showTerrainLOD?: boolean;
  onToggleTerrainLOD?: (val: boolean) => void;
  showRoadSegments?: boolean;
  onToggleRoadSegments?: (val: boolean) => void;
}

export function DeveloperDebugHUD({
  simulationTimeMs = 1.8,
  activeVehiclesCount = 0,
  activePedestriansCount = 0,
  populationCount = 0,
  householdsCount = 0,
  day = 1,
  fps = 60,
  graphicsQuality = 'high',
  onGraphicsQualityChange,
  isWorkerActive = false,
  totalBuildingsCount = 0,
  activeChunksCount = 16,
  showChunkBoundaries = false,
  onToggleChunkBoundaries,
  showTerrainLOD = false,
  onToggleTerrainLOD,
  showRoadSegments = false,
  onToggleRoadSegments,
}: DeveloperDebugHUDProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFps, setCurrentFps] = useState(fps);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);

  // HUD Visibility Toggles for Detailed Metrics
  const [showDrawCallsMetric, setShowDrawCallsMetric] = useState(true);
  const [showTrianglesMetric, setShowTrianglesMetric] = useState(true);
  const [showVisibleInstancesMetric, setShowVisibleInstancesMetric] = useState(true);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = () => {
      frameCount++;
      const now = performance.now();
      const delta = now - lastTime;
      if (delta >= 1000) {
        const computedFps = Math.round((frameCount * 1000) / delta);
        setCurrentFps(computedFps);
        setFrameTimeMs(parseFloat((1000 / Math.max(1, computedFps)).toFixed(1)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Approximations for instanced rendering stats
  const estimatedDrawCalls = graphicsQuality === 'low' ? 14 : graphicsQuality === 'medium' ? 20 : 26;
  const estimatedTriangles = totalBuildingsCount * 120 + activeChunksCount * (graphicsQuality === 'low' ? 512 : 1024);
  const visibleInstancesCount = totalBuildingsCount + (activeChunksCount * 4);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 right-3 z-40 bg-slate-900/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs font-mono flex items-center gap-1.5 shadow-lg hover:bg-slate-800 transition-colors"
      >
        <Activity className="w-3.5 h-3.5 animate-pulse" />
        <span>{currentFps} FPS ({frameTimeMs}ms)</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-40 bg-slate-900/95 backdrop-blur-md text-slate-200 border border-slate-700/60 rounded-xl p-3 shadow-2xl font-mono text-xs w-84 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Cpu className="w-4 h-4" />
          <span>ENGINE METRICS & QUALITY</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded text-xs bg-slate-800 hover:bg-slate-700"
        >
          Hide
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Frame Rate:
          </span>
          <span className={`font-semibold ${currentFps >= 55 ? 'text-emerald-400' : currentFps >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
            {currentFps} FPS ({frameTimeMs} ms/f)
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Sim Tick Time:
          </span>
          <span className="font-semibold text-sky-400">
            {simulationTimeMs.toFixed(2)} ms {isWorkerActive && <span className="text-[10px] text-emerald-400">(Worker)</span>}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Active Chunks:
          </span>
          <span className="text-white">{activeChunksCount} Chunks</span>
        </div>

        {showVisibleInstancesMetric && (
          <div className="flex justify-between items-center text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Eye className="w-3.5 h-3.5 text-cyan-400" /> Visible Instances:
            </span>
            <span className="text-white">{visibleInstancesCount} (Buildings: {totalBuildingsCount})</span>
          </div>
        )}

        <div className="border-t border-slate-800 pt-1.5 mt-1.5 space-y-1 text-slate-400">
          {showDrawCallsMetric && (
            <div className="flex justify-between">
              <span>Draw Calls:</span>
              <span className="text-emerald-400 font-bold">~{estimatedDrawCalls} calls</span>
            </div>
          )}

          {showTrianglesMetric && (
            <div className="flex justify-between">
              <span>Triangle Count:</span>
              <span className="text-sky-300 font-semibold">~{(estimatedTriangles / 1000).toFixed(1)}k Tris</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-cyan-400" /> Citizens / HH:
            </span>
            <span className="text-slate-200">{populationCount} / {householdsCount}</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Car className="w-3 h-3 text-rose-400" /> Vehicles / Pedestrians:
            </span>
            <span className="text-slate-200">{activeVehiclesCount} / {activePedestriansCount}</span>
          </div>
        </div>

        {/* Quality Preset Control */}
        {onGraphicsQualityChange && (
          <div className="border-t border-slate-800 pt-2 mt-2">
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <span className="flex items-center gap-1 text-slate-400">
                <Settings2 className="w-3 h-3 text-amber-400" /> Quality Tier:
              </span>
              <span className="uppercase text-[11px] font-bold text-amber-400">{graphicsQuality}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['low', 'medium', 'high', 'ultra'] as GraphicsQualityTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => onGraphicsQualityChange(tier)}
                  className={`px-1.5 py-1 rounded text-[10px] uppercase font-bold transition-colors ${
                    graphicsQuality === tier
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Developer Inspection Overlays & Debug Toggles */}
        <div className="border-t border-slate-800 pt-2 mt-2">
          <div className="text-[11px] font-bold text-sky-400 mb-1.5 flex items-center gap-1">
            <Grid className="w-3.5 h-3.5" /> DEVELOPER DEBUG OVERLAYS
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {onToggleChunkBoundaries && (
              <button
                onClick={() => onToggleChunkBoundaries(!showChunkBoundaries)}
                className={`px-2 py-1 rounded text-[10px] text-left border flex items-center justify-between transition-colors ${
                  showChunkBoundaries
                    ? 'bg-purple-900/60 border-purple-500/80 text-purple-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Chunk Bounds</span>
                <span>{showChunkBoundaries ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleTerrainLOD && (
              <button
                onClick={() => onToggleTerrainLOD(!showTerrainLOD)}
                className={`px-2 py-1 rounded text-[10px] text-left border flex items-center justify-between transition-colors ${
                  showTerrainLOD
                    ? 'bg-emerald-900/60 border-emerald-500/80 text-emerald-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Terrain Wire/LOD</span>
                <span>{showTerrainLOD ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleRoadSegments && (
              <button
                onClick={() => onToggleRoadSegments(!showRoadSegments)}
                className={`px-2 py-1 rounded text-[10px] text-left border flex items-center justify-between transition-colors ${
                  showRoadSegments
                    ? 'bg-cyan-900/60 border-cyan-500/80 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Road Segments</span>
                <span>{showRoadSegments ? 'ON' : 'OFF'}</span>
              </button>
            )}

            <button
              onClick={() => setShowDrawCallsMetric(!showDrawCallsMetric)}
              className={`px-2 py-1 rounded text-[10px] text-left border flex items-center justify-between transition-colors ${
                showDrawCallsMetric
                  ? 'bg-amber-900/60 border-amber-500/80 text-amber-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Draw Calls</span>
              <span>{showDrawCallsMetric ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setShowTrianglesMetric(!showTrianglesMetric)}
              className={`px-2 py-1 rounded text-[10px] text-left border flex items-center justify-between transition-colors ${
                showTrianglesMetric
                  ? 'bg-blue-900/60 border-blue-500/80 text-blue-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Tris Count</span>
              <span>{showTrianglesMetric ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setShowVisibleInstancesMetric(!showVisibleInstancesMetric)}
              className={`px-2 py-1 rounded text-[10px] text-left border flex items-center justify-between transition-colors ${
                showVisibleInstancesMetric
                  ? 'bg-rose-900/60 border-rose-500/80 text-rose-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Instances Count</span>
              <span>{showVisibleInstancesMetric ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

