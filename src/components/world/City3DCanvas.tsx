import React, { useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import {
  TileData,
  TileType,
  OverlayMode,
  SimulatedVehicle,
  SimulatedPedestrian,
  GraphicsQualityTier,
  WorldRevisions,
} from '../../types';
import { DayNightSky } from './DayNightSky';
import { CameraController } from './CameraController';
import { ChunkTerrainRenderer } from '../../rendering/ChunkTerrainRenderer';
import { SplineRoadRenderer } from '../../rendering/SplineRoadRenderer';
import { InstancedBuildingRenderer } from '../../rendering/InstancedBuildingRenderer';
import { EnvironmentProps } from './EnvironmentProps';
import { InstancedVehicleRenderer } from '../../rendering/InstancedVehicleRenderer';
import { InstancedPedestrianRenderer } from '../../rendering/InstancedPedestrianRenderer';

export interface City3DCanvasProps {
  grid: TileData[][];
  revisions: WorldRevisions;
  dirtyTerrainChunks?: Set<string>;
  dirtyRoadChunks?: Set<string>;
  dirtyBuildingChunks?: Set<string>;
  day: number;
  speed: number;
  activeTool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  unlockedRegions?: string[];
  viewMode: '2D' | '3D';
  zoom: number;
  pitch: number;
  rotation: number;
  mapExpansionMode?: boolean;
  brushSize?: number;
  graphicsQuality?: GraphicsQualityTier;
  showChunkBoundaries?: boolean;
  showTerrainLOD?: boolean;
  showRoadSegments?: boolean;
  onTileAction: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  onUnlockRegion?: (rx: number, ry: number) => void;
  onChunkRebuild?: (count: number) => void;
  onRoadRebuild?: (count: number) => void;
  onBuildingBatchUpdate?: (count: number) => void;
  onVisibleChunksChange?: (count: number) => void;
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
  activeVehicles?: SimulatedVehicle[];
  activePedestrians?: SimulatedPedestrian[];
}

function City3DCanvasBase({
  grid,
  revisions,
  dirtyTerrainChunks,
  day,
  speed,
  activeTool,
  activeOverlay = 'NONE',
  viewMode,
  zoom,
  pitch,
  rotation,
  brushSize = 1,
  graphicsQuality = 'high',
  showChunkBoundaries = false,
  showTerrainLOD = false,
  showRoadSegments = false,
  onTileAction,
  onTilePointerEnter,
  onChunkRebuild,
  onRoadRebuild,
  onBuildingBatchUpdate,
  onVisibleChunksChange,
  dragPreviewTiles = [],
  dragPreviewColor = 'green',
  activeVehicles = [],
  activePedestrians = [],
}: City3DCanvasProps) {
  const [nightFactor, setNightFactor] = useState<number>(0);

  const handleNightFactorChange = useCallback((factor: number) => {
    setNightFactor(factor);
  }, []);

  const gridWidth = grid[0]?.length || 60;
  const gridHeight = grid.length || 60;

  const dpr =
    graphicsQuality === 'low'
      ? 1.0
      : graphicsQuality === 'medium'
      ? 1.25
      : graphicsQuality === 'high'
      ? 1.5
      : 2.0;

  const enableShadows = graphicsQuality !== 'low';

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0f1d]">
      <Canvas
        shadows={enableShadows}
        dpr={dpr}
        camera={{ position: [0, 22, 22], fov: 45 }}
        gl={{
          antialias: graphicsQuality !== 'low',
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
      >
        {/* Sky, Sun/Moon & Atmospheric Fog */}
        <DayNightSky day={day} speed={speed} onNightFactorChange={handleNightFactorChange} />

        {/* Camera Position & Orbit Controls */}
        <CameraController
          viewMode={viewMode}
          zoom={zoom}
          pitch={pitch}
          rotation={rotation}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />

        {/* Batched Chunk Terrain Rendering with Incremental Geometry Caching & LOD */}
        <ChunkTerrainRenderer
          grid={grid}
          terrainRevision={revisions.terrainRevision}
          dirtyTerrainChunks={dirtyTerrainChunks}
          activeTool={activeTool}
          activeOverlay={activeOverlay}
          brushSize={brushSize}
          graphicsQuality={graphicsQuality}
          showChunkBoundaries={showChunkBoundaries}
          showTerrainLOD={showTerrainLOD}
          onTileClick={onTileAction}
          onTilePointerEnter={onTilePointerEnter}
          onChunkRebuild={onChunkRebuild}
          onVisibleChunksChange={onVisibleChunksChange}
          dragPreviewTiles={dragPreviewTiles}
          dragPreviewColor={dragPreviewColor}
        />

        {/* Procedural Instanced Spline Road Network with Continuous Lanes & Bridges */}
        <SplineRoadRenderer
          grid={grid}
          roadRevision={revisions.roadRevision}
          nightFactor={nightFactor}
          showRoadSegments={showRoadSegments}
          onRoadRebuild={onRoadRebuild}
        />

        {/* GPU Instanced Building Rendering (Batched by level and zone type) */}
        <InstancedBuildingRenderer
          grid={grid}
          buildingRevision={revisions.buildingRevision}
          nightFactor={nightFactor}
          onBuildingBatchUpdate={onBuildingBatchUpdate}
        />

        {/* Clustered Tree Groves & Rock Formations Anchored to Terrain Surface */}
        <EnvironmentProps grid={grid} graphicsQuality={graphicsQuality} />

        {/* GPU Instanced Traffic Simulation Vehicles */}
        <InstancedVehicleRenderer
          vehicles={activeVehicles}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          nightFactor={nightFactor}
        />

        {/* GPU Instanced Sidewalk Pedestrians */}
        <InstancedPedestrianRenderer
          pedestrians={activePedestrians}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />
      </Canvas>
    </div>
  );
}

// Precision memo equality: completely bypasses 3D Canvas re-renders unless visual 3D revisions actually change!
export const City3DCanvas = React.memo(City3DCanvasBase, (prev, next) => {
  if (
    prev.revisions.terrainRevision !== next.revisions.terrainRevision ||
    prev.revisions.roadRevision !== next.revisions.roadRevision ||
    prev.revisions.buildingRevision !== next.revisions.buildingRevision ||
    prev.revisions.vehicleRevision !== next.revisions.vehicleRevision ||
    prev.revisions.pedestrianRevision !== next.revisions.pedestrianRevision ||
    prev.day !== next.day ||
    prev.speed !== next.speed ||
    prev.activeTool !== next.activeTool ||
    prev.activeOverlay !== next.activeOverlay ||
    prev.brushSize !== next.brushSize ||
    prev.graphicsQuality !== next.graphicsQuality ||
    prev.showChunkBoundaries !== next.showChunkBoundaries ||
    prev.showTerrainLOD !== next.showTerrainLOD ||
    prev.showRoadSegments !== next.showRoadSegments ||
    prev.viewMode !== next.viewMode ||
    prev.zoom !== next.zoom ||
    prev.pitch !== next.pitch ||
    prev.rotation !== next.rotation ||
    prev.dragPreviewColor !== next.dragPreviewColor ||
    prev.dragPreviewTiles?.length !== next.dragPreviewTiles?.length
  ) {
    return false; // Re-render needed
  }
  return true; // Skip re-render
});
