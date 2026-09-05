import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraControllerProps {
  viewMode: '2D' | '3D';
  zoom: number;
  pitch: number;
  rotation: number;
  gridWidth?: number;
  gridHeight?: number;
}

export function CameraController({ viewMode, zoom, pitch, rotation, gridWidth = 60, gridHeight = 60 }: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const keysRef = useRef<Record<string, boolean>>({});

  const halfW = gridWidth / 2;
  const halfH = gridHeight / 2;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      keysRef.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;

    if (viewMode === '2D') {
      camera.position.set(0, 28 / zoom, 0.01);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.maxPolarAngle = 0.01;
      controlsRef.current.minPolarAngle = 0;
    } else {
      const pitchRad = (pitch * Math.PI) / 180;
      const rotRad = (rotation * Math.PI) / 180;

      const distance = 30 / zoom;
      const camY = Math.sin(pitchRad) * distance;
      const planeDist = Math.cos(pitchRad) * distance;
      const camX = Math.sin(rotRad) * planeDist;
      const camZ = Math.cos(rotRad) * planeDist;

      camera.position.set(camX, camY, camZ);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.05;
      controlsRef.current.minPolarAngle = 0.1;
    }

    controlsRef.current.update();
  }, [viewMode, zoom, pitch, rotation, camera]);

  // Keyboard Panning WASD / Arrows
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const keys = keysRef.current;
    const speed = 12 * delta;

    let moveX = 0;
    let moveZ = 0;

    if (keys['w'] || keys['arrowup']) moveZ -= speed;
    if (keys['s'] || keys['arrowdown']) moveZ += speed;
    if (keys['a'] || keys['arrowleft']) moveX -= speed;
    if (keys['d'] || keys['arrowright']) moveX += speed;

    if (moveX !== 0 || moveZ !== 0) {
      const target = controlsRef.current.target;
      target.x = THREE.MathUtils.clamp(target.x + moveX, -halfW, halfW);
      target.z = THREE.MathUtils.clamp(target.z + moveZ, -halfH, halfH);

      camera.position.x = THREE.MathUtils.clamp(camera.position.x + moveX, -halfW - 20, halfW + 20);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + moveZ, -halfH - 20, halfH + 20);

      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={6}
      maxDistance={65}
      target={[0, 0, 0]}
    />
  );
}
