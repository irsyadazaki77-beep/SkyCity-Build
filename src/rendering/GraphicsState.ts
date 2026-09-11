import * as THREE from 'three';

/**
 * Shared Rendering State for performance-critical shader uniforms.
 * Provides a clean, modern daylight baseline with consistent lighting,
 * neutral fog, and stable exposure across all scene materials.
 */
export const GraphicsState = {
  uniforms: {
    uTime: { value: 0 },
    uNightFactor: { value: 0.0 },
    uSunDirection: { value: new THREE.Vector3(45, 75, 35).normalize() },
    uSunColor: { value: new THREE.Color(1.0, 0.985, 0.96) },
    uAmbientColor: { value: new THREE.Color(0.92, 0.94, 0.97) },
    uFogColor: { value: new THREE.Color(0.88, 0.91, 0.94) },
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

