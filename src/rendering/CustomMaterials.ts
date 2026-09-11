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
        vec3 grassLush   = vec3(0.28, 0.48, 0.22); // Vibrant lowland meadow green
        vec3 grassForest = vec3(0.14, 0.34, 0.16); // Deep organic forest floor
        vec3 grassDry    = vec3(0.42, 0.48, 0.24); // Golden highland pasture
        vec3 dirtSoil    = vec3(0.36, 0.26, 0.16); // Warm loamy topsoil
        vec3 rockGranite = vec3(0.36, 0.38, 0.42); // Weathered mountain granite
        vec3 rockDeep    = vec3(0.22, 0.24, 0.28); // Basalt rock strata
        vec3 sandDry     = vec3(0.82, 0.74, 0.54); // Warm fine coastal sand
        vec3 sandWet     = vec3(0.42, 0.34, 0.24); // Moist shoreline sediment
        vec3 snowCap     = vec3(0.94, 0.96, 0.98); // Alpine snow
        vec3 oreTint     = vec3(0.48, 0.38, 0.28); // Mineral vein tone
        vec3 riverbedSilt= vec3(0.18, 0.24, 0.23); // Submerged riverbed silt & pebbles

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
        grass *= (0.90 + 0.20 * nDetail);

        // Soil and Sand micro-relief
        vec3 soil = dirtSoil * (0.88 + 0.24 * nMicro);
        vec3 sand = sandDry * (0.94 + 0.12 * nDetail);

        // Cliff Strata Lines (Geological Layering on vertical terrain)
        float strata = sin(vWorldPosition.y * 10.0 + nMacro * 3.5) * 0.5 + 0.5;
        vec3 rock = mix(rockGranite, rockDeep, strata * 0.40 + nMicro * 0.20);

        vec3 diffuseColor = grass;

        // Shoreline & Beach Transition (Hermite smoothstep for curvy non-boxy shores)
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

        // High Altitude Alpine Snow Peak (rests on gentle slopes, sheds from sheer cliffs)
        float snowBlend = smoothstep(2.9, 3.9, elevation);
        float snowCliffFalloff = clamp(1.0 - slope * 1.1, 0.0, 1.0);
        diffuseColor = mix(diffuseColor, snowCap, snowBlend * snowCliffFalloff);

        // Submerged Riverbed Bedding
        if (waterWeight > 0.02) {
          float depthFactor = smoothstep(0.02, 0.70, waterWeight);
          diffuseColor = mix(diffuseColor, riverbedSilt, depthFactor * 0.85);
        }

        // Realistic Hemispheric Lighting & Cavity Ambient Occlusion
        vec3 normal = normalize(vNormal);
        float NdotL = clamp(dot(normal, uSunDirection), 0.18, 1.0);
        
        // Soft cavity occlusion in valleys and depressions
        float cavityAO = clamp(normal.y * 0.55 + 0.45, 0.35, 1.0);

        // Hemispheric sky/ground fill lighting
        vec3 skyFill = uAmbientColor * cavityAO * (1.0 - uNightFactor * 0.82);
        vec3 sunLight = uSunColor * NdotL * (1.0 - uNightFactor * 0.88);
        vec3 nightFill = vec3(0.04, 0.07, 0.18) * cavityAO * uNightFactor;

        vec3 lighting = skyFill * 0.75 + sunLight + nightFill;
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
      uniform float uNightFactor;
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

        // Depth-Based Extinction Gradient (Coastal Clear Aqua -> Deep Oceanic Navy)
        vec3 shallowAqua = vec3(0.12, 0.54, 0.58);
        vec3 deepMarine  = vec3(0.02, 0.15, 0.32);
        float depthFactor = 1.0 - exp(-vWaterDepth * 5.2);
        vec3 waterColor  = mix(shallowAqua, deepMarine, clamp(depthFactor, 0.0, 1.0));

        // Fresnel reflection factor
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float NdotV = max(0.0, dot(viewDir, normal));
        float fresnel = 0.04 + 0.76 * pow(1.0 - NdotV, 3.5);

        // Thin, Delicate Shoreline Foam Lace
        float shoreMask = smoothstep(0.008, 0.09, vWaterWeight) * (1.0 - smoothstep(0.004, 0.038, vWaterDepth));
        float foamNoise = waveNoise(pos * 3.4 + vec2(uTime * 0.35));
        float foam = shoreMask * smoothstep(0.20, 0.75, foamNoise * 0.55 + 0.45);
        waterColor = mix(waterColor, vec3(0.92, 0.96, 0.98), foam * 0.42);

        // Night time atmospheric absorption
        waterColor = mix(waterColor, vec3(0.008, 0.028, 0.075), uNightFactor);

        // Sun / Moon Specular Glimmer (Subtle, non-blinding)
        vec3 reflectDir = reflect(-uSunDirection, normal);
        float spec = pow(max(0.0, dot(viewDir, reflectDir)), 80.0);
        vec3 specColor = uSunColor * spec * 0.60 * (1.0 - uNightFactor * 0.85);

        // Soft sky reflection
        vec3 skyReflection = mix(vec3(0.65, 0.80, 0.94), vec3(0.06, 0.12, 0.24), uNightFactor);
        vec3 finalColor = mix(waterColor, skyReflection, fresnel * 0.28) + specColor;

        if (uNightFactor > 0.4) {
          finalColor += vec3(0.10, 0.24, 0.48) * spec * 0.25;
        }

        // Soft Edge Alpha Blending along shorelines for smooth sand transparency
        float shoreAlpha = smoothstep(0.002, 0.08, vWaterDepth);
        float alpha = clamp(shoreAlpha * 0.88 + 0.08, 0.0, 0.94);

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
      uniform float uNightFactor;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vHeight;

      void main() {
        vec3 normal = normalize(vNormal);
        float dotL = max(0.18, dot(normal, uSunDirection));
        
        // Gradient from base trunk/canopy bottom to lush sunlit top
        vec3 canopyColor = uColor * (0.80 + 0.35 * clamp(vHeight * 0.85, 0.0, 1.0));
        
        // Hemispheric fill lighting
        vec3 skyFill = uAmbientColor * 0.70;
        vec3 sunLight = uSunColor * dotL * (1.0 - uNightFactor * 0.82);
        vec3 nightFill = vec3(0.02, 0.05, 0.14) * uNightFactor;

        vec3 diffuse = canopyColor * (sunLight + skyFill + nightFill);
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
      uniform float uNightFactor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        // Natural fine asphalt aggregate texture
        float fineGrain = hash(vWorldPosition.xz * 48.0) * 0.025;
        float coarseGrain = hash(vWorldPosition.xz * 6.0) * 0.012;
        
        // Cohesive dark slate asphalt base
        vec3 asphaltColor = vec3(0.18, 0.20, 0.24) + fineGrain + coarseGrain;
        
        vec3 normal = normalize(vNormal);
        float dotL = max(0.22, dot(normal, uSunDirection));
        
        vec3 skyFill = uAmbientColor * 0.65;
        vec3 sunLight = uSunColor * dotL * (1.0 - uNightFactor * 0.80);
        vec3 nightFill = vec3(0.02, 0.035, 0.09) * uNightFactor;

        vec3 diffuse = asphaltColor * (sunLight + skyFill + nightFill);

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
      uniform float uNightFactor;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        // Soft matte cream/white road paint (non-blinding, natural road surface look)
        vec3 markingColor = vec3(0.92, 0.92, 0.88);
        
        vec3 normal = normalize(vNormal);
        float dotL = max(0.25, dot(normal, uSunDirection));
        
        vec3 skyFill = uAmbientColor * 0.70;
        vec3 sunLight = uSunColor * dotL * (1.0 - uNightFactor * 0.82);
        vec3 nightFill = vec3(0.04, 0.06, 0.14) * uNightFactor;

        vec3 diffuse = markingColor * (sunLight + skyFill + nightFill);

        gl_FragColor = vec4(diffuse, 0.90);
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
      uniform float uNightFactor;
      uniform float uHighlight;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        float dotL = max(0.22, dot(normal, uSunDirection));

        // Modern architectural prestressed concrete & steel tone
        vec3 concreteColor = vec3(0.42, 0.46, 0.50);
        if (uHighlight > 0.5) {
          concreteColor = vec3(0.95, 0.45, 0.10);
        }

        vec3 skyFill = uAmbientColor * 0.65;
        vec3 sunLight = uSunColor * dotL * (1.0 - uNightFactor * 0.80);
        vec3 nightFill = vec3(0.03, 0.05, 0.12) * uNightFactor;

        vec3 diffuse = concreteColor * (sunLight + skyFill + nightFill);

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `
  });
};

/**
 * Modern High-Performance Vehicle Shader Material
 * Renders body with instance color, preserves tinted glass and black tires,
 * and activates emissive headlights and taillights during night time.
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
      uniform float uNightFactor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec3 vColor;
      varying float vBodyMask;

      void main() {
        vec3 normal = normalize(vNormal);
        float dotL = max(0.28, dot(normal, uSunDirection));

        vec3 baseColor = vColor;

        // Check if this vertex is an emissive headlight / taillight or emergency beacon
        bool isHeadlight = (vColor.r > 1.5 && vColor.g > 1.4);
        bool isTaillight = (vColor.r > 1.4 && vColor.g < 0.3);
        bool isBeaconRed = (vColor.r > 2.0 && vColor.g < 0.2);
        bool isBeaconBlue = (vColor.b > 2.0 && vColor.r < 0.3);

        vec3 skyFill = uAmbientColor * 0.60;
        vec3 sunLight = uSunColor * dotL * (1.0 - uNightFactor * 0.82);
        vec3 nightFill = vec3(0.03, 0.05, 0.11) * uNightFactor;

        vec3 diffuse = baseColor * (sunLight + skyFill + nightFill);

        // Night time glow for vehicle lighting
        if (isHeadlight) {
          float glow = mix(1.0, 3.5, uNightFactor);
          diffuse = vec3(1.0, 0.96, 0.85) * glow;
        } else if (isTaillight) {
          float glow = mix(1.0, 3.0, uNightFactor);
          diffuse = vec3(1.0, 0.15, 0.15) * glow;
        } else if (isBeaconRed) {
          float flash = sin(uTime * 12.0) > 0.0 ? 3.2 : 0.4;
          diffuse = vec3(1.0, 0.15, 0.15) * flash;
        } else if (isBeaconBlue) {
          float flash = sin(uTime * 12.0 + 3.14) > 0.0 ? 3.2 : 0.4;
          diffuse = vec3(0.2, 0.6, 1.0) * flash;
        }

        gl_FragColor = vec4(diffuse, 1.0);
      }
    `,
    vertexColors: true,
  });
};

/**
 * Advanced Building Shader Material with Facade Framing, Glass Mullions, Night Interior Lighting & Status Flags
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
      uniform float uNightFactor;
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

        float dotL = max(0.20, dot(normal, uSunDirection));

        // Facade detail logic
        vec3 p = vWorldPosition;
        float windowMask = 0.0;
        vec3 windowGlowColor = vec3(1.0, 0.88, 0.58); // Warm residential glow

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
            windowGlowColor = vec3(0.72, 0.90, 1.0); // Cool office luminescence
          } else {
            // Industrial Slit Windows & Panel Grooves
            vec2 gridP = vec2(p.x + p.z, p.y) * 1.8;
            float wx = step(0.35, fract(gridP.x)) * step(fract(gridP.x), 0.88);
            float wy = step(0.55, fract(gridP.y));
            windowMask = wx * wy * 0.65;
            windowGlowColor = vec3(0.96, 0.86, 0.62); // Industrial warm halide
          }
        }

        // Room lighting randomness across building windows
        vec2 roomSeed = floor(vWorldPosition.xz * 2.5 + vec2(floor(p.y * 3.0)));
        float roomRand = hash(roomSeed);
        float litThreshold = uPatternType > 0.5 ? 0.32 : 0.48;
        windowMask *= step(litThreshold, roomRand);

        // Power & Abandoned status check
        float powered = vStatus.x;
        float abandoned = vStatus.y;

        // If unpowered or abandoned, lights are extinguished
        float lightFactor = powered * (1.0 - abandoned * 0.98);
        vec3 emissive = windowGlowColor * windowMask * uNightFactor * 1.85 * lightFactor;

        // Glass specular glint on commercial & residential windows during daytime
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 reflectDir = reflect(-uSunDirection, normal);
        float specWindow = pow(max(0.0, dot(viewDir, reflectDir)), 32.0) * windowMask * (1.0 - uNightFactor);
        vec3 windowGlint = uSunColor * specWindow * 0.45;

        // Base & Roof Color
        vec3 baseCol = mix(uBaseColor, uAccentColor, isRoof * 0.45);
        
        // Ground foundation ambient occlusion contact shadow
        float baseAO = smoothstep(-0.02, 0.18, vLocalPosition.y);
        
        if (vLocalPosition.y < -0.01) {
          baseCol = vec3(0.24, 0.25, 0.28); // Concrete foundation
          windowMask = 0.0;
        }
        if (abandoned > 0.5) {
          baseCol *= 0.55; // Weathered abandoned tone
        }

        vec3 skyFill = uAmbientColor * mix(0.50, 0.80, isRoof);
        vec3 sunLight = uSunColor * dotL * (1.0 - uNightFactor * 0.78);
        vec3 nightFill = vec3(0.03, 0.05, 0.12) * uNightFactor;

        vec3 diffuse = baseCol * (sunLight + skyFill * baseAO + nightFill);

        gl_FragColor = vec4(diffuse + emissive + windowGlint, 1.0);
      }
    `,
  });
};



