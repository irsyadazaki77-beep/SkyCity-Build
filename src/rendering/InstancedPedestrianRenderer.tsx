import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulatedPedestrian } from '../types';
import { gridToWorld } from '../components/world/types3D';

interface InstancedPedestrianRendererProps {
  pedestrians: SimulatedPedestrian[];
  gridWidth: number;
  gridHeight: number;
}

const dummyMatrix = new THREE.Matrix4();
const dummyColor = new THREE.Color();
const dummyPos = new THREE.Vector3();

interface PedestrianVisualState {
  progress: number;
}

export function InstancedPedestrianRenderer({
  pedestrians,
  gridWidth,
  gridHeight,
}: InstancedPedestrianRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const visualStateRef = useRef<Map<number, PedestrianVisualState>>(new Map());

  // Proportional human scale: CapsuleGeometry(0.03 radius, 0.08 length = ~0.14 height)
  const geo = useMemo(() => {
    const c = new THREE.CapsuleGeometry(0.03, 0.08, 4, 8);
    c.translate(0, 0.07, 0);
    return c;
  }, []);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }), []);

  useFrame((_, delta) => {
    if (!meshRef.current || pedestrians.length === 0) return;
    const mesh = meshRef.current;
    const count = Math.min(pedestrians.length, 60);
    const pStates = visualStateRef.current;

    for (let i = 0; i < count; i++) {
      const p = pedestrians[i];
      
      let pState = pStates.get(p.id);
      if (!pState) {
        pState = { progress: p.progress || 0 };
        pStates.set(p.id, pState);
      } else {
        if (Math.abs(pState.progress - p.progress) > 0.45) {
          pState.progress = THREE.MathUtils.lerp(pState.progress, p.progress, 0.25);
        }
      }

      pState.progress += delta * (p.speed || 0.8);
      if (pState.progress >= 1.0) {
        pState.progress = 0;
      }

      const [w1x, , w1z] = gridToWorld(p.startX, p.startZ, gridWidth, gridHeight);
      const [w2x, , w2z] = gridToWorld(p.targetX, p.targetZ, gridWidth, gridHeight);

      const curX = w1x + (w2x - w1x) * pState.progress;
      const curZ = w1z + (w2z - w1z) * pState.progress;

      dummyPos.set(curX, 0.01, curZ);
      dummyMatrix.identity();
      dummyMatrix.setPosition(dummyPos);

      mesh.setMatrixAt(i, dummyMatrix);
      dummyColor.set(p.color || '#f8fafc');
      mesh.setColorAt(i, dummyColor);
    }

    // Prune stale pedestrian visual states to avoid memory leak
    if (pStates.size > pedestrians.length * 2) {
      const activeIds = new Set(pedestrians.map((ped) => ped.id));
      for (const id of pStates.keys()) {
        if (!activeIds.has(id)) {
          pStates.delete(id);
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (pedestrians.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, Math.max(1, Math.min(pedestrians.length, 60))]}
      castShadow
    />
  );
}
