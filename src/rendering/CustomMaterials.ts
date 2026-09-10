import * as THREE from 'three';
import { GraphicsState } from './GraphicsState';

/**
 * Advanced Terrain Shader with Layered Blending, Triplanar Mapping & Micro Details
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
        mat3 m = mat3(modelMatrix);
        vNormal = normalize(m * normal);
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

      // Noise functions
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

        // 1. Natural Biome Palette
        vec3 grassLush = vec3(0.24, 0.46, 0.20);
        vec3 grassDry  = vec3(0.44, 0.52, 0.26);
        vec3 dirt      = vec3(0.36, 0.28, 0.18);
        vec3 dryPatch  = vec3(0.50, 0.42, 0.28);
        vec3 rockCliff = vec3(0.28, 0.30, 0.32);
        vec3 rockDeep  = vec3(0.19, 0.20, 0.23);
        vec3 sand      = vec3(0.84, 0.72, 0.50);
        vec3 wetSand   = vec3(0.39, 0.31, 0.23);
        vec3 snow      = vec3(0.92, 0.95, 0.99);

        // Triplanar noise sampling
        vec2 pXZ = vWorldPosition.xz * 2.5;
        vec2 pMacro = vWorldPosition.xz * 0.04;
        vec2 pDetail = vWorldPosition.xz * 12.0;

        float nDetail = noise(pXZ);
        float nMacro = noise(pMacro);
        float nMicro = noise(pDetail);

        // Grass & Soil Variation
        vec3 grass = mix(grassLush, grassDry, nMacro * 0.7);
        grass = mix(grass, dryPatch, step(0.68, nDetail) * 0.35);
        grass *= (0.85 + 0.3 * nDetail);
        dirt *= (0.82 + 0.36 * nMicro);
        sand *= (0.9 + 0.2 * nDetail);

        // Cliff rock with crevices
        float creviceNoise = noise(vWorldPosition.xz * 14.0) * 0.45;
        vec3 rock = mix(rockCliff, rockDeep, clamp(pow(slope, 1.5) + creviceNoise, 0.0, 0.88));

        vec3 diffuseColor = grass;

        // Shoreline Blending
        float sandFactor = 1.0 - smoothstep(0.06, 0.38, elevation);
        diffuseColor = mix(diffuseColor, sand, sandFactor);

        float wetFactor = 1.0 - smoothstep(0.02, 0.28, waterWeight);
        diffuseColor = mix(diffuseColor, wetSand, wetFactor * 0.82);

        // Slopes & Steep Cliffs
        float dirtFactor = smoothstep(0.28, 0.48, slope);
        diffuseColor = mix(diffuseColor, dirt, dirtFactor);

        float rockFactor = smoothstep(0.46, 0.72, slope);
        diffuseColor = mix(diffuseColor, rock, rockFactor);

        // High Altitude Snow
        float snowFactor = smoothstep(3.2, 4.2, elevation);
        diffuseColor = mix(diffuseColor, snow, snowFactor * (1.0 - slope * 0.7));

        // Underwater Riverbed
        if (waterWeight > 0.05) {
          float depthFactor = smoothstep(0.05, 0.8, waterWeight);
          vec3 riverbedColor = mix(diffuseColor * 0.5, vec3(0.04, 0.16, 0.25), depthFactor);
          diffuseColor = mix(diffuseColor, riverbedColor, depthFactor);
        }

        // Lighting
        vec3 normal = normalize(vNormal);
        float NdotL = clamp(dot(normal, uSunDirection), 0.18, 1.0);
        vec3 ambient = vec3(0.28) * (1.0 - uNightFactor * 0.82);
        vec3 lighting = ambient + vec3(1.15) * NdotL * (1.0 - uNightFactor * 0.85);
        lighting += vec3(0.04, 0.08, 0.22) * uNightFactor;

        vec4 finalColor = vec4(diffuseColor * lighting, 1.0);

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
 * Custom Water Shader with Current Flow, Shoreline Foam & Sun Specular
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
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
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

      // Current flow wave noise
      float waveNoise(vec2 p) {
        vec2 flowDir = vec2(0.6, 0.8);
        float t = uTime * 1.1;
        vec2 pos = p + flowDir * t * 0.3;
        float w1 = sin(dot(pos, vec2(0.8, 0.6)) * 3.0);
        float w2 = cos(dot(pos, vec2(-0.7, 0.71)) * 5.2 - t * 0.8);
        float w3 = sin(dot(p, vec2(0.3, -0.95)) * 8.5 + t * 1.4);
        return (w1 * 0.5 + w2 * 0.35 + w3 * 0.15);
      }

      void main() {
        if (vWaterWeight < 0.015) {
          discard;
        }

        vec2 pos = vWorldPosition.xz * 1.2;
        
        // Compute wave normal
        float eps = 0.08;
        float hC = waveNoise(pos);
        float hR = waveNoise(pos + vec2(eps, 0.0));
        float hU = waveNoise(pos + vec2(0.0, eps));
        
        vec3 normal = normalize(vec3((hC - hR) * 0.35, 1.0, (hC - hU) * 0.35));

        // Smooth depth gradient
        vec3 shallowColor = vec3(0.08, 0.65, 0.76);
        vec3 deepColor    = vec3(0.01, 0.16, 0.36);
        float depthFactor = clamp(vWaterDepth / 0.35, 0.0, 1.0);
        vec3 waterColor   = mix(shallowColor, deepColor, depthFactor);

        // Fresnel reflection
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.0);
        fresnel = clamp(fresnel, 0.12, 0.78);

        // Shoreline Foam
        float foamNoise = waveNoise(pos * 3.5 + vec2(uTime * 0.5));
        float foam = smoothstep(0.01, 0.18, vWaterWeight) * (1.0 - smoothstep(0.01, 0.12, vWaterDepth));
        foam *= (0.35 + 0.65 * foamNoise);
        waterColor = mix(waterColor, vec3(0.94, 0.98, 1.0), foam * 0.52);

        // Night time darkening
        waterColor = mix(waterColor, vec3(0.008, 0.035, 0.09), uNightFactor);

        // Sun Specular Highlight
        vec3 reflectDir = reflect(-uSunDirection, normal);
        float spec = pow(max(0.0, dot(viewDir, reflectDir)), 64.0);
        vec3 specColor = uSunColor * spec * 0.70 * (1.0 - uNightFactor * 0.85);

        vec3 finalColor = mix(waterColor, vec3(0.72, 0.86, 1.0), fresnel * 0.28) + specColor;

        if (uNightFactor > 0.4) {
          finalColor += vec3(0.15, 0.3, 0.6) * spec * 0.25;
        }

        float alpha = clamp((vWaterWeight - 0.012) / 0.08, 0.0, 1.0) * 0.90;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
};

/**
 * Tree & Vegetation Shader Material with Subtle Wind Sway
 */
export const TreeMaterial = (color: string, roughness: number = 0.8) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uTime: GraphicsState.uniforms.uWaterTime,
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        mat3 m = mat3(modelMatrix * instanceMatrix);
        vNormal = normalize(m * normal);
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        
        // Gentle wind sway on top foliage
        if (position.y > 0.2) {
          float wind = sin(uTime * 1.8 + instancePos.x * 2.5 + instancePos.z * 1.8) * position.y * 0.04;
          instancePos.x += wind;
          instancePos.z += wind * 0.6;
        }

        vec4 worldPos = modelMatrix * instancePos;
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uNightFactor;
      uniform vec3 uSunDirection;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        float dotL = max(0.22, dot(normal, uSunDirection));
        vec3 diffuse = uColor * dotL * (1.0 - uNightFactor * 0.8);
        diffuse += vec3(0.01, 0.03, 0.12) * uNightFactor;
        gl_FragColor = vec4(diffuse, 1.0);
      }
    `,
  });
};

/**
 * Advanced Building Shader Material with Facade-Aware Windows, Night Room Lighting & Status Flags
 */
export const BuildingShaderMaterial = (
  baseColorHex: string,
  accentColorHex: string = '#334155',
  patternType: number = 0 // 0 = Residential, 1 = Commercial, 2 = Industrial/Service
) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColorHex) },
      uAccentColor: { value: new THREE.Color(accentColorHex) },
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uPatternType: { value: patternType },
    },
    vertexShader: `
      attribute vec2 aStatus; // [powered (0/1), abandoned (0/1)]
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying vec2 vStatus;

      void main() {
        mat3 m = mat3(modelMatrix * instanceMatrix);
        vNormal = normalize(m * normal);
        vLocalPosition = position;
        vStatus = aStatus;
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uAccentColor;
      uniform float uNightFactor;
      uniform vec3 uSunDirection;
      uniform float uPatternType;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying vec2 vStatus;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        vec3 normal = normalize(vNormal);
        float isRoof = step(0.85, abs(normal.y));

        float dotL = max(0.22, dot(normal, uSunDirection));

        // Facade detail logic
        vec3 p = vWorldPosition;
        float windowMask = 0.0;
        vec3 windowGlowColor = vec3(1.0, 0.88, 0.55);

        if (isRoof < 0.5) {
          if (uPatternType < 0.5) {
            // Residential Punched Windows Pattern
            vec2 gridP = vec2(p.x + p.z, p.y) * 3.0;
            float wx = step(0.35, fract(gridP.x)) * step(fract(gridP.x), 0.82);
            float wy = step(0.30, fract(gridP.y)) * step(fract(gridP.y), 0.78);
            windowMask = wx * wy;
          } else if (uPatternType < 1.5) {
            // Commercial Ribbon Glass / High-rise Curtain Grid
            vec2 gridP = vec2(p.x + p.z, p.y) * 4.0;
            float wx = step(0.15, fract(gridP.x));
            float wy = step(0.22, fract(gridP.y));
            windowMask = wx * wy;
            windowGlowColor = vec3(0.65, 0.88, 1.0);
          } else {
            // Industrial Slit / High Windows / Panel Trims
            vec2 gridP = vec2(p.x + p.z, p.y) * 2.0;
            float wx = step(0.4, fract(gridP.x)) * step(fract(gridP.x), 0.9);
            float wy = step(0.6, fract(gridP.y));
            windowMask = wx * wy * 0.6;
            windowGlowColor = vec3(0.95, 0.85, 0.6);
          }
        }

        // Room lighting randomness at night
        vec2 roomSeed = floor(vWorldPosition.xz * 2.0 + vec2(floor(p.y * 3.0)));
        float roomRand = hash(roomSeed);
        float litThreshold = uPatternType > 0.5 ? 0.35 : 0.50;
        windowMask *= step(litThreshold, roomRand);

        // Power & Abandoned status check
        float powered = vStatus.x;
        float abandoned = vStatus.y;

        // If unpowered or abandoned, no lights
        float lightFactor = powered * (1.0 - abandoned * 0.95);
        vec3 emissive = windowGlowColor * windowMask * uNightFactor * 1.6 * lightFactor;

        // Base & Roof Color
        vec3 baseCol = mix(uBaseColor, uAccentColor, isRoof * 0.45);
        if (vLocalPosition.y < -0.01) {
          baseCol = vec3(0.22, 0.23, 0.25); // Dark concrete grey foundation
          windowMask = 0.0; // Disable window glow on foundation
        }
        if (abandoned > 0.5) {
          baseCol *= 0.6; // Darker weathered look
        }

        vec3 diffuse = baseCol * dotL * (1.0 - uNightFactor * 0.78);
        diffuse += vec3(0.02, 0.05, 0.16) * uNightFactor;

        gl_FragColor = vec4(diffuse + emissive, 1.0);
      }
    `,
  });
};


