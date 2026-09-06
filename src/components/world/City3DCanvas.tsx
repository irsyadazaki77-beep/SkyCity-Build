import React, { useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { TileData, TileType, OverlayMode, SimulatedVehicle, SimulatedPedestrian, GraphicsQualityTier } from '../../types';
import { DayNightSky } from './DayNightSky';
import { CameraController } from './CameraController';
import { ChunkTerrainRenderer } from '../../rendering/ChunkTerrainRenderer';
import { SplineRoadRenderer } from '../../rendering/SplineRoadRenderer';
import { InstancedBuildingRenderer } from '../../rendering/InstancedBuildingRenderer';
import { EnvironmentProps } from './EnvironmentProps';
import { InstancedVehicleRenderer } from '../../rendering/InstancedVehicleRenderer';
import { InstancedPedestrianRenderer } from '../../rendering/InstancedPedestrianRenderer';

interface City3DCanvasProps {
  grid: TileData[][];
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
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
  activeVehicles?: SimulatedVehicle[];
  activePedestrians?: SimulatedPedestrian[];
}

function City3DCanvasBase({
  grid,
  day,
  speed,
  activeTool,
  activeOverlay = 'NONE',
  unlockedRegions = ['1,1'],
  viewMode,
  zoom,
  pitch,
  rotation,
  mapExpansionMode = false,
  brushSize = 1,
  graphicsQuality = 'high',
  showChunkBoundaries = false,
  showTerrainLOD = false,
  showRoadSegments = false,
  onTileAction,
  onTilePointerEnter,
  onUnlockRegion,
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

        {/* Batched Chunk Terrain Rendering with Smooth Shorelines & LOD */}
        <ChunkTerrainRenderer
          grid={grid}
          activeTool={activeTool}
          activeOverlay={activeOverlay}
          brushSize={brushSize}
          graphicsQuality={graphicsQuality}
          showChunkBoundaries={showChunkBoundaries}
          showTerrainLOD={showTerrainLOD}
          onTileClick={onTileAction}
          onTilePointerEnter={onTilePointerEnter}
          dragPreviewTiles={dragPreviewTiles}
          dragPreviewColor={dragPreviewColor}
        />

        {/* Procedural Instanced Spline Road Network with Continuous Lanes & Bridges */}
        <SplineRoadRenderer
          grid={grid}
          nightFactor={nightFactor}
          showRoadSegments={showRoadSegments}
        />

        {/* GPU Instanced Building Rendering (Batched by level and zone type) */}
        <InstancedBuildingRenderer grid={grid} nightFactor={nightFactor} />

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

// Custom memo equality to completely bypass 3D re-renders unless visual 3D props actually change
export const City3DCanvas = React.memo(City3DCanvasBase, (prevProps, nextProps) => {
  if (
    prevProps.grid !== nextProps.grid ||
    prevProps.day !== nextProps.day ||
    prevProps.speed !== nextProps.speed ||
    prevProps.activeTool !== nextProps.activeTool ||
    prevProps.activeOverlay !== nextProps.activeOverlay ||
    prevProps.brushSize !== nextProps.brushSize ||
    prevProps.graphicsQuality !== nextProps.graphicsQuality ||
    prevProps.showChunkBoundaries !== nextProps.showChunkBoundaries ||
    prevProps.showTerrainLOD !== nextProps.showTerrainLOD ||
    prevProps.showRoadSegments !== nextProps.showRoadSegments ||
    prevProps.viewMode !== nextProps.viewMode ||
    prevProps.zoom !== nextProps.zoom ||
    prevProps.pitch !== nextProps.pitch ||
    prevProps.rotation !== nextProps.rotation ||
    prevProps.dragPreviewColor !== nextProps.dragPreviewColor ||
    prevProps.dragPreviewTiles?.length !== nextProps.dragPreviewTiles?.length ||
    prevProps.activeVehicles?.length !== nextProps.activeVehicles?.length ||
    prevProps.activePedestrians?.length !== nextProps.activePedestrians?.length
  ) {
    return false; // Re-render needed
  }
  return true; // Skip re-render
});

