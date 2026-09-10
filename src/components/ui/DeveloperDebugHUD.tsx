import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Layers, Car, Users, Zap, Eye, Settings2, Grid, Hammer, RefreshCw } from 'lucide-react';
import { GraphicsQualityTier, EngineProfilerMetrics, WorldRevisions } from '../../types';

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
  profilerMetrics?: EngineProfilerMetrics;
  revisions?: WorldRevisions;

  // Visual regression & developer debug toggles
  showChunkBoundaries?: boolean;
  onToggleChunkBoundaries?: (val: boolean) => void;
  showTerrainLOD?: boolean;
  onToggleTerrainLOD?: (val: boolean) => void;
  showRoadSegments?: boolean;
  onToggleRoadSegments?: (val: boolean) => void;
  showWaterMask?: boolean;
  onToggleWaterMask?: (val: boolean) => void;
  showShorelineContour?: boolean;
  onToggleShorelineContour?: (val: boolean) => void;
  showWaterRegions?: boolean;
  onToggleWaterRegions?: (val: boolean) => void;
  showRoadWaterIntersections?: boolean;
  onToggleRoadWaterIntersections?: (val: boolean) => void;
  showInvalidVegetation?: boolean;
  onToggleInvalidVegetation?: (val: boolean) => void;
}

export function DeveloperDebugHUD({
  simulationTimeMs = 1.8,
  activeVehiclesCount = 0,
  activePedestriansCount = 0,
  populationCount = 0,
  householdsCount = 0,
  graphicsQuality = 'high',
  onGraphicsQualityChange,
  isWorkerActive = false,
  totalBuildingsCount = 0,
  activeChunksCount = 25,
  profilerMetrics,
  revisions,
  showChunkBoundaries = false,
  onToggleChunkBoundaries,
  showTerrainLOD = false,
  onToggleTerrainLOD,
  showRoadSegments = false,
  onToggleRoadSegments,
  showWaterMask = false,
  onToggleWaterMask,
  showShorelineContour = false,
  onToggleShorelineContour,
  showWaterRegions = false,
  onToggleWaterRegions,
  showRoadWaterIntersections = false,
  onToggleRoadWaterIntersections,
  showInvalidVegetation = false,
  onToggleInvalidVegetation,
}: DeveloperDebugHUDProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFps, setCurrentFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);
  const [webgl, setWebgl] = useState({ drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });

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
        
        if ((window as any).__WEBGL_METRICS__) {
          setWebgl({ ...(window as any).__WEBGL_METRICS__ });
        }
        
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const terrainRebuilds = profilerMetrics?.terrainRebuildCount ?? 0;
  const roadRebuilds = profilerMetrics?.roadRebuildCount ?? 0;
  const buildingRebuilds = profilerMetrics?.buildingBatchUpdateCount ?? 0;
  const workerMsgSize = profilerMetrics?.workerMessageSize ?? 0;
  const changedChunks = profilerMetrics?.changedChunksPerTick ?? 0;
  const visibleChunks = profilerMetrics?.visibleChunks ?? activeChunksCount;
  const drawCalls = profilerMetrics?.drawCalls ?? (graphicsQuality === 'low' ? 14 : 24);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:bottom-3 right-[calc(env(safe-area-inset-right,0px)+0.75rem)] z-35 bg-slate-900/90 backdrop-blur-md text-emerald-400 border border-emerald-500/30 rounded-full sm:rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 text-[9px] sm:text-xs font-mono flex items-center gap-1 sm:gap-1.5 shadow-lg hover:bg-slate-800 transition-colors min-h-[28px] sm:min-h-[32px]"
      >
        <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse shrink-0" />
        <span>{currentFps} FPS ({frameTimeMs}ms)</span>
        {isWorkerActive && <span className="text-[8px] sm:text-[9px] text-sky-400 ml-0.5 font-bold">WORKER</span>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:bottom-3 right-[calc(env(safe-area-inset-right,0px)+0.75rem)] left-[calc(env(safe-area-inset-left,0px)+0.75rem)] sm:left-auto z-35 bg-slate-900/95 backdrop-blur-xl text-slate-200 border border-slate-700/60 rounded-2xl p-3 shadow-2xl font-mono text-[10px] sm:text-xs max-w-sm sm:w-88 max-h-[50vh] sm:max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Cpu className="w-4 h-4" />
          <span>PROFILER & INCREMENTAL ENGINE</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded text-xs bg-slate-800 hover:bg-slate-700"
        >
          Hide
        </button>
      </div>

      <div className="space-y-1.5">
        {/* FPS & Simulation Timing */}
        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Frame Rate:
          </span>
          <span className={`font-semibold ${currentFps >= 55 ? 'text-emerald-400' : currentFps >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
            {currentFps} FPS ({frameTimeMs} ms)
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Sim Tick Time:
          </span>
          <span className="font-semibold text-sky-400">
            {simulationTimeMs.toFixed(2)} ms {isWorkerActive ? <span className="text-[10px] text-emerald-400">(Worker Thread)</span> : <span className="text-[10px] text-amber-400">(Main Thread)</span>}
          </span>
        </div>

        {/* Incremental Rebuild Counters */}
        <div className="border-t border-slate-800 pt-1.5 mt-1.5 space-y-1">
          <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            <Hammer className="w-3 h-3" /> INCREMENTAL REBUILD COUNTERS
          </div>

          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Terrain Rebuilds:</span>
            <span className={`font-semibold ${terrainRebuilds === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {terrainRebuilds} {terrainRebuilds === 0 && <span className="text-[10px] text-slate-500">(0 on tick)</span>}
            </span>
          </div>

          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Road Network Rebuilds:</span>
            <span className={`font-semibold ${roadRebuilds === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {roadRebuilds} {roadRebuilds === 0 && <span className="text-[10px] text-slate-500">(0 on tick)</span>}
            </span>
          </div>

          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Building Batch Updates:</span>
            <span className="font-semibold text-sky-400">
              {buildingRebuilds}
            </span>
          </div>

          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Worker Payload Size:</span>
            <span className="text-emerald-300">
              {workerMsgSize > 1024 ? `${(workerMsgSize / 1024).toFixed(1)} KB` : `${workerMsgSize} bytes`}
            </span>
          </div>

          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Changed Chunks / Tick:</span>
            <span className="text-slate-200">{changedChunks}</span>
          </div>
        </div>

        {/* Revisions tracking */}
        {revisions && (
          <div className="border-t border-slate-800 pt-1.5 mt-1.5 space-y-0.5 text-[11px] text-slate-400">
            <div className="text-sky-400 font-bold flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> WORLD REVISION COUNTERS
            </div>
            <div className="grid grid-cols-3 gap-1 pt-1">
              <div className="bg-slate-800/80 px-1.5 py-0.5 rounded text-center">
                <div className="text-[9px] text-slate-400">Terrain</div>
                <div className="font-bold text-white">r{revisions.terrainRevision}</div>
              </div>
              <div className="bg-slate-800/80 px-1.5 py-0.5 rounded text-center">
                <div className="text-[9px] text-slate-400">Road</div>
                <div className="font-bold text-white">r{revisions.roadRevision}</div>
              </div>
              <div className="bg-slate-800/80 px-1.5 py-0.5 rounded text-center">
                <div className="text-[9px] text-slate-400">Building</div>
                <div className="font-bold text-white">r{revisions.buildingRevision}</div>
              </div>
            </div>
          </div>
        )}

        {/* 3D Geometry & Frustum Culling */}
        <div className="border-t border-slate-800 pt-1.5 mt-1.5 space-y-1 text-slate-400">
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-400" /> Visible Chunks (Frustum):
            </span>
            <span className="text-white font-semibold">{visibleChunks} / 25</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-cyan-400" /> Draw Calls:
            </span>
            <span className="text-emerald-400 font-bold">{webgl.drawCalls || drawCalls} calls</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-fuchsia-400" /> Triangles:
            </span>
            <span className="text-white font-semibold">
              {webgl.triangles > 1000000 
                ? `${(webgl.triangles / 1000000).toFixed(2)}M` 
                : webgl.triangles > 1000 
                  ? `${(webgl.triangles / 1000).toFixed(1)}K` 
                  : webgl.triangles}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400" /> Geos / Mats:
            </span>
            <span className="text-slate-300 font-semibold">{webgl.geometries} / {webgl.textures}</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-cyan-400" /> Citizens / HH:
            </span>
            <span className="text-slate-200">{populationCount} / {householdsCount}</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <Car className="w-3 h-3 text-rose-400" /> Active Agents:
            </span>
            <span className="text-slate-200">{activeVehiclesCount} veh / {activePedestriansCount} ped</span>
          </div>
        </div>

        {/* Quality Preset Control */}
        {onGraphicsQualityChange && (
          <div className="border-t border-slate-800 pt-2 mt-2">
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <span className="flex items-center gap-1 text-slate-400">
                <Settings2 className="w-3 h-3 text-amber-400" /> Graphics Quality:
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

        {/* Developer Overlays & Debug Toggles */}
        <div className="border-t border-slate-800 pt-2 mt-2">
          <div className="text-[11px] font-bold text-sky-400 mb-1.5 flex items-center gap-1">
            <Grid className="w-3.5 h-3.5" /> DEVELOPER DEBUG OVERLAYS
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {onToggleChunkBoundaries && (
              <button
                onClick={() => onToggleChunkBoundaries(!showChunkBoundaries)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showChunkBoundaries
                    ? 'bg-purple-900/60 border-purple-500/80 text-purple-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Chunk Bounds</span>
                <span className="font-bold">{showChunkBoundaries ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleTerrainLOD && (
              <button
                onClick={() => onToggleTerrainLOD(!showTerrainLOD)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showTerrainLOD
                    ? 'bg-emerald-900/60 border-emerald-500/80 text-emerald-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Terrain LOD</span>
                <span className="font-bold">{showTerrainLOD ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleRoadSegments && (
              <button
                onClick={() => onToggleRoadSegments(!showRoadSegments)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showRoadSegments
                    ? 'bg-cyan-900/60 border-cyan-500/80 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Road Splines</span>
                <span className="font-bold">{showRoadSegments ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleWaterMask && (
              <button
                onClick={() => onToggleWaterMask(!showWaterMask)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showWaterMask
                    ? 'bg-blue-900/60 border-blue-500/80 text-blue-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Water Mask</span>
                <span className="font-bold">{showWaterMask ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleShorelineContour && (
              <button
                onClick={() => onToggleShorelineContour(!showShorelineContour)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showShorelineContour
                    ? 'bg-fuchsia-900/60 border-fuchsia-500/80 text-fuchsia-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Shore Contour</span>
                <span className="font-bold">{showShorelineContour ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleWaterRegions && (
              <button
                onClick={() => onToggleWaterRegions(!showWaterRegions)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showWaterRegions
                    ? 'bg-sky-900/60 border-sky-500/80 text-sky-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Water Regions</span>
                <span className="font-bold">{showWaterRegions ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleRoadWaterIntersections && (
              <button
                onClick={() => onToggleRoadWaterIntersections(!showRoadWaterIntersections)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showRoadWaterIntersections
                    ? 'bg-orange-900/60 border-orange-500/80 text-orange-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Bridge Intersects</span>
                <span className="font-bold">{showRoadWaterIntersections ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {onToggleInvalidVegetation && (
              <button
                onClick={() => onToggleInvalidVegetation(!showInvalidVegetation)}
                className={`px-2 py-1 rounded text-[10px] text-center border flex flex-col items-center justify-center transition-colors ${
                  showInvalidVegetation
                    ? 'bg-rose-900/60 border-rose-500/80 text-rose-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Veg Mask Check</span>
                <span className="font-bold">{showInvalidVegetation ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
