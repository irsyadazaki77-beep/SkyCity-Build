import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphicsState } from '../../rendering/GraphicsState';

interface DayNightSkyProps {
  day: number;
  speed: number;
}

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vViewDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = `
  uniform vec3 uSunDirection;
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float up = max(0.0, dir.y);
    
    // Clean, crisp daylight atmospheric sky gradient
    vec3 skyZenith   = vec3(0.22, 0.58, 0.88); // Crisp clear sky blue
    vec3 skyHorizon  = vec3(0.80, 0.88, 0.96); // Soft atmospheric horizon
    
    vec3 currentSky = mix(skyHorizon, skyZenith, pow(up, 0.60));

    // Subtle sun disc & soft halo
    float sunCos = dot(dir, uSunDirection);
    float sunDisk = smoothstep(0.9988, 0.9997, sunCos);
    float sunGlow = pow(max(0.0, sunCos), 12.0) * 0.15;
    
    vec3 sunColor = vec3(1.0, 0.98, 0.92);
    currentSky += sunColor * (sunDisk * 1.8 + sunGlow);

    // Subtle horizon haze blending
    float haze = exp(-up * 4.0);
    currentSky = mix(currentSky, skyHorizon, haze * 0.35);

    gl_FragColor = vec4(currentSky, 1.0);
  }
`;

export function DayNightSky({ day, speed }: DayNightSkyProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const skyRef = useRef<THREE.ShaderMaterial>(null);
  const skyMeshRef = useRef<THREE.Mesh>(null);

  const skyUniforms = useMemo(() => ({
    uSunDirection: GraphicsState.uniforms.uSunDirection,
    uNightFactor: GraphicsState.uniforms.uNightFactor,
    uTime: GraphicsState.uniforms.uTime,
  }), []);

  const { gl } = useThree();

  useFrame((state, delta) => {
    if (skyMeshRef.current) {
      skyMeshRef.current.position.copy(state.camera.position);
    }

    const camX = state.camera.position.x;
    const camZ = state.camera.position.z;

    // Fixed optimal sun direction for crisp daylight rendering & readable 3D depth
    const sunDir = new THREE.Vector3(45, 75, 35).normalize();
    GraphicsState.uniforms.uSunDirection.value.copy(sunDir);
    GraphicsState.uniforms.uTime.value = state.clock.elapsedTime;
    GraphicsState.uniforms.uNightFactor.value = 0.0;
    GraphicsState.uniforms.uWaterTime.value += delta;

    // Stable neutral atmospheric fog, ambient fill & sunlight colors
    const fogColor = new THREE.Color('#e2e8f0');
    const ambientColor = new THREE.Color(0.92, 0.94, 0.97);
    const sunColor = new THREE.Color(1.0, 0.985, 0.96);

    GraphicsState.uniforms.uFogColor.value.copy(fogColor);
    GraphicsState.uniforms.uAmbientColor.value.copy(ambientColor);
    GraphicsState.uniforms.uSunColor.value.copy(sunColor);
    GraphicsState.uniforms.uExposure.value = 1.0;

    if (state.scene.fog && state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.copy(fogColor);
    }

    if (sunRef.current) {
      sunRef.current.position.set(camX + 45, 75, camZ + 35);
      sunRef.current.target.position.set(camX, 0, camZ);
      sunRef.current.target.updateMatrixWorld();
      
      sunRef.current.intensity = 1.35;
      sunRef.current.color.copy(sunColor);
    }
  });

  return (
    <>
      {/* Procedural Sky Dome centered on camera */}
      <mesh ref={skyMeshRef} scale={[500, 500, 500]}>
        <sphereGeometry args={[1, 32, 32]} />
        <shaderMaterial
          ref={skyRef}
          vertexShader={SKY_VERTEX_SHADER}
          fragmentShader={SKY_FRAGMENT_SHADER}
          uniforms={skyUniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Main Single Directional Sun Source */}
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />

      {/* Single Hemisphere Fill Light (Clean sky fill & ground bounce, no conflicting ambient) */}
      <hemisphereLight args={['#f8fafc', '#94a3b8', 0.50]} />

      {/* Neutral Daylight Atmospheric Fog */}
      <fog attach="fog" args={['#e2e8f0', 120, 380]} />
    </>
  );
}

