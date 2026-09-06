import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DayNightState } from './types3D';

interface DayNightSkyProps {
  day: number;
  speed: number;
  onNightFactorChange?: (nightFactor: number) => void;
}

export function DayNightSky({ day, speed, onNightFactorChange }: DayNightSkyProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const skyRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef<number>(0.3); // Start at morning/daylight (0.3)

  useFrame((_, delta) => {
    if (speed > 0) {
      // Smoothly advance time of day: 1 full cycle = 40 seconds at speed 1, 15s at speed 2
      const cycleRate = speed === 2 ? 0.05 : 0.02;
      timeRef.current = (timeRef.current + delta * cycleRate) % 1.0;
    }

    const t = timeRef.current; // 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
    
    // Calculate sun angle
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunX = Math.cos(sunAngle) * 35;
    const sunY = Math.sin(sunAngle) * 35;
    const sunZ = Math.sin(sunAngle * 0.5) * 15 + 10;

    // Calculate night factor (0 = day, 1 = deep night)
    const nightFactor = Math.max(0, Math.min(1, (-sunY + 5) / 15));
    if (onNightFactorChange) {
      onNightFactorChange(nightFactor);
    }

    if (sunRef.current) {
      sunRef.current.position.set(sunX, Math.max(2, sunY), sunZ);
      
      // Sun intensity & color gradient
      if (sunY > 0) {
        sunRef.current.intensity = Math.min(1.8, (sunY / 35) * 2.2);
        const sunsetBlend = Math.max(0, 1 - sunY / 15);
        // Blend white sunlight to golden/orange sunset
        const r = 1.0;
        const g = 0.95 - sunsetBlend * 0.4;
        const b = 0.85 - sunsetBlend * 0.6;
        sunRef.current.color.setRGB(r, g, b);
      } else {
        // Moon / Night light
        sunRef.current.intensity = 0.2;
        sunRef.current.color.setHex(0x3b82f6); // Soft blue moonlight
      }
    }
  });

  return (
    <>
      {/* Directional Sun / Moon Light with Crisp, Stable Shadows */}
      <directionalLight
        ref={sunRef}
        position={[28, 32, 22]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={130}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />

      {/* Realistic Ambient & Dual-Color Hemisphere Lighting */}
      <ambientLight intensity={0.45} color="#f8fafc" />
      <hemisphereLight args={['#bae6fd', '#334155', 0.75]} />

      {/* Atmospheric Soft Distance Fog */}
      <fog attach="fog" args={['#0f172a', 45, 160]} />

    </>
  );
}
