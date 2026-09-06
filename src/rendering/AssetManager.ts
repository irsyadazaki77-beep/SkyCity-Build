import * as THREE from 'three';

export interface BuildingMaterialSet {
  facadeMat: THREE.MeshStandardMaterial;
  roofMat: THREE.MeshStandardMaterial;
  windowMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
}

export class AssetManager {
  private static instance: AssetManager;
  private textures: Map<string, THREE.Texture> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  private geometries: Map<string, THREE.BufferGeometry> = new Map();

  private constructor() {
    this.initDefaultMaterials();
  }

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  private initDefaultMaterials(): void {
    // Road materials
    this.materials.set(
      'asphalt',
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.85,
        metalness: 0.1,
      })
    );
    this.materials.set(
      'road_marking',
      new THREE.MeshBasicMaterial({
        color: '#facc15',
      })
    );
    this.materials.set(
      'curb',
      new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        roughness: 0.7,
        metalness: 0.1,
      })
    );

    // Terrain material
    this.materials.set(
      'terrain',
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.88,
        metalness: 0.05,
        flatShading: false,
      })
    );

    // Water material
    this.materials.set(
      'water',
      new THREE.MeshStandardMaterial({
        color: '#0284c7',
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.82,
      })
    );
  }

  public getMaterial(name: string): THREE.Material {
    return this.materials.get(name) || this.materials.get('terrain')!;
  }

  public getGeometry(name: string, generator: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (!this.geometries.has(name)) {
      this.geometries.set(name, generator());
    }
    return this.geometries.get(name)!;
  }
}
