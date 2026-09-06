import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulatedVehicle } from '../types';
import { gridToWorld } from '../components/world/types3D';

interface InstancedVehicleRendererProps {
  vehicles: SimulatedVehicle[];
  gridWidth: number;
  gridHeight: number;
  nightFactor: number;
}

const dummyMatrix = new THREE.Matrix4();
const dummyColor = new THREE.Color();
const dummyPos = new THREE.Vector3();
const dummyDir = new THREE.Vector3();

export function InstancedVehicleRenderer({
  vehicles,
  gridWidth,
  gridHeight,
  nightFactor,
}: InstancedVehicleRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(() => new THREE.BoxGeometry(0.12, 0.08, 0.22), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }), []);

  useFrame((_, delta) => {
    if (!meshRef.current || vehicles.length === 0) return;
    const mesh = meshRef.current;
    const count = Math.min(vehicles.length, 100);

    for (let i = 0; i < count; i++) {
      const v = vehicles[i];
      if (!v.path || v.path.length < 2) continue;

      v.progress += delta * v.speed;
      if (v.progress >= 1.0) {
        v.progress = 0;
        v.currentWaypointIndex = (v.currentWaypointIndex + 1) % (v.path.length - 1);
      }

      const p1 = v.path[v.currentWaypointIndex];
      const p2 = v.path[v.currentWaypointIndex + 1] || v.path[0];

      const [w1x, , w1z] = gridToWorld(p1[0], p1[2], gridWidth, gridHeight);
      const [w2x, , w2z] = gridToWorld(p2[0], p2[2], gridWidth, gridHeight);

      const curX = w1x + (w2x - w1x) * v.progress;
      const curY = p1[1] + (p2[1] - p1[1]) * v.progress + 0.04;
      const curZ = w1z + (w2z - w1z) * v.progress;

      dummyPos.set(curX, curY, curZ);
      dummyDir.set(w2x - w1x, 0, w2z - w1z).normalize();

      const angle = Math.atan2(dummyDir.x, dummyDir.z);

      dummyMatrix.makeRotationY(angle);
      dummyMatrix.setPosition(dummyPos);

      mesh.setMatrixAt(i, dummyMatrix);

      dummyColor.set(v.color || '#3b82f6');
      if (nightFactor > 0.3) {
        dummyColor.lerp(new THREE.Color('#ffffff'), 0.2);
      }
      mesh.setColorAt(i, dummyColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (vehicles.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, Math.max(1, Math.min(vehicles.length, 100))]}
      castShadow
    />
  );
}
