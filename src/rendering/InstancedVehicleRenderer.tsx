import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SimulatedVehicle, TileData } from '../types';
import { gridToWorld } from '../components/world/types3D';
import { LANE_OFFSET, getRoadSurfaceY } from '../core/world/GridRoadNetwork';
import {
  createSedanGeometry,
  createSUVGeometry,
  createBusGeometry,
  createTruckGeometry,
  createEmergencyGeometry,
} from './VehicleArchetypes';
import { VehicleShaderMaterial } from './CustomMaterials';

interface InstancedVehicleRendererProps {
  vehicles: SimulatedVehicle[];
  gridWidth: number;
  gridHeight: number;
  grid?: TileData[][];
}

const dummyMatrix = new THREE.Matrix4();
const dummyColor = new THREE.Color();
const dummyPos = new THREE.Vector3();
const dummyDir = new THREE.Vector3();
const dummyRight = new THREE.Vector3();
const dummyRot = new THREE.Quaternion();
const dummyScale = new THREE.Vector3(1, 1, 1);

interface VehicleVisualState {
  progress: number;
  waypointIndex: number;
  currentAngle: number;
}

export function InstancedVehicleRenderer({
  vehicles,
  gridWidth,
  gridHeight,
  grid,
}: InstancedVehicleRendererProps) {
  // Dedicated instanced mesh references per vehicle archetype
  const sedanMeshRef = useRef<THREE.InstancedMesh>(null);
  const suvMeshRef = useRef<THREE.InstancedMesh>(null);
  const busMeshRef = useRef<THREE.InstancedMesh>(null);
  const truckMeshRef = useRef<THREE.InstancedMesh>(null);
  const emergencyMeshRef = useRef<THREE.InstancedMesh>(null);

  const visualStateRef = useRef<Map<number, VehicleVisualState>>(new Map());

  // Procedural archetype geometries with detailed sub-parts & vertex colors
  const sedanGeo = useMemo(() => createSedanGeometry(), []);
  const suvGeo = useMemo(() => createSUVGeometry(), []);
  const busGeo = useMemo(() => createBusGeometry(), []);
  const truckGeo = useMemo(() => createTruckGeometry(), []);
  const emergencyGeo = useMemo(() => createEmergencyGeometry('police'), []);

  // Shared high-performance vehicle shader material
  const vehicleMat = useMemo(() => VehicleShaderMaterial(), []);

  // Classify active vehicles into archetypes
  const { sedanVehicles, suvVehicles, busVehicles, truckVehicles, emergencyVehicles } = useMemo(() => {
    const sedans: SimulatedVehicle[] = [];
    const suvs: SimulatedVehicle[] = [];
    const buses: SimulatedVehicle[] = [];
    const trucks: SimulatedVehicle[] = [];
    const emergencies: SimulatedVehicle[] = [];

    vehicles.forEach((v) => {
      if (v.type === 'bus') {
        buses.push(v);
      } else if (v.type === 'truck') {
        trucks.push(v);
      } else if (v.type === 'police' || v.type === 'fire' || v.type === 'ambulance') {
        emergencies.push(v);
      } else {
        // Natural distribution between modern sedans and SUVs
        if (v.id % 3 === 0) {
          suvs.push(v);
        } else {
          sedans.push(v);
        }
      }
    });

    return {
      sedanVehicles: sedans,
      suvVehicles: suvs,
      busVehicles: buses,
      truckVehicles: trucks,
      emergencyVehicles: emergencies,
    };
  }, [vehicles]);

  useFrame((_, delta) => {
    const vStates = visualStateRef.current;
    // Dynamically computed lane offset matching roadWidth / 4 = 0.18
    const laneOffsetDist = LANE_OFFSET;

    const updateMeshArchetype = (
      mesh: THREE.InstancedMesh | null,
      archetypeList: SimulatedVehicle[],
      maxCount: number
    ) => {
      if (!mesh) return;
      const count = Math.min(archetypeList.length, maxCount);
      mesh.count = count;

      for (let i = 0; i < count; i++) {
        const v = archetypeList[i];
        if (!v.path || v.path.length < 2) continue;

        let vState = vStates.get(v.id);
        if (!vState) {
          vState = {
            progress: v.progress || 0,
            waypointIndex: v.currentWaypointIndex || 0,
            currentAngle: 0,
          };
          vStates.set(v.id, vState);
        } else {
          // Force-align rendering state if simulation jumps waypoint or drifts significantly
          if (vState.waypointIndex !== v.currentWaypointIndex) {
            vState.waypointIndex = v.currentWaypointIndex;
            vState.progress = v.progress;
          } else if (Math.abs(vState.progress - v.progress) > 0.40) {
            vState.progress = THREE.MathUtils.lerp(vState.progress, v.progress, 0.20);
          }
        }

        vState.progress += delta * (v.speed || 1.1);
        if (vState.progress >= 1.0) {
          vState.progress = 0;
          vState.waypointIndex = (vState.waypointIndex + 1) % (v.path.length - 1);
        }

        const p1 = v.path[vState.waypointIndex];
        const p2 = v.path[vState.waypointIndex + 1] || v.path[0];

        const [w1x, , w1z] = gridToWorld(p1[0], p1[2], gridWidth, gridHeight);
        const [w2x, , w2z] = gridToWorld(p2[0], p2[2], gridWidth, gridHeight);

        // Direction of motion
        dummyDir.set(w2x - w1x, 0, w2z - w1z).normalize();

        // Perpendicular right lateral vector for proper right-lane traffic positioning
        dummyRight.set(-dummyDir.z, 0, dummyDir.x);

        // Interpolated centerline position + right lane offset
        const curX = w1x + (w2x - w1x) * vState.progress + dummyRight.x * laneOffsetDist;
        const curZ = w1z + (w2z - w1z) * vState.progress + dummyRight.z * laneOffsetDist;

        // Elevation strictly follows road/bridge surface (never dips onto water surface)
        let y1 = p1[1] + 0.02;
        let y2 = p2[1] + 0.02;
        if (grid) {
          // getRoadSurfaceY returns (elev + ROAD_ASPHALT_Y_OFFSET)
          // Adding 0.015 ensures wheels sit right above the marking layer, eliminating z-fighting
          y1 = getRoadSurfaceY(grid, p1[0], p1[2]) + 0.015;
          y2 = getRoadSurfaceY(grid, p2[0], p2[2]) + 0.015;
        }
        const curY = y1 + (y2 - y1) * vState.progress;

        dummyPos.set(curX, curY, curZ);

        // Smooth rotation angle for cornering
        const targetAngle = Math.atan2(dummyDir.x, dummyDir.z);
        if (Math.abs(vState.currentAngle - targetAngle) > Math.PI) {
          vState.currentAngle = targetAngle;
        } else {
          vState.currentAngle = THREE.MathUtils.lerp(vState.currentAngle, targetAngle, 0.25);
        }

        dummyRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), vState.currentAngle);
        dummyMatrix.compose(dummyPos, dummyRot, dummyScale);

        mesh.setMatrixAt(i, dummyMatrix);

        // Set instance paint color
        dummyColor.set(v.color || '#3b82f6');
        mesh.setColorAt(i, dummyColor);
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    updateMeshArchetype(sedanMeshRef.current, sedanVehicles, 60);
    updateMeshArchetype(suvMeshRef.current, suvVehicles, 40);
    updateMeshArchetype(busMeshRef.current, busVehicles, 25);
    updateMeshArchetype(truckMeshRef.current, truckVehicles, 30);
    updateMeshArchetype(emergencyMeshRef.current, emergencyVehicles, 15);

    // Periodic memory cleanup of stale visual states
    if (vStates.size > vehicles.length * 2 + 10) {
      const activeIds = new Set(vehicles.map((veh) => veh.id));
      for (const id of vStates.keys()) {
        if (!activeIds.has(id)) {
          vStates.delete(id);
        }
      }
    }
  });

  if (vehicles.length === 0) return null;

  return (
    <group name="InstancedCityVehicles">
      {sedanVehicles.length > 0 && (
        <instancedMesh
          ref={sedanMeshRef}
          args={[sedanGeo, vehicleMat, 60]}
          castShadow
          receiveShadow
        />
      )}
      {suvVehicles.length > 0 && (
        <instancedMesh
          ref={suvMeshRef}
          args={[suvGeo, vehicleMat, 40]}
          castShadow
          receiveShadow
        />
      )}
      {busVehicles.length > 0 && (
        <instancedMesh
          ref={busMeshRef}
          args={[busGeo, vehicleMat, 25]}
          castShadow
          receiveShadow
        />
      )}
      {truckVehicles.length > 0 && (
        <instancedMesh
          ref={truckMeshRef}
          args={[truckGeo, vehicleMat, 30]}
          castShadow
          receiveShadow
        />
      )}
      {emergencyVehicles.length > 0 && (
        <instancedMesh
          ref={emergencyMeshRef}
          args={[emergencyGeo, vehicleMat, 15]}
          castShadow
          receiveShadow
        />
      )}
    </group>
  );
}
