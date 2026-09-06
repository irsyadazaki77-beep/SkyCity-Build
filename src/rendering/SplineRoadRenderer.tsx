import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData } from '../types';
import { SplineRoadNetwork, RoadGeometryBatch } from '../core/world/SplineRoadNetwork';

interface SplineRoadRendererProps {
  grid: TileData[][];
  roadRevision: number;
  nightFactor: number;
  showRoadSegments?: boolean;
  onRoadRebuild?: (count: number) => void;
}

export function SplineRoadRenderer({
  grid,
  roadRevision,
  nightFactor: _nightFactor,
  showRoadSegments = false,
  onRoadRebuild,
}: SplineRoadRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const cachedBatchRef = useRef<RoadGeometryBatch | null>(null);
  const prevRevisionRef = useRef<number>(-1);

  const roadGeometryBatch = useMemo(() => {
    // Only rebuild road procedural spline geometry if roadRevision changes!
    if (cachedBatchRef.current && prevRevisionRef.current === roadRevision) {
      return cachedBatchRef.current;
    }

    prevRevisionRef.current = roadRevision;
    const network = new SplineRoadNetwork();
    network.buildFromGrid(grid);
    const batch = network.generateRoadGeometry(grid, width, height);

    if (cachedBatchRef.current) {
      cachedBatchRef.current.asphaltGeo.dispose();
      cachedBatchRef.current.markingsGeo.dispose();
      cachedBatchRef.current.curbGeo.dispose();
      if (cachedBatchRef.current.bridgeGeo) cachedBatchRef.current.bridgeGeo.dispose();
      if (cachedBatchRef.current.debugGeo) cachedBatchRef.current.debugGeo.dispose();
    }

    cachedBatchRef.current = batch;
    if (onRoadRebuild) {
      onRoadRebuild(1);
    }
    return batch;
  }, [roadRevision, grid, width, height, onRoadRebuild]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cachedBatchRef.current) {
        cachedBatchRef.current.asphaltGeo.dispose();
        cachedBatchRef.current.markingsGeo.dispose();
        cachedBatchRef.current.curbGeo.dispose();
        if (cachedBatchRef.current.bridgeGeo) cachedBatchRef.current.bridgeGeo.dispose();
        if (cachedBatchRef.current.debugGeo) cachedBatchRef.current.debugGeo.dispose();
        cachedBatchRef.current = null;
      }
    };
  }, []);

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
