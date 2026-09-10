import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulatedVehicle } from '../types';
import { GraphicsState } from "./GraphicsState";
import { gridToWorld } from '../components/world/types3D';

interface InstancedVehicleRendererProps {
  vehicles: SimulatedVehicle[];
  gridWidth: number;
  gridHeight: number;
}

const dummyMatrix = new THREE.Matrix4();
const dummyColor = new THREE.Color();
const dummyPos = new THREE.Vector3();
const dummyDir = new THREE.Vector3();

interface VehicleVisualState {
  progress: number;
  waypointIndex: number;
}

export function InstancedVehicleRenderer({
  vehicles,
  gridWidth,
  gridHeight,
}: InstancedVehicleRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const visualStateRef = useRef<Map<number, VehicleVisualState>>(new Map());

  // Proportional stylized vehicle geometry (0.18 wide x 0.14 high x 0.38 long)
  const geo = useMemo(() => {
    const box = new THREE.BoxGeometry(0.18, 0.14, 0.38);
    box.translate(0, 0.07, 0);
    return box;
  }, []);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 }), []);

  useFrame((_, delta) => {
    if (!meshRef.current || vehicles.length === 0) return;
    const mesh = meshRef.current;
    const count = Math.min(vehicles.length, 100);
    const vStates = visualStateRef.current;

    for (let i = 0; i < count; i++) {
      const v = vehicles[i];
      if (!v.path || v.path.length < 2) continue;

      let vState = vStates.get(v.id);
      if (!vState) {
        vState = { progress: v.progress || 0, waypointIndex: v.currentWaypointIndex || 0 };
        vStates.set(v.id, vState);
      } else {
        // Force-align rendering state if simulation moves waypoint or drifts significantly
        if (vState.waypointIndex !== v.currentWaypointIndex) {
          vState.waypointIndex = v.currentWaypointIndex;
          vState.progress = v.progress;
        } else if (Math.abs(vState.progress - v.progress) > 0.45) {
          vState.progress = THREE.MathUtils.lerp(vState.progress, v.progress, 0.25);
        }
      }

      vState.progress += delta * (v.speed || 1.2);
      if (vState.progress >= 1.0) {
        vState.progress = 0;
        vState.waypointIndex = (vState.waypointIndex + 1) % (v.path.length - 1);
      }

      const p1 = v.path[vState.waypointIndex];
      const p2 = v.path[vState.waypointIndex + 1] || v.path[0];

      const [w1x, , w1z] = gridToWorld(p1[0], p1[2], gridWidth, gridHeight);
      const [w2x, , w2z] = gridToWorld(p2[0], p2[2], gridWidth, gridHeight);

      const curX = w1x + (w2x - w1x) * vState.progress;
      const curY = p1[1] + (p2[1] - p1[1]) * vState.progress + 0.02;
      const curZ = w1z + (w2z - w1z) * vState.progress;

      dummyPos.set(curX, curY, curZ);
      dummyDir.set(w2x - w1x, 0, w2z - w1z).normalize();

      const angle = Math.atan2(dummyDir.x, dummyDir.z);

      dummyMatrix.makeRotationY(angle);
      dummyMatrix.setPosition(dummyPos);

      mesh.setMatrixAt(i, dummyMatrix);

      dummyColor.set(v.color || '#3b82f6');
      const currentNightFactor = GraphicsState.uniforms.uNightFactor.value;
      if (currentNightFactor > 0.3) {
        dummyColor.lerp(new THREE.Color('#fef08a'), 0.35); // Headlight glow at night
      }
      mesh.setColorAt(i, dummyColor);
    }

    // Prune stale vehicle visual states to avoid memory leak
    if (vStates.size > vehicles.length * 2) {
      const activeIds = new Set(vehicles.map((veh) => veh.id));
      for (const id of vStates.keys()) {
        if (!activeIds.has(id)) {
          vStates.delete(id);
        }
      }
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
