import React, { useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { gridToWorld } from './types3D';

// Global shared materials to prevent massive memory leaks and draw call overhead
const sharedMats = {
  resL1: new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.6 }),
  resL1_abd: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.6 }),
  resL2: new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.5 }),
  resL2_abd: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5 }),
  resL3: new THREE.MeshStandardMaterial({ color: '#047857', roughness: 0.4 }),
  resL3_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 }),
  resL4: new THREE.MeshStandardMaterial({ color: '#34d399', roughness: 0.3, metalness: 0.3 }),
  resL4_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.3 }),
  resL5: new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.2, metalness: 0.7 }),
  resL5_abd: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.7 }),

  comL1: new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.5 }),
  comL1_abd: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5 }),
  comL2: new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 }),
  comL2_abd: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 }),
  comL3: new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.3, metalness: 0.4 }),
  comL3_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.4 }),
  comL4: new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.2, metalness: 0.6 }),
  comL4_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.2, metalness: 0.6 }),
  comL5: new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.1, metalness: 0.8 }),
  comL5_abd: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.1, metalness: 0.8 }),

  indL1: new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.7 }),
  indL1_abd: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 }),
  indL2: new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.6, metalness: 0.2 }),
  indL2_abd: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6, metalness: 0.2 }),
  indL3: new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.5, metalness: 0.4 }),
  indL3_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.4 }),
  indL4: new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.3, metalness: 0.6 }),
  indL4_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.6 }),
  indL5: new THREE.MeshStandardMaterial({ color: '#14b8a6', roughness: 0.2, metalness: 0.8 }),
  indL5_abd: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.8 }),

  roof: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 }),
  roofGreen: new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.7 }),
  brick: new THREE.MeshStandardMaterial({ color: '#9a3412', roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 }),
  water: new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.1, metalness: 0.5 }),

  window: new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#fde047', emissiveIntensity: 0, roughness: 0.2 }),
  window_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', emissive: '#000000', emissiveIntensity: 0, roughness: 0.2 }),

  windowCyan: new THREE.MeshStandardMaterial({ color: '#a5f3fc', emissive: '#38bdf8', emissiveIntensity: 0, roughness: 0.2 }),
  windowCyan_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', emissive: '#000000', emissiveIntensity: 0, roughness: 0.2 }),

  redAlert: new THREE.MeshBasicMaterial({ color: '#ef4444' }),
  white: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 }),
  redCross: new THREE.MeshBasicMaterial({ color: '#dc2626' }),
};

interface BuildingMeshProps {
  tile: TileData;
  nightFactor: number;
  gridWidth?: number;
  gridHeight?: number;
}

// Global update for window emissive intensity based on day/night cycle
let lastNightFactor = -1;

export function BuildingMesh({ tile, nightFactor, gridWidth, gridHeight }: BuildingMeshProps) {
  const [wx, , wz] = gridToWorld(tile.x, tile.y, gridWidth, gridHeight);
  const wy = (tile.elevation || 0) * 0.15;
  const { type, level = 1, abandoned, powered, watered } = tile;

  // Update shared global emissive intensities to avoid per-instance React state re-renders
  if (nightFactor !== lastNightFactor) {
    const windowGlow = nightFactor > 0.25 ? Math.min(1.2, (nightFactor - 0.25) * 1.6) : 0;
    sharedMats.window.emissiveIntensity = windowGlow;
    sharedMats.windowCyan.emissiveIntensity = windowGlow * 1.1;
    lastNightFactor = nightFactor;
  }

  const mats = {
    resL1: abandoned ? sharedMats.resL1_abd : sharedMats.resL1,
    resL2: abandoned ? sharedMats.resL2_abd : sharedMats.resL2,
    resL3: abandoned ? sharedMats.resL3_abd : sharedMats.resL3,
    resL4: abandoned ? sharedMats.resL4_abd : sharedMats.resL4,
    resL5: abandoned ? sharedMats.resL5_abd : sharedMats.resL5,
    comL1: abandoned ? sharedMats.comL1_abd : sharedMats.comL1,
    comL2: abandoned ? sharedMats.comL2_abd : sharedMats.comL2,
    comL3: abandoned ? sharedMats.comL3_abd : sharedMats.comL3,
    comL4: abandoned ? sharedMats.comL4_abd : sharedMats.comL4,
    comL5: abandoned ? sharedMats.comL5_abd : sharedMats.comL5,
    indL1: abandoned ? sharedMats.indL1_abd : sharedMats.indL1,
    indL2: abandoned ? sharedMats.indL2_abd : sharedMats.indL2,
    indL3: abandoned ? sharedMats.indL3_abd : sharedMats.indL3,
    indL4: abandoned ? sharedMats.indL4_abd : sharedMats.indL4,
    indL5: abandoned ? sharedMats.indL5_abd : sharedMats.indL5,
    roof: sharedMats.roof,
    roofGreen: sharedMats.roofGreen,
    brick: sharedMats.brick,
    metal: sharedMats.metal,
    glass: sharedMats.glass,
    water: sharedMats.water,
    window: abandoned ? sharedMats.window_abd : sharedMats.window,
    windowCyan: abandoned ? sharedMats.windowCyan_abd : sharedMats.windowCyan,
    redAlert: sharedMats.redAlert,
    white: sharedMats.white,
    redCross: sharedMats.redCross,
  };

  // Handle empty or zero occupancy
  const safeLevel = Math.min(5, Math.max(1, level));

  // Render individual building procedural shapes based on TileType & Level
  return (
    <group position={[wx, wy, wz]}>
      {/* ---------------- RESIDENTIAL BUILDINGS (L1 - L5) ---------------- */}
      {type === TileType.RESIDENTIAL && (
        <group>
          {/* Level 1: Suburban Cottage */}
          {safeLevel === 1 && (
            <group position={[0, 0, 0]}>
              <mesh material={mats.resL1} position={[0, 0.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.55, 0.35, 0.55]} />
              </mesh>
              {/* Pitched Roof */}
              <mesh material={mats.brick} position={[0, 0.45, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[0.45, 0.25, 4]} />
              </mesh>
              {/* Windows */}
              <mesh material={mats.window} position={[0, 0.2, 0.28]}>
                <planeGeometry args={[0.15, 0.12]} />
              </mesh>
            </group>
          )}

          {/* Level 2: Modern Townhouse */}
          {safeLevel === 2 && (
            <group>
              <mesh material={mats.resL2} position={[-0.15, 0.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.3, 0.7, 0.55]} />
              </mesh>
              <mesh material={mats.resL2} position={[0.15, 0.38, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.3, 0.75, 0.55]} />
              </mesh>
              <mesh material={mats.roof} position={[0, 0.72, 0]}>
                <boxGeometry args={[0.62, 0.04, 0.57]} />
              </mesh>
              {/* Windows */}
              <mesh material={mats.window} position={[-0.15, 0.45, 0.28]}>
                <planeGeometry args={[0.18, 0.2]} />
              </mesh>
              <mesh material={mats.window} position={[0.15, 0.45, 0.28]}>
                <planeGeometry args={[0.18, 0.2]} />
              </mesh>
            </group>
          )}

          {/* Level 3: Apartment Block */}
          {safeLevel === 3 && (
            <group>
              <mesh material={mats.resL3} position={[0, 0.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.68, 1.2, 0.68]} />
              </mesh>
              <mesh material={mats.roof} position={[0, 1.22, 0]}>
                <boxGeometry args={[0.7, 0.05, 0.7]} />
              </mesh>
              {/* AC Unit on roof */}
              <mesh material={mats.metal} position={[0.15, 1.28, 0.15]} castShadow>
                <boxGeometry args={[0.15, 0.1, 0.15]} />
              </mesh>
              {/* Front windows grid */}
              <mesh material={mats.window} position={[0, 0.7, 0.345]}>
                <planeGeometry args={[0.45, 0.7]} />
              </mesh>
            </group>
          )}

          {/* Level 4: High-Rise Residential */}
          {safeLevel === 4 && (
            <group>
              <mesh material={mats.resL4} position={[0, 0.95, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.7, 1.9, 0.7]} />
              </mesh>
              {/* Green Roof Terrace */}
              <mesh material={mats.roofGreen} position={[0, 1.91, 0]}>
                <boxGeometry args={[0.65, 0.04, 0.65]} />
              </mesh>
              {/* Corner balconies */}
              <mesh material={mats.glass} position={[0, 1.0, 0.355]}>
                <planeGeometry args={[0.5, 1.4]} />
              </mesh>
            </group>
          )}

          {/* Level 5: Luxury Skyscraper */}
          {safeLevel === safeLevel && safeLevel === 5 && (
            <group>
              <mesh material={mats.resL5} position={[0, 1.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 2.7, 0.65]} />
              </mesh>
              {/* Penthouse crown */}
              <mesh material={mats.glass} position={[0, 2.8, 0]} castShadow>
                <boxGeometry args={[0.45, 0.3, 0.45]} />
              </mesh>
              {/* Spire */}
              <mesh material={mats.metal} position={[0, 3.1, 0]}>
                <cylinderGeometry args={[0.02, 0.04, 0.4]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.4, 0.33]}>
                <planeGeometry args={[0.48, 2.2]} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ---------------- COMMERCIAL BUILDINGS (L1 - L5) ---------------- */}
      {type === TileType.COMMERCIAL && (
        <group>
          {/* Level 1: Shop */}
          {safeLevel === 1 && (
            <group>
              <mesh material={mats.comL1} position={[0, 0.22, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.6, 0.44, 0.6]} />
              </mesh>
              {/* Awning */}
              <mesh material={mats.brick} position={[0, 0.25, 0.32]} rotation={[0.3, 0, 0]}>
                <boxGeometry args={[0.55, 0.03, 0.15]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 0.18, 0.31]}>
                <planeGeometry args={[0.45, 0.22]} />
              </mesh>
            </group>
          )}

          {/* Level 2: Mid-Rise Office */}
          {safeLevel === 2 && (
            <group>
              <mesh material={mats.comL2} position={[0, 0.45, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 0.9, 0.65]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 0.5, 0.33]}>
                <planeGeometry args={[0.48, 0.6]} />
              </mesh>
            </group>
          )}

          {/* Level 3: Commercial Plaza */}
          {safeLevel === 3 && (
            <group>
              <mesh material={mats.comL3} position={[0, 0.75, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.72, 1.5, 0.72]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 0.8, 0.365]}>
                <planeGeometry args={[0.55, 1.1]} />
              </mesh>
            </group>
          )}

          {/* Level 4: Glass Tower */}
          {safeLevel === 4 && (
            <group>
              <mesh material={mats.comL4} position={[0, 1.15, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.68, 2.3, 0.68]} />
              </mesh>
              <mesh material={mats.metal} position={[0, 2.33, 0]}>
                <boxGeometry args={[0.4, 0.1, 0.4]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.2, 0.345]}>
                <planeGeometry args={[0.5, 1.8]} />
              </mesh>
            </group>
          )}

          {/* Level 5: Crystal Commercial Skyscraper */}
          {safeLevel === 5 && (
            <group>
              <mesh material={mats.comL5} position={[0, 1.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 3.2, 0.65]} />
              </mesh>
              {/* Spire */}
              <mesh material={mats.metal} position={[0, 3.45, 0]}>
                <coneGeometry args={[0.15, 0.5, 4]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.6, 0.33]}>
                <planeGeometry args={[0.5, 2.6]} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ---------------- INDUSTRIAL BUILDINGS (L1 - L5) ---------------- */}
      {type === TileType.INDUSTRIAL && (
        <group>
          {/* Level 1: Workshop */}
          {safeLevel === 1 && (
            <group>
              <mesh material={mats.indL1} position={[0, 0.22, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 0.44, 0.65]} />
              </mesh>
              {/* Chimney */}
              <mesh material={mats.brick} position={[0.2, 0.48, -0.2]} castShadow>
                <cylinderGeometry args={[0.04, 0.05, 0.3]} />
              </mesh>
            </group>
          )}

          {/* Level 2: Factory */}
          {safeLevel === 2 && (
            <group>
              <mesh material={mats.indL2} position={[0, 0.4, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.7, 0.8, 0.7]} />
              </mesh>
              {/* Dual Exhaust Stacks */}
              <mesh material={mats.metal} position={[-0.2, 0.9, -0.2]} castShadow>
                <cylinderGeometry args={[0.04, 0.05, 0.4]} />
              </mesh>
              <mesh material={mats.metal} position={[0.2, 0.9, -0.2]} castShadow>
                <cylinderGeometry args={[0.04, 0.05, 0.4]} />
              </mesh>
            </group>
          )}

          {/* Level 3: Industrial Complex */}
          {safeLevel === 3 && (
            <group>
              <mesh material={mats.indL3} position={[-0.15, 0.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.4, 1.2, 0.65]} />
              </mesh>
              {/* Storage Silo */}
              <mesh material={mats.metal} position={[0.2, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.18, 1.0, 16]} />
              </mesh>
            </group>
          )}

          {/* Level 4: Clean Tech Factory */}
          {safeLevel === 4 && (
            <group>
              <mesh material={mats.indL4} position={[0, 0.9, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.7, 1.8, 0.7]} />
              </mesh>
              {/* Solar array roof */}
              <mesh material={mats.glass} position={[0, 1.82, 0]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.55, 0.03, 0.55]} />
              </mesh>
            </group>
          )}

          {/* Level 5: High-Tech Industrial Hub */}
          {safeLevel === 5 && (
            <group>
              <mesh material={mats.indL5} position={[0, 1.25, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.68, 2.5, 0.68]} />
              </mesh>
              <mesh material={mats.metal} position={[0, 2.53, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 0.08]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.3, 0.345]}>
                <planeGeometry args={[0.48, 1.9]} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ---------------- SPECIAL CITY SERVICES ---------------- */}
      {/* POWER PLANT */}
      {type === TileType.POWER_PLANT && (
        <group>
          {/* Main generator hall */}
          <mesh material={mats.metal} position={[-0.15, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.45, 0.7, 0.7]} />
          </mesh>
          {/* Cooling Tower */}
          <mesh material={mats.roof} position={[0.22, 0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.15, 0.25, 1.0, 16]} />
          </mesh>
        </group>
      )}

      {/* WATER PUMP */}
      {type === TileType.WATER_PUMP && (
        <group>
          {/* Pump house */}
          <mesh material={mats.comL2} position={[0, 0.25, -0.15]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.5, 0.4]} />
          </mesh>
          {/* Reservoir Basin */}
          <mesh material={mats.water} position={[0, 0.05, 0.2]}>
            <boxGeometry args={[0.6, 0.08, 0.4]} />
          </mesh>
          {/* Cylindrical Water Storage Tank */}
          <mesh material={mats.metal} position={[0.2, 0.55, -0.15]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.6]} />
          </mesh>
        </group>
      )}

      {/* FIRE STATION */}
      {type === TileType.FIRE_STATION && (
        <group>
          <mesh material={mats.brick} position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.7, 0.65]} />
          </mesh>
          {/* Hose Tower */}
          <mesh material={mats.brick} position={[0.22, 0.6, -0.2]} castShadow>
            <boxGeometry args={[0.2, 1.2, 0.2]} />
          </mesh>
          {/* Red garage doors */}
          <mesh material={mats.redAlert} position={[-0.1, 0.22, 0.33]}>
            <planeGeometry args={[0.3, 0.35]} />
          </mesh>
        </group>
      )}

      {/* POLICE STATION */}
      {type === TileType.POLICE_STATION && (
        <group>
          <mesh material={mats.comL3} position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.9, 0.7]} />
          </mesh>
          {/* Rooftop Helipad */}
          <mesh material={mats.metal} position={[0, 0.92, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04]} />
          </mesh>
        </group>
      )}

      {/* CLINIC / HOSPITAL */}
      {type === TileType.CLINIC && (
        <group>
          <mesh material={mats.white} position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.8, 0.7]} />
          </mesh>
          {/* Red Cross Emblem */}
          <group position={[0, 0.5, 0.352]}>
            <mesh material={mats.redCross}>
              <planeGeometry args={[0.25, 0.08]} />
            </mesh>
            <mesh material={mats.redCross}>
              <planeGeometry args={[0.08, 0.25]} />
            </mesh>
          </group>
        </group>
      )}

      {/* SCHOOL */}
      {type === TileType.SCHOOL && (
        <group>
          <mesh material={mats.brick} position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 0.6, 0.6]} />
          </mesh>
          {/* Clock tower */}
          <mesh material={mats.brick} position={[0, 0.55, 0.2]} castShadow>
            <boxGeometry args={[0.2, 0.9, 0.2]} />
          </mesh>
        </group>
      )}

      {/* WASTE MANAGEMENT */}
      {type === TileType.WASTE_MANAGEMENT && (
        <group>
          <mesh material={mats.roof} position={[-0.1, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.6, 0.65]} />
          </mesh>
          <mesh material={mats.metal} position={[0.22, 0.2, 0]} castShadow>
            <boxGeometry args={[0.25, 0.4, 0.4]} />
          </mesh>
        </group>
      )}

      {/* PARK */}
      {type === TileType.PARK && (
        <group>
          {/* Central Fountain / Pond */}
          <mesh material={mats.water} position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04]} />
          </mesh>
          {/* Small Park Trees */}
          <mesh material={mats.roofGreen} position={[-0.25, 0.25, -0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
          <mesh material={mats.roofGreen} position={[0.25, 0.25, -0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
          <mesh material={mats.roofGreen} position={[-0.25, 0.25, 0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
          <mesh material={mats.roofGreen} position={[0.25, 0.25, 0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
        </group>
      )}

      {/* ---------------- UNPOWERED / UNWATERED / ABANDONED WARNING BADGE ---------------- */}
      {(type === TileType.RESIDENTIAL ||
        type === TileType.COMMERCIAL ||
        type === TileType.INDUSTRIAL ||
        type === TileType.FIRE_STATION ||
        type === TileType.POLICE_STATION ||
        type === TileType.CLINIC ||
        type === TileType.SCHOOL ||
        type === TileType.WASTE_MANAGEMENT) &&
        (!powered || !watered || abandoned) && (
          <mesh position={[0, 1.8 + safeLevel * 0.3, 0]}>
            <octahedronGeometry args={[0.12]} />
            <meshBasicMaterial color={abandoned ? '#64748b' : '#ef4444'} wireframe />
          </mesh>
        )}
    </group>
  );
}
