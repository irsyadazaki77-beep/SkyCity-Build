# SkyCity Graphics Pipeline & Architecture

## Overview
The graphics engine in SkyCity is designed to provide a stylized-realistic aesthetic, reminiscent of modern city simulators, while strictly adhering to a 60 FPS performance constraint. The architecture leans heavily on procedural shaders, GPU instancing, dirty-chunk invalidation, and lightweight post-processing to achieve this balance.

## 1. Environment & Atmosphere
- **Procedural Sky Dome**: A custom shader calculates Rayleigh-like scattering based on the sun's position.
- **Dynamic Day/Night Cycle**: Sun and Moon simulate physically based directional light.
- **Night Factor Uniform**: To prevent costly React re-renders, the time of day is calculated in a `useFrame` loop and pushed to a shared `GraphicsState.ts` which updates global `uNightFactor` and `uSunDirection` uniforms. All custom materials read from this state.
- **Fog**: Dynamic fog color blends smoothly between day (blue-gray), sunset (orange), and night (deep blue), synced across all materials using standard Three.js `#include <fog_fragment>`.

## 2. Terrain System
- **Layered Triplanar Blending**: The `TerrainMaterial` uses procedural noise to blend multiple layers (Grass, Dirt, Rock, Sand, Snow).
- **Shoreline Transitions**: `waterWeight` is baked into the vertex data and used to create smooth transitions into wet sand and underwater depths, eliminating blocky grid shores.
- **LOD Hysteresis**: Terrain chunks use a distance-based LOD system with hysteresis (transitions at 48 and 38 units) to prevent rapid geometry popping when the camera is on the border.

## 3. Water Rendering
- **Lightweight Shader**: `WaterMaterial` calculates depth-based transparency, Fresnel reflections, and animated wave normals completely on the GPU without a heavy depth-pass dependency.
- **Shoreline Edge**: Foam and underwater transitions are achieved by making the water plane transparent and letting the underlying terrain shader handle the shore colors (wet sand).

## 4. Architecture & Buildings
- **Archetype Grouping**: Buildings are classified into `RES_SMALL`, `RES_TOWER`, `COM_TOWER`, etc., and rendered via `InstancedMesh`.
- **Procedural Geometries**: Instead of raw primitive boxes, geometries are designed to look stylized with distinct proportions.
- **Emissive Windows**: The `BuildingMaterial` shader calculates procedural window masks based on local/world position and injects `uNightFactor` to create a glowing city at night, entirely avoiding per-building point lights.

## 5. Vegetation
- **LOD & Shadows**: Trees are clustered via an LCG (Linear Congruential Generator) based on tile coordinates. `InstancedMesh` is used.
- **Stylized Geometries**: Pine trees are built from stacked cones with noise jitter. Oak trees use Icosahedrons.
- **Shadow Budget**: Shadows are disabled on bushes and only enabled on large geometries when graphics settings allow.

## 6. Post-Processing & Quality Tiers
- **Effect Composer**: A lightweight stack consisting of ACES Filmic Tone Mapping, Multi-Sampling (MSAA), Bloom, Hue/Saturation, and Vignette.
- **Scalability**:
  - **LOW**: No post-processing, no shadows, simplified geometries.
  - **MEDIUM**: Standard shadows, basic bloom.
  - **HIGH / ULTRA**: N8AO (Ambient Occlusion) enabled, longer shadow draw distances, ultra-resolution shadow maps.

## 7. Performance Constraints
- **Draw Calls**: Kept under 50 by batching all roads, buildings, and vegetation into single instances per chunk or globally.
- **React Reconciliation**: `<City3DCanvas>` is deeply memoized. It will not re-render unless the actual underlying revision integers change.

## Verification
Use the Developer Debug HUD to monitor WebGL metrics (Draw Calls, Triangles, Geometry Count). Ensure the triangle count remains under 2M for a smooth 60 FPS experience on standard GPUs.
