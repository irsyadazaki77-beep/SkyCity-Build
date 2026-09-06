import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TileData } from '../types';
import { SplineRoadNetwork } from '../core/world/SplineRoadNetwork';

interface SplineRoadRendererProps {
  grid: TileData[][];
  nightFactor: number;
  showRoadSegments?: boolean;
}

export function SplineRoadRenderer({ grid, nightFactor, showRoadSegments = false }: SplineRoadRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const roadGeometryBatch = useMemo(() => {
    const network = new SplineRoadNetwork();
    network.buildFromGrid(grid);
    return network.generateRoadGeometry(grid, width, height);
  }, [grid, width, height]);

  return (
    <group name="SplineRoads">
      {/* Asphalt Surface */}
      <mesh geometry={roadGeometryBatch.asphaltGeo} receiveShadow castShadow>
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.82}
          metalness={0.12}
        />
      </mesh>

      {/* Yellow / White Center Lane Markings */}
      <mesh geometry={roadGeometryBatch.markingsGeo}>
        <meshBasicMaterial color="#fbbf24" />
      </mesh>

      {/* Concrete Curbs and Sidewalks */}
      <mesh geometry={roadGeometryBatch.curbGeo} receiveShadow castShadow>
        <meshStandardMaterial
          color="#94a3b8"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Elevated Bridge Decks, Guardrails & River Pillars */}
      {roadGeometryBatch.bridgeGeo && (
        <mesh geometry={roadGeometryBatch.bridgeGeo} receiveShadow castShadow>
          <meshStandardMaterial
            color="#64748b"
            roughness={0.65}
            metalness={0.3}
          />
        </mesh>
      )}

      {/* Debug Road Nodes / Segments Visualization */}
      {showRoadSegments && roadGeometryBatch.debugGeo && (
        <mesh geometry={roadGeometryBatch.debugGeo}>
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
      )}
    </group>
  );
}

