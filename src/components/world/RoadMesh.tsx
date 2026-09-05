import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { GRID_WIDTH, GRID_HEIGHT, TILE_SIZE, gridToWorld } from './types3D';

interface RoadMeshProps {
  grid: TileData[][];
  nightFactor: number;
}

interface RoadConnection {
  x: number;
  y: number;
  hasN: boolean;
  hasE: boolean;
  hasS: boolean;
  hasW: boolean;
  count: number;
  traffic: number;
}

export function RoadMesh({ grid, nightFactor }: RoadMeshProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  // Parse road tiles and analyze adjacency
  const roadData = useMemo(() => {
    const roads: RoadConnection[] = [];

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return grid[y][x].type === TileType.ROAD;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].type === TileType.ROAD) {
          const hasN = isRoad(x, y - 1);
          const hasE = isRoad(x + 1, y);
          const hasS = isRoad(x, y + 1);
          const hasW = isRoad(x - 1, y);
          const count = (hasN ? 1 : 0) + (hasE ? 1 : 0) + (hasS ? 1 : 0) + (hasW ? 1 : 0);

          roads.push({
            x,
            y,
            hasN,
            hasE,
            hasS,
            hasW,
            count,
            traffic: grid[y][x].traffic || 0,
          });
        }
      }
    }
    return roads;
  }, [grid, width, height]);

  // Geometries for instancing
  const asphaltGeo = useMemo(() => new THREE.BoxGeometry(0.96, 0.04, 0.96), []);
  const sidewalkGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.06, 0.96), []);
  const centerLineGeo = useMemo(() => new THREE.PlaneGeometry(0.04, 0.6), []);
  const crosswalkStripGeo = useMemo(() => new THREE.PlaneGeometry(0.08, 0.35), []);
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 0.8), []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.05, 8, 8), []);

  // Materials
  const asphaltMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#262930',
    roughness: 0.8,
    metalness: 0.1,
  }), []);

  const sidewalkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.6,
  }), []);

  const yellowLineMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#f59e0b',
    side: THREE.DoubleSide,
  }), []);

  const whiteLineMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#f8fafc',
    side: THREE.DoubleSide,
  }), []);

  const poleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.8,
    roughness: 0.2,
  }), []);

  const streetlightBulbMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fef08a',
  }), []);

  // Update street light brightness based on night
  streetlightBulbMat.color.setHSL(0.15, 0.9, 0.5 + nightFactor * 0.5);

  return (
    <group name="RoadNetwork">
      {roadData.map((road) => {
        const [wx, , wz] = gridToWorld(road.x, road.y, width, height);
        const wy = (grid[road.y][road.x].elevation || 0) * 0.15;
        const { hasN, hasE, hasS, hasW, count } = road;

        // Determine rotation for straight or corner segments
        let rotationY = 0;
        if (count === 2) {
          if (hasN && hasS) rotationY = 0; // Vertical straight
          else if (hasE && hasW) rotationY = Math.PI / 2; // Horizontal straight
          else if (hasN && hasE) rotationY = 0; // Corner N-E
          else if (hasE && hasS) rotationY = Math.PI / 2; // Corner E-S
          else if (hasS && hasW) rotationY = Math.PI; // Corner S-W
          else if (hasW && hasN) rotationY = -Math.PI / 2; // Corner W-N
        } else if (count === 3) {
          if (!hasS) rotationY = 0; // T-Junction facing North (missing South)
          else if (!hasW) rotationY = Math.PI / 2; // facing East
          else if (!hasN) rotationY = Math.PI; // facing South
          else if (!hasE) rotationY = -Math.PI / 2; // facing West
        }

        const isHorizontalStraight = (count === 2 && hasE && hasW);
        const isVerticalStraight = (count === 2 && hasN && hasS);
        const isIntersection = count >= 3;

        return (
          <group key={`road-${road.x}-${road.y}`} position={[wx, wy, wz]}>
            {/* Asphalt Base Tile */}
            <mesh geometry={asphaltGeo} material={asphaltMat} position={[0, 0.02, 0]} receiveShadow />

            {/* Sidewalk Curbs along non-connected edges */}
            {!hasW && <mesh geometry={sidewalkGeo} material={sidewalkMat} position={[-0.42, 0.05, 0]} receiveShadow />}
            {!hasE && <mesh geometry={sidewalkGeo} material={sidewalkMat} position={[0.42, 0.05, 0]} receiveShadow />}
            {!hasN && (
              <mesh 
                geometry={sidewalkGeo} 
                material={sidewalkMat} 
                position={[0, 0.05, -0.42]} 
                rotation={[0, Math.PI / 2, 0]} 
                receiveShadow 
              />
            )}
            {!hasS && (
              <mesh 
                geometry={sidewalkGeo} 
                material={sidewalkMat} 
                position={[0, 0.05, 0.42]} 
                rotation={[0, Math.PI / 2, 0]} 
                receiveShadow 
              />
            )}

            {/* Lane Markings */}
            {isVerticalStraight && (
              <mesh 
                geometry={centerLineGeo} 
                material={yellowLineMat} 
                position={[0, 0.045, 0]} 
                rotation={[-Math.PI / 2, 0, 0]} 
              />
            )}
            {isHorizontalStraight && (
              <mesh 
                geometry={centerLineGeo} 
                material={yellowLineMat} 
                position={[0, 0.045, 0]} 
                rotation={[-Math.PI / 2, 0, Math.PI / 2]} 
              />
            )}

            {/* 4-Way or 3-Way Crosswalks */}
            {isIntersection && (
              <group position={[0, 0.046, 0]}>
                {hasN && (
                  <group position={[0, 0, -0.28]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
                {hasS && (
                  <group position={[0, 0, 0.28]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
                {hasE && (
                  <group position={[0.28, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
                {hasW && (
                  <group position={[-0.28, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
              </group>
            )}

            {/* Street Lamp on Intersections and select straight road corners */}
            {(isIntersection || (road.x + road.y) % 4 === 0) && (
              <group position={[-0.42, 0, -0.42]}>
                <mesh geometry={poleGeo} material={poleMat} position={[0, 0.4, 0]} castShadow />
                <mesh geometry={bulbGeo} material={streetlightBulbMat} position={[0.1, 0.78, 0.1]} />
                {nightFactor > 0.4 && (
                  <pointLight position={[0.1, 0.75, 0.1]} color="#fef08a" intensity={0.6 * nightFactor} distance={3} />
                )}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
