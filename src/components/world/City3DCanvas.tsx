import React, { useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, BrightnessContrast, HueSaturation } from '@react-three/postprocessing';
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
  showWaterMask?: boolean;
  showShorelineContour?: boolean;
  showWaterRegions?: boolean;
  showRoadWaterIntersections?: boolean;
  showInvalidVegetation?: boolean;
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

const WebGLProfiler = () => {
  const { gl } = useThree();
  
  useFrame(() => {
    // Export metrics globally for DeveloperDebugHUD to read
    (window as any).__WEBGL_METRICS__ = {
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures
    };
  });
  return null;
};

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
  showWaterMask = false,
  showShorelineContour = false,
  showWaterRegions = false,
  showRoadWaterIntersections = false,
  showInvalidVegetation = false,
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
        <WebGLProfiler />

        {/* Sky, Sun/Moon & Atmospheric Fog */}
        <DayNightSky day={day} speed={speed} />

        {/* Camera Position & Orbit Controls */}
        <CameraController
          viewMode={viewMode}
          zoom={zoom}
          pitch={pitch}
          rotation={rotation}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />

        {/* Batched Chunk Terrain Rendering */}
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
          showWaterMask={showWaterMask}
          showShorelineContour={showShorelineContour}
          showWaterRegions={showWaterRegions}
          onTileClick={onTileAction}
          onTilePointerEnter={onTilePointerEnter}
          onChunkRebuild={onChunkRebuild}
          onVisibleChunksChange={onVisibleChunksChange}
          dragPreviewTiles={dragPreviewTiles}
          dragPreviewColor={dragPreviewColor}
        />

        {/* Road Network */}
        <SplineRoadRenderer
          grid={grid}
          roadRevision={revisions.roadRevision}
          nightFactor={0} // Pulled from GraphicsState internally
          showRoadSegments={showRoadSegments}
          showRoadWaterIntersections={showRoadWaterIntersections}
          onRoadRebuild={onRoadRebuild}
        />

        {/* Buildings */}
        <InstancedBuildingRenderer
          grid={grid}
          buildingRevision={revisions.buildingRevision}
          nightFactor={0} // Pulled from GraphicsState internally
          onBuildingBatchUpdate={onBuildingBatchUpdate}
        />

        {/* Vegetation */}
        <EnvironmentProps grid={grid} graphicsQuality={graphicsQuality} showInvalidVegetation={showInvalidVegetation} />

        {/* Traffic */}
        <InstancedVehicleRenderer
          vehicles={activeVehicles}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          nightFactor={0} // Pulled from GraphicsState internally
        />

        <InstancedPedestrianRenderer
          pedestrians={activePedestrians}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />

        {/* Post-processing */}
        {graphicsQuality !== 'low' && (
          <EffectComposer multisampling={0}>
            <Bloom 
              intensity={0.3} 
              luminanceThreshold={0.9} 
              luminanceSmoothing={0.1} 
            />
            <HueSaturation saturation={0.08} />
            <BrightnessContrast brightness={0.0} contrast={0.08} />
            <Vignette eskil={false} offset={0.1} darkness={0.4} />
          </EffectComposer>
        )}
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
    prev.showWaterMask !== next.showWaterMask ||
    prev.showShorelineContour !== next.showShorelineContour ||
    prev.showWaterRegions !== next.showWaterRegions ||
    prev.showRoadWaterIntersections !== next.showRoadWaterIntersections ||
    prev.showInvalidVegetation !== next.showInvalidVegetation ||
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
