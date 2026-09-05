import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { GRID_WIDTH, GRID_HEIGHT, gridToWorld } from './types3D';

// Shared Geometries & Materials for Vehicles
const carGeo = new THREE.BoxGeometry(0.12, 0.08, 0.22);
const headlightGeo = new THREE.BoxGeometry(0.03, 0.03, 0.01);
const headlightMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });

const carMats: Record<string, THREE.MeshStandardMaterial> = {
  '#ef4444': new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.3, metalness: 0.6 }),
  '#3b82f6': new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.3, metalness: 0.6 }),
  '#f59e0b': new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.3, metalness: 0.6 }),
  '#10b981': new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.3, metalness: 0.6 }),
  '#f8fafc': new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3, metalness: 0.6 }),
  '#6366f1': new THREE.MeshStandardMaterial({ color: '#6366f1', roughness: 0.3, metalness: 0.6 }),
};

interface TrafficVehiclesProps {
  grid: TileData[][];
  nightFactor: number;
}

interface Vehicle {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  color: string;
}

export function TrafficVehicles({ grid, nightFactor }: TrafficVehiclesProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  // Collect road tiles with traffic
  const roadTiles = useMemo(() => {
    const roads: { x: number; y: number; traffic: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y]?.[x]?.type === TileType.ROAD && grid[y][x].traffic > 0) {
          roads.push({ x, y, traffic: grid[y][x].traffic });
        }
      }
    }
    return roads;
  }, [grid, width, height]);

  // Generate vehicles corresponding to traffic level (capped for performance)
  const vehicles = useMemo(() => {
    const list: Vehicle[] = [];
    const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#f8fafc', '#6366f1'];
    let idCounter = 0;

    roadTiles.forEach((r) => {
      // Spawn 1 to 2 cars per active road tile depending on traffic count
      const carCount = Math.min(2, Math.ceil(r.traffic / 7));
      for (let i = 0; i < carCount; i++) {
        list.push({
          id: idCounter++,
          startX: r.x,
          startY: r.y,
          targetX: r.x + (i % 2 === 0 && r.x + 1 < width ? 1 : 0),
          targetY: r.y + (i % 2 !== 0 && r.y + 1 < height ? 1 : 0),
          progress: Math.random(),
          speed: 0.45 + Math.random() * 0.45,
          color: colors[idCounter % colors.length],
        });
      }
    });

    return list.slice(0, 80); // Cap max vehicles at 80 for silky smooth performance
  }, [roadTiles, width, height]);

  // Animate vehicles moving along road segments
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.children.forEach((child, index) => {
      const v = vehicles[index];
      if (!v) return;

      v.progress += delta * v.speed;
      if (v.progress > 1.0) {
        v.progress = 0;
      }

      const [w1x, , w1z] = gridToWorld(v.startX, v.startY, width, height);
      const [w2x, , w2z] = gridToWorld(v.targetX, v.targetY, width, height);

      const el1 = grid[v.startY]?.[v.startX]?.elevation || 0;
      const el2 = grid[v.targetY]?.[v.targetX]?.elevation || 0;

      // Lerp position
      const px = THREE.MathUtils.lerp(w1x, w2x, v.progress);
      const pz = THREE.MathUtils.lerp(w1z, w2z, v.progress);
      const py = THREE.MathUtils.lerp(el1, el2, v.progress) * 0.15 + 0.08;

      child.position.set(px, py, pz);

      // Rotate car toward movement vector
      const dx = w2x - w1x;
      const dz = w2z - w1z;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        child.rotation.y = Math.atan2(dx, dz);
      }
    });
  });

  if (vehicles.length === 0) return null;

  return (
    <group ref={groupRef} name="TrafficVehicles">
      {vehicles.map((v) => (
        <group key={`veh-${v.id}`}>
          {/* Car Body */}
          <mesh geometry={carGeo} material={carMats[v.color]} castShadow />
          {/* Headlights */}
          <mesh position={[0.04, 0.02, 0.11]} geometry={headlightGeo} material={headlightMat} />
          <mesh position={[-0.04, 0.02, 0.11]} geometry={headlightGeo} material={headlightMat} />
          {nightFactor > 0.4 && (
            <pointLight position={[0, 0.05, 0.15]} color="#fef08a" intensity={0.4 * nightFactor} distance={1.2} />
          )}
        </group>
      ))}
    </group>
  );
}
