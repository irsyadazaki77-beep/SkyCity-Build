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
  uniform float uNightFactor;
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  // Fast hash for stars
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float up = max(0.0, dir.y);
    
    // 1. Natural Rayleigh Atmosphere Gradient
    vec3 skyZenith   = vec3(0.18, 0.48, 0.82); // Crisp azure
    vec3 skyHorizon  = vec3(0.72, 0.84, 0.94); // Light atmospheric horizon
    vec3 nightZenith = vec3(0.012, 0.028, 0.075); // Deep midnight indigo
    vec3 nightHorizon= vec3(0.035, 0.065, 0.130); // Horizon night glow
    
    // Blend daytime sky by elevation angle
    vec3 daySky = mix(skyHorizon, skyZenith, pow(up, 0.65));
    vec3 nightSky = mix(nightHorizon, nightZenith, pow(up, 0.75));

    // 2. Rich Golden Hour / Sunset & Sunrise Atmosphere
    float sunY = uSunDirection.y;
    float sunsetBlend = smoothstep(0.35, -0.05, abs(sunY));
    vec3 sunsetZenith  = vec3(0.25, 0.28, 0.55); // Violet evening zenith
    vec3 sunsetHorizon = vec3(0.98, 0.52, 0.22); // Warm amber horizon
    vec3 sunsetSky = mix(sunsetHorizon, sunsetZenith, pow(up, 0.55));
    
    vec3 currentSky = mix(daySky, sunsetSky, sunsetBlend * 0.85);
    currentSky = mix(currentSky, nightSky, uNightFactor);

    // 3. Sun Disk & Corona Glow
    float sunCos = dot(dir, uSunDirection);
    float sunDisk = smoothstep(0.9985, 0.9996, sunCos);
    float sunCorona = pow(max(0.0, sunCos), 48.0) * 0.45;
    float sunGlow = pow(max(0.0, sunCos), 8.0) * 0.18;
    
    vec3 sunColor = mix(vec3(1.0, 0.96, 0.88), vec3(1.0, 0.45, 0.15), sunsetBlend);
    currentSky += sunColor * (sunDisk * 2.0 + sunCorona + sunGlow) * (1.0 - uNightFactor);

    // 4. Moon Disk & Celestial Glow
    vec3 moonDir = -uSunDirection;
    float moonCos = dot(dir, moonDir);
    float moonDisk = smoothstep(0.9980, 0.9992, moonCos);
    float moonCorona = pow(max(0.0, moonCos), 36.0) * 0.22;
    vec3 moonColor = vec3(0.88, 0.94, 1.0);
    currentSky += moonColor * (moonDisk * 1.8 + moonCorona) * uNightFactor;

    // 5. Constellations & Twinkling Night Stars
    if (uNightFactor > 0.35) {
      float starNoise = hash(floor(dir * 280.0));
      if (starNoise > 0.993) {
        float twinkle = 0.6 + 0.4 * sin(uTime * 2.5 + starNoise * 120.0);
        float starIntensity = smoothstep(0.35, 0.9, uNightFactor) * (starNoise - 0.993) * 200.0;
        currentSky += vec3(0.95, 0.98, 1.0) * twinkle * starIntensity;
      }
    }

    // 6. Horizon Atmospheric Haze Blend
    float haze = exp(-up * 3.5);
    vec3 hazeColor = mix(skyHorizon, nightHorizon, uNightFactor);
    currentSky = mix(currentSky, hazeColor, haze * 0.45);

    gl_FragColor = vec4(currentSky, 1.0);
  }
`;

export function DayNightSky({ day, speed }: DayNightSkyProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const skyRef = useRef<THREE.ShaderMaterial>(null);
  const skyMeshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef<number>((day % 50) / 50.0);
  const lastDayRef = useRef<number>(day);

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

    if (Math.abs(day - lastDayRef.current) > 1) {
      timeRef.current = (day % 50) / 50.0;
    }
    lastDayRef.current = day;

    if (speed > 0) {
      const cycleRate = speed === 2 ? 0.05 : 0.02;
      timeRef.current = (timeRef.current + delta * cycleRate) % 1.0;
    }

    const t = timeRef.current;
    const sunAngle = (t - 0.25) * Math.PI * 2;
    
    // Sun position calculation relative to camera center
    const camX = state.camera.position.x;
    const camZ = state.camera.position.z;

    const sunX = Math.cos(sunAngle) * 60;
    const sunY = Math.sin(sunAngle) * 60;
    const sunZ = Math.sin(sunAngle * 0.5) * 30 + 15;
    
    const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
    GraphicsState.uniforms.uSunDirection.value.copy(sunDir);
    GraphicsState.uniforms.uTime.value = state.clock.elapsedTime;

    // Night factor (0 = day, 1 = night)
    const nightFactor = THREE.MathUtils.smoothstep(-sunDir.y, -0.2, 0.3);
    GraphicsState.uniforms.uNightFactor.value = nightFactor;

    // Update global state for other shaders
    GraphicsState.uniforms.uWaterTime.value += delta;

    // Fog and light colors based on time of day
    const sunsetBlend = Math.max(0, 1 - Math.abs(sunDir.y) / 0.35);
    const fogColorDay = new THREE.Color('#cbd5e1');
    const fogColorNight = new THREE.Color('#0f172a');
    const fogColorSunset = new THREE.Color('#f97316');
    
    let currentFogColor = fogColorDay.clone().lerp(fogColorNight, nightFactor);
    if (sunsetBlend > 0 && sunDir.y > -0.1) {
      currentFogColor.lerp(fogColorSunset, sunsetBlend * 0.55);
    }
    GraphicsState.uniforms.uFogColor.value.copy(currentFogColor);

    // Dynamic Ambient Fill Color
    const ambDay = new THREE.Color(0.72, 0.80, 0.88);
    const ambSunset = new THREE.Color(0.88, 0.62, 0.45);
    const ambNight = new THREE.Color(0.15, 0.22, 0.38);
    let currentAmbientColor = ambDay.clone().lerp(ambNight, nightFactor);
    if (sunsetBlend > 0 && sunDir.y > -0.1) {
      currentAmbientColor.lerp(ambSunset, sunsetBlend * 0.60);
    }
    GraphicsState.uniforms.uAmbientColor.value.copy(currentAmbientColor);

    if (state.scene.fog && state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.copy(currentFogColor);
    }

    if (sunRef.current) {
      sunRef.current.position.set(camX + sunX, Math.max(12, sunY + 25), camZ + sunZ);
      sunRef.current.target.position.set(camX, 0, camZ);
      sunRef.current.target.updateMatrixWorld();
      
      if (sunY > -5) {
        // Sun Light
        const sunIntensity = Math.max(0, (sunY + 5) / 55) * 2.15;
        sunRef.current.intensity = sunIntensity;
        
        const sunCol = new THREE.Color(1.0, 0.98, 0.92);
        if (sunsetBlend > 0) {
          sunCol.lerp(new THREE.Color(1.0, 0.55, 0.22), sunsetBlend);
        }
        sunRef.current.color.copy(sunCol);
        GraphicsState.uniforms.uSunColor.value.copy(sunCol);
      } else {
        // Moon Light
        sunRef.current.intensity = 0.35;
        sunRef.current.color.setHex(0x60a5fa);
        GraphicsState.uniforms.uSunColor.value.setHex(0x60a5fa);
      }
    }

    // Exposure changes
    const targetExposure = nightFactor > 0.5 ? 0.6 : 1.15;
    GraphicsState.uniforms.uExposure.value = THREE.MathUtils.lerp(
      GraphicsState.uniforms.uExposure.value,
      targetExposure,
      delta * 0.5
    );
    gl.toneMappingExposure = GraphicsState.uniforms.uExposure.value;
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

      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />

      <ambientLight intensity={0.4} color="#f8fafc" />
      <hemisphereLight args={['#bae6fd', '#334155', 0.6]} />

      <fog attach="fog" args={[GraphicsState.uniforms.uFogColor.value.getStyle(), 40, 250]} />
    </>
  );
}
