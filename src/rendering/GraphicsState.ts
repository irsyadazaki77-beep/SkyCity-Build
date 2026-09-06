import * as THREE from 'three';

/**
 * Shared Rendering State for performance-critical shader uniforms.
 * This avoids React setState() overhead for variables that change every frame
 * like sun position, time of day, and night factor.
 */
export const GraphicsState = {
  uniforms: {
    uTime: { value: 0 },
    uNightFactor: { value: 0 },
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uAmbientColor: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color(0, 0, 0) },
    uExposure: { value: 1.0 },
    uWaterTime: { value: 0 },
  },
  
  // Quality settings used in shaders
  quality: {
    tier: 'high',
    shadows: true,
    postProcessing: true,
  }
};
