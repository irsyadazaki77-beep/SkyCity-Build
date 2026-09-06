import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData } from '../types';
import { SplineRoadNetwork, RoadGeometryBatch } from '../core/world/SplineRoadNetwork';
import { GraphicsState } from './GraphicsState';

interface SplineRoadRendererProps {
  grid: TileData[][];
  roadRevision: number;
  nightFactor: number;
  showRoadSegments?: boolean;
  showRoadWaterIntersections?: boolean;
  onRoadRebuild?: (count: number) => void;
}

/**
 * Procedural Asphalt Material
 */
const AsphaltMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uNightFactor: GraphicsState.uniforms.uNightFactor,
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uNightFactor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        // Procedural asphalt grain
        float grain = hash(vWorldPosition.xz * 100.0) * 0.1;
        float macro = hash(vWorldPosition.xz * 5.0) * 0.05;
        vec3 color = vec3(0.12, 0.14, 0.18) + grain + macro;
        
        vec3 normal = normalize(vNormal);
        float dotL = max(0.2, dot(normal, uSunDirection));
        
        vec3 diffuse = color * dotL * (1.0 - uNightFactor * 0.8);
        diffuse += vec3(0.01, 0.02, 0.08) * uNightFactor;

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `
  });
};

export function SplineRoadRenderer({
  grid,
  roadRevision,
  nightFactor: _nightFactor,
  showRoadSegments = false,
  showRoadWaterIntersections = false,
  onRoadRebuild,
}: SplineRoadRendererProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const cachedBatchRef = useRef<RoadGeometryBatch | null>(null);
  const prevRevisionRef = useRef<number>(-1);

  const roadGeometryBatch = useMemo(() => {
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
    if (onRoadRebuild) onRoadRebuild(1);
    return batch;
  }, [roadRevision, grid, width, height, onRoadRebuild]);

  const asphaltMat = useMemo(() => AsphaltMaterial(), []);

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
      <mesh geometry={roadGeometryBatch.asphaltGeo} material={asphaltMat} receiveShadow castShadow />

      {/* Yellow / White Center Lane Markings */}
      <mesh geometry={roadGeometryBatch.markingsGeo}>
        <meshBasicMaterial color="#fbbf24" />
      </mesh>

      {/* Concrete Curbs and Sidewalks */}
      <mesh geometry={roadGeometryBatch.curbGeo} receiveShadow castShadow>
        <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Elevated Bridge Decks, Guardrails & River Pillars */}
      {roadGeometryBatch.bridgeGeo && (
        <mesh geometry={roadGeometryBatch.bridgeGeo} receiveShadow castShadow>
          <meshStandardMaterial
            color={showRoadWaterIntersections ? '#f97316' : '#64748b'}
            emissive={showRoadWaterIntersections ? '#f97316' : '#000000'}
            emissiveIntensity={showRoadWaterIntersections ? 0.6 : 0}
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
