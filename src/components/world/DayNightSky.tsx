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

  // Simple hashing for stars
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float up = max(0.0, dir.y);
    
    // 1. Atmosphere Gradient
    vec3 skyBlue = vec3(0.3, 0.6, 0.9);
    vec3 horizonColor = vec3(0.7, 0.8, 1.0);
    vec3 nightSky = vec3(0.02, 0.05, 0.12);
    vec3 sunsetColor = vec3(0.9, 0.4, 0.2);

    // Blend sky based on up direction
    vec3 currentSky = mix(horizonColor, skyBlue, up);
    
    // 2. Sunset/Sunrise
    float sunUp = uSunDirection.y;
    float sunsetFactor = smoothstep(0.3, -0.1, abs(sunUp));
    currentSky = mix(currentSky, sunsetColor, sunsetFactor * 0.8 * up);
    
    // 3. Night Transition
    currentSky = mix(currentSky, nightSky, uNightFactor);

    // 4. Sun Disk
    float sunTheta = dot(dir, uSunDirection);
    float sunDisk = smoothstep(0.998, 0.999, sunTheta);
    float sunGlow = pow(max(0.0, sunTheta), 64.0) * 0.5;
    vec3 sunColor = vec3(1.0, 0.95, 0.8) * (1.0 - sunsetFactor * 0.5);
    currentSky += sunColor * (sunDisk + sunGlow) * (1.0 - uNightFactor);

    // 5. Moon Disk (Opposite to sun)
    vec3 moonDir = -uSunDirection;
    float moonTheta = dot(dir, moonDir);
    float moonDisk = smoothstep(0.997, 0.998, moonTheta);
    float moonGlow = pow(max(0.0, moonTheta), 32.0) * 0.2;
    currentSky += vec3(0.8, 0.9, 1.0) * (moonDisk + moonGlow) * uNightFactor;

    // 6. Stars
    if (uNightFactor > 0.4) {
      float starNoise = hash(floor(dir * 250.0));
      if (starNoise > 0.995) {
        float blink = 0.5 + 0.5 * sin(uTime * 2.0 + starNoise * 100.0);
        currentSky += vec3(1.0) * blink * (uNightFactor - 0.4) * 2.0;
      }
    }

    // 7. Horizon Haze
    float haze = exp(-up * 4.0);
    currentSky = mix(currentSky, mix(vec3(0.8, 0.9, 1.0), vec3(0.05, 0.1, 0.2), uNightFactor), haze * 0.5);

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
    const sunsetBlend = Math.max(0, 1 - Math.abs(sunDir.y) / 0.3);
    const fogColorDay = new THREE.Color('#94a3b8');
    const fogColorNight = new THREE.Color('#0f172a');
    const fogColorSunset = new THREE.Color('#ea580c');
    
    let currentFogColor = fogColorDay.clone().lerp(fogColorNight, nightFactor);
    if (sunsetBlend > 0 && sunDir.y > -0.1) {
      currentFogColor.lerp(fogColorSunset, sunsetBlend * 0.5);
    }
    GraphicsState.uniforms.uFogColor.value.copy(currentFogColor);

    if (state.scene.fog && state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.copy(currentFogColor);
    }

    if (sunRef.current) {
      sunRef.current.position.set(camX + sunX, Math.max(10, sunY + 20), camZ + sunZ);
      sunRef.current.target.position.set(camX, 0, camZ);
      sunRef.current.target.updateMatrixWorld();
      
      if (sunY > -5) {
        // Sun Light
        const sunIntensity = Math.max(0, (sunY + 5) / 55) * 1.8;
        sunRef.current.intensity = sunIntensity;
        
        const sunCol = new THREE.Color(1.0, 0.95, 0.85);
        if (sunsetBlend > 0) {
          sunCol.lerp(new THREE.Color(1.0, 0.5, 0.2), sunsetBlend);
        }
        sunRef.current.color.copy(sunCol);
        GraphicsState.uniforms.uSunColor.value.copy(sunCol);
      } else {
        // Moon Light
        sunRef.current.intensity = 0.25;
        sunRef.current.color.setHex(0x3b82f6);
        GraphicsState.uniforms.uSunColor.value.setHex(0x3b82f6);
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
