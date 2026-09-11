import * as THREE from 'three';
import { GraphicsState } from './GraphicsState';

/**
 * Advanced Terrain Shader with Multi-Layered Biome Blending, Triplanar Geological Strata & Micro Details
 */
export const TerrainMaterial = () => {
  const shader = {
    uniforms: {
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uSunColor: GraphicsState.uniforms.uSunColor,
      uAmbientColor: GraphicsState.uniforms.uAmbientColor,
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
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      uniform float uShowWaterMask;
      uniform float uShowShoreline;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying vec4 vTerrainData;

      // Fast procedural hash & smooth value noise
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        float elevation = vTerrainData.x;
        float slope = vTerrainData.y;
        float waterWeight = vTerrainData.z;
        float resourceType = vTerrainData.w; // 1.0 = forest, 2.0 = ore

        // 1. Natural, Cohesive Biome Color Palette (Soft stylized-realistic)
        vec3 grassLush   = vec3(0.32, 0.56, 0.24); // Vibrant lowland meadow green
        vec3 grassForest = vec3(0.20, 0.40, 0.20); // Deep organic forest floor
        vec3 grassDry    = vec3(0.46, 0.52, 0.28); // Golden highland pasture
        vec3 dirtSoil    = vec3(0.44, 0.36, 0.26); // Warm loamy topsoil
        vec3 rockGranite = vec3(0.48, 0.50, 0.54); // Weathered mountain granite
        vec3 rockDeep    = vec3(0.34, 0.36, 0.40); // Basalt rock strata
        vec3 sandDry     = vec3(0.86, 0.80, 0.64); // Warm fine coastal sand
        vec3 sandWet     = vec3(0.55, 0.48, 0.38); // Moist shoreline sediment
        vec3 snowCap     = vec3(0.96, 0.97, 0.99); // Alpine snow
        vec3 oreTint     = vec3(0.54, 0.44, 0.32); // Mineral vein tone
        vec3 riverbedSilt= vec3(0.26, 0.32, 0.32); // Submerged riverbed silt & pebbles

        // Multi-frequency procedural coordinates for organic surface detail
        vec2 pMacro  = vWorldPosition.xz * 0.035;
        vec2 pDetail = vWorldPosition.xz * 1.5;
        vec2 pMicro  = vWorldPosition.xz * 12.0;

        float nMacro  = noise(pMacro);
        float nDetail = noise(pDetail);
        float nMicro  = noise(pMicro);

        // Grass biome variation with organic meadow/steppe patches
        vec3 grass = mix(grassLush, grassDry, nMacro * 0.60);
        if (resourceType > 0.5 && resourceType < 1.5) {
          grass = mix(grass, grassForest, 0.75);
        }
        grass *= (0.94 + 0.12 * nDetail);

        // Soil and Sand micro-relief
        vec3 soil = dirtSoil * (0.92 + 0.15 * nMicro);
        vec3 sand = sandDry * (0.96 + 0.08 * nDetail);

        // Cliff Strata Lines (Geological Layering on vertical terrain)
        float strata = sin(vWorldPosition.y * 10.0 + nMacro * 3.5) * 0.5 + 0.5;
        vec3 rock = mix(rockGranite, rockDeep, strata * 0.40 + nMicro * 0.20);

        vec3 diffuseColor = grass;

        // Shoreline & Beach Transition
        float sandNoiseOffset = (nMacro - 0.5) * 0.08;
        float sandBlend = 1.0 - smoothstep(0.04, 0.32 + sandNoiseOffset, elevation);
        diffuseColor = mix(diffuseColor, sand, clamp(sandBlend, 0.0, 1.0));

        // Wet sand directly along the tidal/water contact border
        float wetBlend = 1.0 - smoothstep(0.01, 0.22, waterWeight);
        diffuseColor = mix(diffuseColor, sandWet, wetBlend * 0.88);

        // Smooth Slope Transition: Grass -> Loamy Soil -> Exposed Cliff Rock
        float dirtBlend = smoothstep(0.22, 0.46, slope);
        diffuseColor = mix(diffuseColor, soil, dirtBlend);

        float rockBlend = smoothstep(0.44, 0.70, slope);
        diffuseColor = mix(diffuseColor, rock, rockBlend);

        // Mineral veining for ore resource tiles
        if (resourceType > 1.5) {
          float oreVein = smoothstep(0.45, 0.75, nMicro);
          diffuseColor = mix(diffuseColor, oreTint, oreVein * 0.55);
        }

        // High Altitude Alpine Snow Peak
        float snowBlend = smoothstep(2.9, 3.9, elevation);
        float snowCliffFalloff = clamp(1.0 - slope * 1.1, 0.0, 1.0);
        diffuseColor = mix(diffuseColor, snowCap, snowBlend * snowCliffFalloff);

        // Submerged Riverbed Bedding
        if (waterWeight > 0.02) {
          float depthFactor = smoothstep(0.02, 0.70, waterWeight);
          diffuseColor = mix(diffuseColor, riverbedSilt, depthFactor * 0.85);
        }

        // Unified Diffuse Daylight Baseline
        vec3 normal = normalize(vNormal);
        float NdotL = max(0.0, dot(normal, uSunDirection));
        float hemi = normal.y * 0.5 + 0.5;
        vec3 ambientFill = mix(uAmbientColor * 0.60, uAmbientColor, hemi);
        vec3 lighting = uSunColor * (NdotL * 0.72) + ambientFill * 0.48;

        vec4 finalColor = vec4(diffuseColor * lighting, 1.0);

        // Debug overlays
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
 * Custom Water Shader with Smooth Shoreline Alpha, Flowing Waves, Refractive Depth & Sun Glimmer
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
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      varying float vWaterWeight;
      varying float vWaterDepth;
      varying vec3 vWorldPosition;

      // Realistic dual-harmonic traveling wave field
      float waveNoise(vec2 p) {
        vec2 flowDir = vec2(0.55, 0.83);
        float t = uTime * 0.85;
        vec2 pos1 = p + flowDir * t * 0.22;
        vec2 pos2 = p * 1.5 - flowDir * t * 0.16;
        
        float w1 = sin(dot(pos1, vec2(0.65, 0.75)) * 2.6);
        float w2 = cos(dot(pos2, vec2(-0.55, 0.83)) * 4.2 - t * 0.5);
        float w3 = sin(dot(p, vec2(0.35, -0.93)) * 6.8 + t * 0.9);
        return (w1 * 0.50 + w2 * 0.32 + w3 * 0.18);
      }

      void main() {
        if (vWaterWeight < 0.008) {
          discard;
        }

        vec2 pos = vWorldPosition.xz * 1.05;
        
        // Dynamic wave surface normal perturbation
        float eps = 0.08;
        float hC = waveNoise(pos);
        float hR = waveNoise(pos + vec2(eps, 0.0));
        float hU = waveNoise(pos + vec2(0.0, eps));
        
        vec3 normal = normalize(vec3((hC - hR) * 0.22, 1.0, (hC - hU) * 0.22));

        // Depth-Based Extinction Gradient (Natural lake azure -> deep marine navy)
        vec3 shallowAqua = vec3(0.18, 0.50, 0.62);
        vec3 deepMarine  = vec3(0.08, 0.28, 0.44);
        float depthFactor = 1.0 - exp(-vWaterDepth * 4.8);
        vec3 waterColor  = mix(shallowAqua, deepMarine, clamp(depthFactor, 0.0, 1.0));

        // Softened Fresnel reflection factor (calibrated, non-glowing)
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float NdotV = max(0.0, dot(viewDir, normal));
        float fresnel = 0.04 + 0.35 * pow(1.0 - NdotV, 3.0);

        // Thin, delicate shoreline foam lace (subtle and non-intrusive)
        float shoreMask = smoothstep(0.008, 0.09, vWaterWeight) * (1.0 - smoothstep(0.004, 0.038, vWaterDepth));
        float foamNoise = waveNoise(pos * 3.4 + vec2(uTime * 0.35));
        float foam = shoreMask * smoothstep(0.25, 0.75, foamNoise * 0.50 + 0.50);
        waterColor = mix(waterColor, vec3(0.92, 0.95, 0.98), foam * 0.25);

        // Soft sun specular glint (natural, non-blinding)
        vec3 reflectDir = reflect(-uSunDirection, normal);
        float spec = pow(max(0.0, dot(viewDir, reflectDir)), 48.0);
        vec3 specColor = uSunColor * spec * 0.22;

        // Neutral sky reflection
        vec3 skyReflection = vec3(0.78, 0.86, 0.94);
        vec3 finalColor = mix(waterColor, skyReflection, fresnel * 0.22) + specColor;

        // Soft Edge Alpha Blending along shorelines
        float shoreAlpha = smoothstep(0.002, 0.08, vWaterDepth);
        float alpha = clamp(shoreAlpha * 0.55 + 0.25, 0.25, 0.80);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
};

/**
 * Tree & Vegetation Shader Material with Tiered Organic Canopy & Wind Sway
 */
export const TreeMaterial = (color: string, roughness: number = 0.8) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uSunColor: GraphicsState.uniforms.uSunColor,
      uAmbientColor: GraphicsState.uniforms.uAmbientColor,
      uTime: GraphicsState.uniforms.uWaterTime,
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vHeight;

      void main() {
        mat3 m = mat3(modelMatrix * instanceMatrix);
        vNormal = normalize(m * normal);
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        
        // Natural multi-frequency wind sway on upper foliage
        if (position.y > 0.15) {
          float windSpeed = uTime * 2.0;
          float swayX = sin(windSpeed + instancePos.x * 2.0 + instancePos.z * 1.5) * position.y * 0.035;
          float swayZ = cos(windSpeed * 0.85 + instancePos.z * 1.8) * position.y * 0.025;
          instancePos.x += swayX;
          instancePos.z += swayZ;
        }

        vHeight = position.y;
        vec4 worldPos = modelMatrix * instancePos;
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vHeight;

      void main() {
        vec3 normal = normalize(vNormal);
        float NdotL = max(0.0, dot(normal, uSunDirection));
        float hemi = normal.y * 0.5 + 0.5;
        vec3 ambientFill = mix(uAmbientColor * 0.60, uAmbientColor, hemi);
        vec3 daylight = uSunColor * (NdotL * 0.72) + ambientFill * 0.48;
        
        // Gradient from base trunk/canopy bottom to sunlit top
        vec3 canopyColor = uColor * (0.88 + 0.22 * clamp(vHeight * 0.85, 0.0, 1.0));
        
        vec3 diffuse = canopyColor * daylight;
        gl_FragColor = vec4(diffuse, 1.0);
      }
    `,
  });
};

/**
 * Advanced Road Asphalt Shader with Natural Dark Slate Tone & Fine Aggregate Texture
 */
export const RoadAsphaltShaderMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uSunColor: GraphicsState.uniforms.uSunColor,
      uAmbientColor: GraphicsState.uniforms.uAmbientColor,
      uNightFactor: GraphicsState.uniforms.uNightFactor,
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        mat3 m = mat3(modelMatrix);
        vNormal = normalize(m * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        // Natural fine asphalt aggregate texture
        float fineGrain = hash(vWorldPosition.xz * 48.0) * 0.015;
        
        // Cohesive dark slate asphalt base
        vec3 asphaltColor = vec3(0.21, 0.22, 0.24) + fineGrain;
        
        vec3 normal = normalize(vNormal);
        float NdotL = max(0.0, dot(normal, uSunDirection));
        float hemi = normal.y * 0.5 + 0.5;
        vec3 ambientFill = mix(uAmbientColor * 0.60, uAmbientColor, hemi);
        vec3 daylight = uSunColor * (NdotL * 0.72) + ambientFill * 0.48;

        vec3 diffuse = asphaltColor * daylight;

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `
  });
};

/**
 * Road Marking Paint Shader Material - Soft matte thermoplastic road paint
 */
export const RoadMarkingShaderMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uSunColor: GraphicsState.uniforms.uSunColor,
      uAmbientColor: GraphicsState.uniforms.uAmbientColor,
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        mat3 m = mat3(modelMatrix);
        vNormal = normalize(m * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        // Soft matte cream/white road paint
        vec3 markingColor = vec3(0.94, 0.94, 0.90);
        
        vec3 normal = normalize(vNormal);
        float NdotL = max(0.0, dot(normal, uSunDirection));
        float hemi = normal.y * 0.5 + 0.5;
        vec3 ambientFill = mix(uAmbientColor * 0.60, uAmbientColor, hemi);
        vec3 daylight = uSunColor * (NdotL * 0.72) + ambientFill * 0.48;

        vec3 diffuse = markingColor * daylight;

        gl_FragColor = vec4(diffuse, 0.92);
      }
    `,
    transparent: true,
  });
};

/**
 * Modern Bridge Structure Shader Material
 */
export const BridgeShaderMaterial = (isHighlight = false) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uSunColor: GraphicsState.uniforms.uSunColor,
      uAmbientColor: GraphicsState.uniforms.uAmbientColor,
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uHighlight: { value: isHighlight ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      void main() {
        mat3 m = mat3(modelMatrix);
        vNormal = normalize(m * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      uniform float uHighlight;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        float NdotL = max(0.0, dot(normal, uSunDirection));
        float hemi = normal.y * 0.5 + 0.5;
        vec3 ambientFill = mix(uAmbientColor * 0.60, uAmbientColor, hemi);
        vec3 daylight = uSunColor * (NdotL * 0.72) + ambientFill * 0.48;

        // Modern architectural prestressed concrete & steel tone
        vec3 concreteColor = vec3(0.52, 0.55, 0.58);
        if (uHighlight > 0.5) {
          concreteColor = vec3(0.95, 0.45, 0.10);
        }

        vec3 diffuse = concreteColor * daylight;

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `
  });
};

/**
 * Modern High-Performance Vehicle Shader Material
 * Renders body with instance color, preserves tinted glass and black tires
 */
export const VehicleShaderMaterial = () => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: GraphicsState.uniforms.uSunDirection,
      uSunColor: GraphicsState.uniforms.uSunColor,
      uAmbientColor: GraphicsState.uniforms.uAmbientColor,
      uNightFactor: GraphicsState.uniforms.uNightFactor,
      uTime: GraphicsState.uniforms.uWaterTime,
    },
    vertexShader: `
      attribute float aBodyMask;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vColor;
      varying float vBodyMask;

      void main() {
        mat3 m = mat3(modelMatrix * instanceMatrix);
        vNormal = normalize(m * normal);

        vColor = color;
        vBodyMask = aBodyMask;

        vec4 worldPos = modelMatrix * (instanceMatrix * vec4(position, 1.0));
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vColor;
      varying float vBodyMask;

      void main() {
        vec3 normal = normalize(vNormal);
        float NdotL = max(0.0, dot(normal, uSunDirection));
        float hemi = normal.y * 0.5 + 0.5;
        vec3 ambientFill = mix(uAmbientColor * 0.60, uAmbientColor, hemi);
        vec3 daylight = uSunColor * (NdotL * 0.72) + ambientFill * 0.48;

        vec3 baseColor = vColor;
        vec3 diffuse = baseColor * daylight;

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `,
    vertexColors: true,
  });
};

/**
 * Advanced Building Shader Material with Facade Framing, Glass Mullions & Status Flags
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
      uSunColor: GraphicsState.uniforms.uSunColor,
      uAmbientColor: GraphicsState.uniforms.uAmbientColor,
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
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      uniform float uPatternType;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying vec2 vStatus;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        vec3 normal = normalize(vNormal);
        float isRoof = step(0.82, abs(normal.y));

        float NdotL = max(0.0, dot(normal, uSunDirection));
        float hemi = normal.y * 0.5 + 0.5;
        vec3 ambientFill = mix(uAmbientColor * 0.60, uAmbientColor, hemi);
        vec3 daylight = uSunColor * (NdotL * 0.72) + ambientFill * 0.48;

        // Facade detail logic
        vec3 p = vWorldPosition;
        float windowMask = 0.0;

        if (isRoof < 0.5) {
          if (uPatternType < 0.5) {
            // Residential Punched Window Grid
            vec2 gridP = vec2(p.x + p.z, p.y) * 2.8;
            float wx = step(0.32, fract(gridP.x)) * step(fract(gridP.x), 0.80);
            float wy = step(0.28, fract(gridP.y)) * step(fract(gridP.y), 0.78);
            windowMask = wx * wy;
          } else if (uPatternType < 1.5) {
            // Commercial Architectural Curtain Glass
            vec2 gridP = vec2(p.x + p.z, p.y) * 3.8;
            float wx = step(0.12, fract(gridP.x));
            float wy = step(0.20, fract(gridP.y));
            windowMask = wx * wy;
          } else {
            // Industrial Slit Windows & Panel Grooves
            vec2 gridP = vec2(p.x + p.z, p.y) * 1.8;
            float wx = step(0.35, fract(gridP.x)) * step(fract(gridP.x), 0.88);
            float wy = step(0.55, fract(gridP.y));
            windowMask = wx * wy * 0.65;
          }
        }

        // Glass subtle specular reflection during daytime (non-glowing, non-emissive)
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 reflectDir = reflect(-uSunDirection, normal);
        float specWindow = pow(max(0.0, dot(viewDir, reflectDir)), 32.0) * windowMask;
        vec3 windowGlint = uSunColor * specWindow * 0.15;

        // Base & Roof Color
        vec3 baseCol = mix(uBaseColor, uAccentColor, isRoof * 0.45);
        
        // Ground foundation ambient contact shadow
        float baseAO = smoothstep(-0.02, 0.18, vLocalPosition.y);
        
        if (vLocalPosition.y < -0.01) {
          baseCol = vec3(0.28, 0.30, 0.34); // Concrete foundation
          windowMask = 0.0;
        }

        float abandoned = vStatus.y;
        if (abandoned > 0.5) {
          baseCol *= 0.65; // Weathered abandoned tone
        }

        vec3 diffuse = baseCol * daylight * mix(0.78, 1.0, baseAO);

        gl_FragColor = vec4(diffuse + windowGlint, 1.0);
      }
    `,
  });
};




