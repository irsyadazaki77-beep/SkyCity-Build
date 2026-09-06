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

export function InstancedPedestrianRenderer({
  pedestrians,
  gridWidth,
  gridHeight,
}: InstancedPedestrianRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(() => new THREE.CapsuleGeometry(0.02, 0.06, 4, 8), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 }), []);

  useFrame((_, delta) => {
    if (!meshRef.current || pedestrians.length === 0) return;
    const mesh = meshRef.current;
    const count = Math.min(pedestrians.length, 60);

    for (let i = 0; i < count; i++) {
      const p = pedestrians[i];
      p.progress += delta * p.speed;
      if (p.progress >= 1.0) {
        p.progress = 0;
      }

      const [w1x, , w1z] = gridToWorld(p.startX, p.startZ, gridWidth, gridHeight);
      const [w2x, , w2z] = gridToWorld(p.targetX, p.targetZ, gridWidth, gridHeight);

      const curX = w1x + (w2x - w1x) * p.progress;
      const curZ = w1z + (w2z - w1z) * p.progress;

      dummyPos.set(curX, 0.05, curZ);
      dummyMatrix.identity();
      dummyMatrix.setPosition(dummyPos);

      mesh.setMatrixAt(i, dummyMatrix);
      dummyColor.set(p.color || '#f8fafc');
      mesh.setColorAt(i, dummyColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (pedestrians.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, Math.max(1, Math.min(pedestrians.length, 60))]}
    />
  );
}
