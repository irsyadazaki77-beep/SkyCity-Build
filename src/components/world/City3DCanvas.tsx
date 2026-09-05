import React, { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { CityState, TileType } from '../../types';
import { DayNightSky } from './DayNightSky';
import { TerrainGrid } from './TerrainGrid';
import { RoadMesh } from './RoadMesh';
import { BuildingMesh } from './BuildingMesh';
import { EnvironmentProps } from './EnvironmentProps';
import { TrafficVehicles } from './TrafficVehicles';
import { CameraController } from './CameraController';

import { OverlayMode } from '../../types';

interface City3DCanvasProps {
  gameState: CityState;
  activeTool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  speed: number;
  viewMode: '2D' | '3D';
  zoom: number;
  pitch: number;
  rotation: number;
  mapExpansionMode?: boolean;
  brushSize?: number;
  onTileAction: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  onUnlockRegion?: (rx: number, ry: number) => void;
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
}

export function City3DCanvas({
  gameState,
  activeTool,
  activeOverlay = 'NONE',
  speed,
  viewMode,
  zoom,
  pitch,
  rotation,
  mapExpansionMode = false,
  brushSize = 1,
  onTileAction,
  onTilePointerEnter,
  onUnlockRegion,
  dragPreviewTiles = [],
  dragPreviewColor = 'green',
}: City3DCanvasProps) {
  const [nightFactor, setNightFactor] = useState<number>(0);

  const handleNightFactorChange = useCallback((factor: number) => {
    setNightFactor(factor);
  }, []);

  const gridWidth = gameState.grid[0]?.length || 60;
  const gridHeight = gameState.grid.length || 60;

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0f1d]">
      <Canvas
        shadows="percentage"
        camera={{ position: [0, 22, 22], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        {/* Sky, Sun/Moon & Atmospheric Fog */}
        <DayNightSky
          day={gameState.day}
          speed={speed}
          onNightFactorChange={handleNightFactorChange}
        />

        {/* Camera Position & Orbit Controls */}
        <CameraController
          viewMode={viewMode}
          zoom={zoom}
          pitch={pitch}
          rotation={rotation}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
        />

        {/* Base Ground Terrain & Interactive Grid */}
        <TerrainGrid
          grid={gameState.grid}
          activeTool={activeTool}
          money={gameState.money}
          activeOverlay={activeOverlay}
          unlockedRegions={gameState.unlockedRegions || ['1,1']}
          mapExpansionMode={mapExpansionMode}
          brushSize={brushSize}
          onTileClick={onTileAction}
          onTilePointerEnter={onTilePointerEnter}
          onUnlockRegion={onUnlockRegion}
          dragPreviewTiles={dragPreviewTiles}
          dragPreviewColor={dragPreviewColor}
        />

        {/* Procedural Road Network with Intersections & Sidewalks */}
        <RoadMesh grid={gameState.grid} nightFactor={nightFactor} />

        {/* Building Models (Zoned R/C/I Levels 1-5 and City Services) */}
        <group name="CityBuildings">
          {gameState.grid.map((row) =>
            row.map((tile) => {
              if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) return null;
              return (
                <BuildingMesh
                  key={`bld-${tile.x}-${tile.y}`}
                  tile={tile}
                  nightFactor={nightFactor}
                  gridWidth={gridWidth}
                  gridHeight={gridHeight}
                />
              );
            })
          )}
        </group>

        {/* Environment Trees & Nature Elements */}
        <EnvironmentProps grid={gameState.grid} />

        {/* Traffic Simulation Vehicles */}
        <TrafficVehicles grid={gameState.grid} nightFactor={nightFactor} />
      </Canvas>
    </div>
  );
}
