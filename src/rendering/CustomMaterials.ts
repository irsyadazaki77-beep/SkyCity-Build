import * as THREE from 'three';
import { GraphicsState } from './GraphicsState';

/**
 * Advanced Terrain Shader with Layered Blending & Triplanar Mapping
 */
export const TerrainMaterial = () => {
  const shader = {
    uniforms: {
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uShowWaterMask: { value: 0.0 },
      uShowShoreline: { value: 0.0 },
    },
    vertexShader: `
      attribute vec4 aTerrainData; // [elevation, slope, waterWeight, resource]
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec4 vTerrainData;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vTerrainData = aTerrainData;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uNightFactor;
      uniform vec3 uSunDirection;
      uniform float uShowWaterMask;
      uniform float uShowShoreline;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec4 vTerrainData;

      // Simple noise for detail
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }

      void main() {
        float elevation = vTerrainData.x;
        float slope = vTerrainData.y;
        float waterWeight = vTerrainData.z;

        // 1. Layer Blending
        vec3 grass = vec3(0.18, 0.38, 0.12);
        vec3 dirt = vec3(0.40, 0.30, 0.18);
        vec3 rock = vec3(0.38, 0.40, 0.42);
        vec3 sand = vec3(0.78, 0.68, 0.48);
        vec3 wetSand = vec3(0.48, 0.38, 0.26);
        vec3 snow = vec3(0.92, 0.95, 1.0);

        vec2 pXZ = vWorldPosition.xz * 2.0;
        vec2 pXY = vWorldPosition.xy * 2.0;
        vec2 pYZ = vWorldPosition.yz * 2.0;
        
        vec3 blendWeights = abs(vNormal);
        blendWeights = blendWeights / max(0.001, blendWeights.x + blendWeights.y + blendWeights.z);
        
        float n = noise(pXZ) * blendWeights.y + noise(pXY) * blendWeights.z + noise(pYZ) * blendWeights.x;

        grass *= (0.75 + 0.5 * n);
        dirt *= (0.8 + 0.4 * n);
        rock *= (0.65 + 0.7 * n);
        sand *= (0.9 + 0.2 * n);
        wetSand *= (0.9 + 0.2 * n);

        vec3 diffuseColor = grass;

        // Blend Sand & Wet Sand (Shoreline)
        float sandFactor = smoothstep(0.35, 0.05, elevation);
        diffuseColor = mix(diffuseColor, sand, sandFactor);
        
        float wetFactor = smoothstep(0.25, 0.02, waterWeight);
        diffuseColor = mix(diffuseColor, wetSand, wetFactor * 0.7);

        // Blend Dirt (Slopes)
        float dirtFactor = smoothstep(0.35, 0.58, slope);
        diffuseColor = mix(diffuseColor, dirt, dirtFactor);

        // Blend Rock (Steep Cliffs)
        float rockFactor = smoothstep(0.60, 0.82, slope);
        diffuseColor = mix(diffuseColor, rock, rockFactor);

        // Blend Snow (High Elevation)
        float snowFactor = smoothstep(3.0, 4.0, elevation);
        diffuseColor = mix(diffuseColor, snow, snowFactor * (1.0 - slope));

        // Underwater riverbed shading
        if (waterWeight > 0.05) {
          float depthFactor = smoothstep(0.05, 0.8, waterWeight);
          vec3 underWater = mix(diffuseColor * 0.6, vec3(0.06, 0.18, 0.28), depthFactor);
          diffuseColor = mix(diffuseColor, underWater, depthFactor);
        }

        // 2. Lighting (Lambertian Directional + Ambient)
        vec3 normal = normalize(vNormal);
        float NdotL = clamp(dot(normal, uSunDirection), 0.2, 1.0);
        
        vec3 ambient = vec3(0.35) * (1.0 - uNightFactor * 0.8);
        vec3 lighting = ambient + vec3(1.1) * NdotL * (1.0 - uNightFactor * 0.85);
        
        // Add subtle night blue tint
        lighting += vec3(0.05, 0.1, 0.25) * uNightFactor;

        vec4 finalColor = vec4(diffuseColor * lighting, 1.0);

        // Debug Overlays
        if (uShowWaterMask > 0.5) {
          finalColor.rgb = mix(vec3(0.1, 0.8, 0.2), vec3(0.0, 0.3, 0.95), waterWeight);
        }
        if (uShowShoreline > 0.5 && waterWeight > 0.05 && waterWeight < 0.4) {
          finalColor.rgb = vec3(1.0, 0.0, 0.8);
        }
        
        gl_FragColor = finalColor;
      }
    `,
  };

  return new THREE.ShaderMaterial(shader);
};

/**
 * Lightweight Custom Water Shader with Region Masking
 */
export const WaterMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: GraphicsState.uniforms.uWaterTime,
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunColor: GraphicsState.uniforms.uSunColor,
    },
    vertexShader: `
      attribute float aWaterWeight;
      attribute float aWaterDepth;
      varying float vWaterWeight;
      varying float vWaterDepth;
      varying vec3 vWorldPosition;
      
      void main() {
        vWaterWeight = aWaterWeight;
        vWaterDepth = aWaterDepth;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vec4 mvPosition = modelViewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uNightFactor;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      varying float vWaterWeight;
      varying float vWaterDepth;
      varying vec3 vWorldPosition;

      float wave(vec2 p, float speed, float freq) {
        return sin(p.x * freq + uTime * speed) * cos(p.y * freq + uTime * speed);
      }

      void main() {
        if (vWaterWeight < 0.015) {
          discard;
        }

        vec2 p = vWorldPosition.xz * 1.5;
        float w1 = wave(p, 1.2, 3.5);
        float w2 = wave(p * 0.5 + vec2(1.2, 3.4), 0.8, 2.0);
        float height = w1 * 0.6 + w2 * 0.4;
        vec3 normal = normalize(vec3(-height * 0.25, 1.0, -height * 0.25));

        vec3 shallowColor = vec3(0.05, 0.55, 0.75);
        vec3 deepColor = vec3(0.02, 0.20, 0.42);
        float depthFactor = clamp(vWaterDepth / 0.35, 0.0, 1.0);
        vec3 waterColor = mix(shallowColor, deepColor, depthFactor);

        float foam = clamp((0.35 - vWaterWeight) / 0.32, 0.0, 1.0) * clamp(vWaterDepth / 0.12, 0.0, 1.0);
        waterColor = mix(waterColor, vec3(0.9, 0.96, 1.0), foam * 0.55);

        waterColor = mix(waterColor, vec3(0.01, 0.05, 0.12), uNightFactor);

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 reflectDir = reflect(-uSunDirection, normal);
        float spec = pow(clamp(dot(viewDir, reflectDir), 0.0, 1.0), 48.0);

        vec3 finalColor = waterColor + (spec * uSunColor * 0.5) * (1.0 - uNightFactor * 0.8);

        if (uNightFactor > 0.5) {
          finalColor += vec3(0.2, 0.4, 0.8) * spec * 0.3;
        }

        float alpha = clamp((vWaterWeight - 0.015) / 0.105, 0.0, 1.0) * 0.82;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
};

