import * as THREE from 'three';
import { BuildingArchitecture } from './BuildingArchetypes';
import { TILE_SIZE } from '../components/world/types3D';

/**
 * Helper to merge multiple THREE.BufferGeometry objects into a single cohesive geometry.
 * Preserves positions and normals, re-calculating indices cleanly.
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1) return geometries[0];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const g of geometries) {
    if (!g.attributes.position) continue;
    const posAttr = g.attributes.position;
    const normAttr = g.attributes.normal;
    const uvAttr = g.attributes.uv;
    const indexAttr = g.index;

    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.array[i] + offset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(i + offset);
      }
    }

    for (let i = 0; i < posAttr.count * 3; i++) {
      positions.push(posAttr.array[i]);
    }

    if (normAttr) {
      for (let i = 0; i < normAttr.count * 3; i++) {
        normals.push(normAttr.array[i]);
      }
    } else {
      for (let i = 0; i < posAttr.count * 3; i++) {
        normals.push(0);
      }
    }

    if (uvAttr) {
      for (let i = 0; i < uvAttr.count * 2; i++) {
        uvs.push(uvAttr.array[i]);
      }
    } else {
      for (let i = 0; i < posAttr.count * 2; i++) {
        uvs.push(0);
      }
    }

    offset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

/**
 * Procedural Geometry Builder for all 23 SkyCity Building Architectures.
 * Every geometry is built with its base resting on y = 0 and centered in (x=0, z=0).
 */
export function createBuildingGeometries(): Map<BuildingArchitecture, THREE.BufferGeometry> {
  const geometries = new Map<BuildingArchitecture, THREE.BufferGeometry>();
  const baseWidth = TILE_SIZE * 0.88;

  // --------------------------------------------------------------------------
  // RESIDENTIAL ARCHITECTURES (Pitched roofs, porches, balconies, terraced setbacks)
  // --------------------------------------------------------------------------

  // 1. RES_TENT (Tent shelter + Campfire)
  (() => {
    const tent = new THREE.ConeGeometry(baseWidth * 0.42, 0.70, 4);
    tent.rotateY(Math.PI / 4);
    tent.translate(0, 0.35, 0);

    const pole = new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6);
    pole.translate(0, 0.425, 0);

    const fireRing = new THREE.CylinderGeometry(0.12, 0.14, 0.06, 8);
    fireRing.translate(0.22, 0.03, 0.22);

    geometries.set('RES_TENT', mergeGeometries([tent, pole, fireRing]));
  })();

  // 2. RES_CABIN (Cozy suburban cottage with pitched roof & porch)
  (() => {
    const body = new THREE.BoxGeometry(baseWidth * 0.80, 0.75, baseWidth * 0.80);
    body.translate(0, 0.375, 0);

    const roof = new THREE.ConeGeometry(baseWidth * 0.65, 0.50, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.75 + 0.25, 0);

    const porch = new THREE.BoxGeometry(baseWidth * 0.45, 0.05, 0.22);
    porch.translate(0, 0.45, baseWidth * 0.42);

    const postL = new THREE.CylinderGeometry(0.018, 0.018, 0.45, 6);
    postL.translate(-0.18, 0.225, baseWidth * 0.42);

    const postR = new THREE.CylinderGeometry(0.018, 0.018, 0.45, 6);
    postR.translate(0.18, 0.225, baseWidth * 0.42);

    const chimney = new THREE.BoxGeometry(0.08, 0.35, 0.08);
    chimney.translate(0.20, 0.85, -0.15);

    geometries.set('RES_CABIN', mergeGeometries([body, roof, porch, postL, postR, chimney]));
  })();

  // 3. RES_HOUSE (Modern 2-story suburban villa with garage & chimney)
  (() => {
    const mainBody = new THREE.BoxGeometry(baseWidth * 0.75, 1.25, baseWidth * 0.70);
    mainBody.translate(-0.06, 0.625, 0);

    const mainRoof = new THREE.ConeGeometry(baseWidth * 0.62, 0.60, 4);
    mainRoof.rotateY(Math.PI / 4);
    mainRoof.translate(-0.06, 1.25 + 0.30, 0);

    const garage = new THREE.BoxGeometry(baseWidth * 0.42, 0.70, baseWidth * 0.52);
    garage.translate(baseWidth * 0.32, 0.35, 0.08);

    const garageRoof = new THREE.ConeGeometry(baseWidth * 0.36, 0.35, 4);
    garageRoof.rotateY(Math.PI / 4);
    garageRoof.translate(baseWidth * 0.32, 0.70 + 0.175, 0.08);

    const doorAwning = new THREE.BoxGeometry(0.28, 0.04, 0.18);
    doorAwning.translate(-0.06, 0.68, baseWidth * 0.38);

    const chimney = new THREE.BoxGeometry(0.09, 0.45, 0.09);
    chimney.translate(-0.25, 1.35, -0.18);

    geometries.set('RES_HOUSE', mergeGeometries([mainBody, mainRoof, garage, garageRoof, doorAwning, chimney]));
  })();

  // 4. RES_APARTMENT (Mid-rise apartment block with balconies & penthouse core)
  (() => {
    const body = new THREE.BoxGeometry(baseWidth * 0.88, 2.20, baseWidth * 0.82);
    body.translate(0, 1.10, 0);

    // Front balcony ledges
    const b1 = new THREE.BoxGeometry(baseWidth * 0.70, 0.06, 0.14);
    b1.translate(0, 0.75, baseWidth * 0.43);

    const b2 = new THREE.BoxGeometry(baseWidth * 0.70, 0.06, 0.14);
    b2.translate(0, 1.35, baseWidth * 0.43);

    const b3 = new THREE.BoxGeometry(baseWidth * 0.70, 0.06, 0.14);
    b3.translate(0, 1.85, baseWidth * 0.43);

    const roofCore = new THREE.BoxGeometry(baseWidth * 0.38, 0.38, baseWidth * 0.38);
    roofCore.translate(-0.12, 2.20 + 0.19, -0.10);

    const solarPanel = new THREE.BoxGeometry(0.26, 0.03, 0.22);
    solarPanel.rotateX(-0.2);
    solarPanel.translate(0.18, 2.22, 0.12);

    geometries.set('RES_APARTMENT', mergeGeometries([body, b1, b2, b3, roofCore, solarPanel]));
  })();

  // 5. RES_HIGHRISE (Luxury residential skyscraper with terraced setbacks)
  (() => {
    const baseBlock = new THREE.BoxGeometry(baseWidth * 0.90, 2.0, baseWidth * 0.90);
    baseBlock.translate(0, 1.0, 0);

    const midBlock = new THREE.BoxGeometry(baseWidth * 0.78, 1.8, baseWidth * 0.78);
    midBlock.translate(0, 2.0 + 0.9, 0);

    const topBlock = new THREE.BoxGeometry(baseWidth * 0.64, 1.6, baseWidth * 0.64);
    topBlock.translate(0, 3.8 + 0.8, 0);

    const crownPillar = new THREE.BoxGeometry(baseWidth * 0.40, 0.45, baseWidth * 0.40);
    crownPillar.translate(0, 5.4 + 0.225, 0);

    const spire = new THREE.CylinderGeometry(0.02, 0.04, 0.80, 8);
    spire.translate(0, 5.85 + 0.40, 0);

    geometries.set('RES_HIGHRISE', mergeGeometries([baseBlock, midBlock, topBlock, crownPillar, spire]));
  })();

  // --------------------------------------------------------------------------
  // COMMERCIAL ARCHITECTURES (Glass curtain walls, awnings, billboards, sky spires)
  // --------------------------------------------------------------------------

  // 6. COM_STALL (Kiosk market stall with striped awning)
  (() => {
    const kiosk = new THREE.BoxGeometry(baseWidth * 0.65, 0.65, baseWidth * 0.55);
    kiosk.translate(0, 0.325, 0);

    const awning = new THREE.BoxGeometry(baseWidth * 0.75, 0.05, 0.32);
    awning.rotateX(0.25);
    awning.translate(0, 0.68, 0.18);

    const sign = new THREE.BoxGeometry(baseWidth * 0.50, 0.18, 0.04);
    sign.translate(0, 0.82, -0.05);

    geometries.set('COM_STALL', mergeGeometries([kiosk, awning, sign]));
  })();

  // 7. COM_SHOP (2-story retail store with display front & sign)
  (() => {
    const body = new THREE.BoxGeometry(baseWidth * 0.85, 1.20, baseWidth * 0.75);
    body.translate(0, 0.60, 0);

    const displayFrame = new THREE.BoxGeometry(baseWidth * 0.72, 0.45, 0.08);
    displayFrame.translate(0, 0.30, baseWidth * 0.38);

    const canopy = new THREE.BoxGeometry(baseWidth * 0.82, 0.06, 0.22);
    canopy.translate(0, 0.62, baseWidth * 0.42);

    const roofSign = new THREE.BoxGeometry(baseWidth * 0.60, 0.32, 0.06);
    roofSign.translate(0, 1.20 + 0.16, -0.15);

    geometries.set('COM_SHOP', mergeGeometries([body, displayFrame, canopy, roofSign]));
  })();

  // 8. COM_MALL (Wide commercial mall complex with central dome)
  (() => {
    const mainHall = new THREE.BoxGeometry(baseWidth * 0.92, 1.10, baseWidth * 0.92);
    mainHall.translate(0, 0.55, 0);

    const dome = new THREE.SphereGeometry(baseWidth * 0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(0, 1.10, 0);

    const entrancePortico = new THREE.BoxGeometry(baseWidth * 0.50, 0.50, 0.20);
    entrancePortico.translate(0, 0.25, baseWidth * 0.48);

    const hvac = new THREE.BoxGeometry(0.24, 0.18, 0.24);
    hvac.translate(-0.25, 1.10 + 0.09, -0.22);

    geometries.set('COM_MALL', mergeGeometries([mainHall, dome, entrancePortico, hvac]));
  })();

  // 9. COM_TOWER (Modern sleek office tower with entrance foyer & spire)
  (() => {
    const towerBody = new THREE.BoxGeometry(baseWidth * 0.80, 3.40, baseWidth * 0.70);
    towerBody.translate(0, 1.70, 0);

    const foyer = new THREE.BoxGeometry(baseWidth * 0.88, 0.60, baseWidth * 0.80);
    foyer.translate(0, 0.30, 0);

    const crown = new THREE.BoxGeometry(baseWidth * 0.65, 0.35, baseWidth * 0.55);
    crown.translate(0, 3.40 + 0.175, 0);

    const antenna = new THREE.CylinderGeometry(0.02, 0.03, 0.70, 8);
    antenna.translate(0, 3.575 + 0.35, 0);

    geometries.set('COM_TOWER', mergeGeometries([towerBody, foyer, crown, antenna]));
  })();

  // 10. COM_PREMIUM_SKYSCRAPER (Iconic high-density skyscraper with crown)
  (() => {
    const tier1 = new THREE.BoxGeometry(baseWidth * 0.92, 2.2, baseWidth * 0.92);
    tier1.translate(0, 1.1, 0);

    const tier2 = new THREE.BoxGeometry(baseWidth * 0.78, 2.0, baseWidth * 0.78);
    tier2.translate(0, 2.2 + 1.0, 0);

    const tier3 = new THREE.BoxGeometry(baseWidth * 0.62, 1.8, baseWidth * 0.62);
    tier3.translate(0, 4.2 + 0.9, 0);

    const crownCone = new THREE.ConeGeometry(baseWidth * 0.42, 1.2, 4);
    crownCone.rotateY(Math.PI / 4);
    crownCone.translate(0, 6.0 + 0.60, 0);

    geometries.set('COM_PREMIUM_SKYSCRAPER', mergeGeometries([tier1, tier2, tier3, crownCone]));
  })();

  // --------------------------------------------------------------------------
  // INDUSTRIAL ARCHITECTURES (Sawtooth roofs, warehouses, smokestacks, tanks)
  // --------------------------------------------------------------------------

  // 11. IND_WORKSHOP (Small workshop with saw-tooth roof & garage door)
  (() => {
    const body = new THREE.BoxGeometry(baseWidth * 0.85, 0.85, baseWidth * 0.80);
    body.translate(0, 0.425, 0);

    // Sawtooth roof wedge
    const tooth1 = new THREE.BoxGeometry(baseWidth * 0.85, 0.25, baseWidth * 0.35);
    tooth1.rotateX(0.25);
    tooth1.translate(0, 0.85 + 0.10, -0.18);

    const tooth2 = new THREE.BoxGeometry(baseWidth * 0.85, 0.25, baseWidth * 0.35);
    tooth2.rotateX(0.25);
    tooth2.translate(0, 0.85 + 0.10, 0.18);

    const rollupDoor = new THREE.BoxGeometry(baseWidth * 0.45, 0.50, 0.06);
    rollupDoor.translate(0, 0.25, baseWidth * 0.41);

    geometries.set('IND_WORKSHOP', mergeGeometries([body, tooth1, tooth2, rollupDoor]));
  })();

  // 12. IND_WAREHOUSE (Logistics storage warehouse with barrel roof & loading docks)
  (() => {
    const body = new THREE.BoxGeometry(baseWidth * 0.90, 1.10, baseWidth * 0.85);
    body.translate(0, 0.55, 0);

    const roofRoof = new THREE.CylinderGeometry(baseWidth * 0.45, baseWidth * 0.45, baseWidth * 0.90, 12, 1, false, 0, Math.PI);
    roofRoof.rotateZ(-Math.PI / 2);
    roofRoof.translate(0, 1.10, 0);

    const dockPlatform = new THREE.BoxGeometry(baseWidth * 0.70, 0.20, 0.22);
    dockPlatform.translate(0, 0.10, baseWidth * 0.45);

    geometries.set('IND_WAREHOUSE', mergeGeometries([body, roofRoof, dockPlatform]));
  })();

  // 13. IND_FACTORY (Heavy factory with dual smokestacks & piping)
  (() => {
    const factoryHall = new THREE.BoxGeometry(baseWidth * 0.88, 1.25, baseWidth * 0.80);
    factoryHall.translate(0, 0.625, 0);

    const stack1 = new THREE.CylinderGeometry(0.10, 0.14, 2.20, 10);
    stack1.translate(-0.24, 1.10, -0.22);

    const stack2 = new THREE.CylinderGeometry(0.10, 0.14, 2.20, 10);
    stack2.translate(0.24, 1.10, -0.22);

    const pipeConduit = new THREE.CylinderGeometry(0.04, 0.04, 0.65, 8);
    pipeConduit.rotateZ(Math.PI / 2);
    pipeConduit.translate(0, 1.15, 0.18);

    geometries.set('IND_FACTORY', mergeGeometries([factoryHall, stack1, stack2, pipeConduit]));
  })();

  // 14. IND_LOGISTICS (Distribution center with loading bays & container stacks)
  (() => {
    const mainHub = new THREE.BoxGeometry(baseWidth * 0.92, 1.35, baseWidth * 0.85);
    mainHub.translate(0, 0.675, 0);

    const cargoBox1 = new THREE.BoxGeometry(0.32, 0.22, 0.65);
    cargoBox1.translate(-baseWidth * 0.38, 0.11, baseWidth * 0.32);

    const cargoBox2 = new THREE.BoxGeometry(0.32, 0.22, 0.65);
    cargoBox2.translate(-baseWidth * 0.38, 0.33, baseWidth * 0.32);

    const acBank = new THREE.BoxGeometry(0.40, 0.16, 0.30);
    acBank.translate(0.15, 1.35 + 0.08, 0);

    geometries.set('IND_LOGISTICS', mergeGeometries([mainHub, cargoBox1, cargoBox2, acBank]));
  })();

  // 15. IND_HIGHTECH (Modern R&D tech park with glass atrium connector)
  (() => {
    const wingA = new THREE.BoxGeometry(baseWidth * 0.38, 2.10, baseWidth * 0.80);
    wingA.translate(-baseWidth * 0.26, 1.05, 0);

    const wingB = new THREE.BoxGeometry(baseWidth * 0.38, 2.10, baseWidth * 0.80);
    wingB.translate(baseWidth * 0.26, 1.05, 0);

    const atriumBridge = new THREE.BoxGeometry(baseWidth * 0.40, 1.20, baseWidth * 0.50);
    atriumBridge.translate(0, 1.0, 0);

    const satDish = new THREE.CylinderGeometry(0.16, 0.02, 0.08, 8);
    satDish.rotateX(-0.5);
    satDish.translate(-baseWidth * 0.26, 2.10 + 0.12, 0);

    geometries.set('IND_HIGHTECH', mergeGeometries([wingA, wingB, atriumBridge, satDish]));
  })();

  // --------------------------------------------------------------------------
  // CIVIC SERVICES & UTILITIES (Power, Water, Fire, Police, Hospital, School, Park)
  // --------------------------------------------------------------------------

  // 16. SRV_POWER (Power Station with dual cooling towers & transformer)
  (() => {
    const hall = new THREE.BoxGeometry(baseWidth * 0.80, 1.10, baseWidth * 0.55);
    hall.translate(0, 0.55, -0.20);

    const tower1 = new THREE.CylinderGeometry(0.22, 0.32, 2.10, 12);
    tower1.translate(-0.25, 1.05, 0.22);

    const tower2 = new THREE.CylinderGeometry(0.22, 0.32, 2.10, 12);
    tower2.translate(0.25, 1.05, 0.22);

    const transformer = new THREE.BoxGeometry(0.35, 0.45, 0.25);
    transformer.translate(0, 0.225, 0.25);

    geometries.set('SRV_POWER', mergeGeometries([hall, tower1, tower2, transformer]));
  })();

  // 17. SRV_WATER (Water Treatment Pump & Water Tower Tank)
  (() => {
    const facility = new THREE.BoxGeometry(baseWidth * 0.70, 0.85, baseWidth * 0.70);
    facility.translate(-0.10, 0.425, -0.10);

    const tankPost = new THREE.CylinderGeometry(0.06, 0.08, 1.60, 8);
    tankPost.translate(0.28, 0.80, 0.28);

    const tankBody = new THREE.CylinderGeometry(0.32, 0.32, 0.65, 12);
    tankBody.translate(0.28, 1.60 + 0.325, 0.28);

    const tankCap = new THREE.ConeGeometry(0.34, 0.22, 12);
    tankCap.translate(0.28, 2.25 + 0.11, 0.28);

    geometries.set('SRV_WATER', mergeGeometries([facility, tankPost, tankBody, tankCap]));
  })();

  // 18. SRV_FIRE (Fire Station with double garage bays & hose tower)
  (() => {
    const mainStation = new THREE.BoxGeometry(baseWidth * 0.88, 1.20, baseWidth * 0.75);
    mainStation.translate(0, 0.60, 0);

    const bayDoor1 = new THREE.BoxGeometry(0.30, 0.55, 0.06);
    bayDoor1.translate(-0.20, 0.275, baseWidth * 0.38);

    const bayDoor2 = new THREE.BoxGeometry(0.30, 0.55, 0.06);
    bayDoor2.translate(0.20, 0.275, baseWidth * 0.38);

    const hoseTower = new THREE.BoxGeometry(0.26, 2.10, 0.26);
    hoseTower.translate(-0.28, 1.05, -0.22);

    const emblemBoard = new THREE.BoxGeometry(0.40, 0.22, 0.06);
    emblemBoard.translate(0, 0.90, baseWidth * 0.38);

    geometries.set('SRV_FIRE', mergeGeometries([mainStation, bayDoor1, bayDoor2, hoseTower, emblemBoard]));
  })();

  // 19. SRV_POLICE (Police Station with radio mast & helipad)
  (() => {
    const precinct = new THREE.BoxGeometry(baseWidth * 0.88, 1.45, baseWidth * 0.80);
    precinct.translate(0, 0.725, 0);

    const radioMast = new THREE.CylinderGeometry(0.02, 0.04, 1.80, 8);
    radioMast.translate(-0.30, 1.45 + 0.90, -0.25);

    const helipadRim = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12);
    helipadRim.translate(0.18, 1.45 + 0.02, 0.12);

    const entranceCanopy = new THREE.BoxGeometry(0.45, 0.06, 0.22);
    entranceCanopy.translate(0, 0.55, baseWidth * 0.42);

    geometries.set('SRV_POLICE', mergeGeometries([precinct, radioMast, helipadRim, entranceCanopy]));
  })();

  // 20. SRV_CLINIC (Healthcare Clinic / Hospital with 3D Cross)
  (() => {
    const mainHospital = new THREE.BoxGeometry(baseWidth * 0.90, 1.65, baseWidth * 0.82);
    mainHospital.translate(0, 0.825, 0);

    const ambulanceBay = new THREE.BoxGeometry(0.48, 0.55, 0.35);
    ambulanceBay.translate(0.22, 0.275, baseWidth * 0.42);

    // 3D Medical Cross emblem on front
    const crossVert = new THREE.BoxGeometry(0.10, 0.32, 0.06);
    crossVert.translate(-0.22, 1.15, baseWidth * 0.42);

    const crossHoriz = new THREE.BoxGeometry(0.32, 0.10, 0.06);
    crossHoriz.translate(-0.22, 1.15, baseWidth * 0.42);

    geometries.set('SRV_CLINIC', mergeGeometries([mainHospital, ambulanceBay, crossVert, crossHoriz]));
  })();

  // 21. SRV_SCHOOL (Educational Campus with clock tower)
  (() => {
    const mainWing = new THREE.BoxGeometry(baseWidth * 0.88, 1.20, baseWidth * 0.55);
    mainWing.translate(0, 0.60, -0.15);

    const sideWing = new THREE.BoxGeometry(baseWidth * 0.38, 1.0, baseWidth * 0.45);
    sideWing.translate(-0.26, 0.50, 0.20);

    const clockTower = new THREE.BoxGeometry(0.32, 2.20, 0.32);
    clockTower.translate(0.24, 1.10, 0.15);

    const towerRoof = new THREE.ConeGeometry(0.25, 0.45, 4);
    towerRoof.rotateY(Math.PI / 4);
    towerRoof.translate(0.24, 2.20 + 0.225, 0.15);

    geometries.set('SRV_SCHOOL', mergeGeometries([mainWing, sideWing, clockTower, towerRoof]));
  })();

  // 22. SRV_WASTE (Recycling & Waste Management with sorting bay & silos)
  (() => {
    const sortingHall = new THREE.BoxGeometry(baseWidth * 0.85, 1.10, baseWidth * 0.70);
    sortingHall.translate(-0.05, 0.55, -0.10);

    const conveyor = new THREE.BoxGeometry(0.18, 0.16, 0.85);
    conveyor.rotateX(-0.28);
    conveyor.translate(0.28, 0.55, 0.15);

    const silo1 = new THREE.CylinderGeometry(0.18, 0.18, 1.40, 10);
    silo1.translate(-0.28, 0.70, 0.28);

    const silo2 = new THREE.CylinderGeometry(0.18, 0.18, 1.40, 10);
    silo2.translate(0.0, 0.70, 0.32);

    geometries.set('SRV_WASTE', mergeGeometries([sortingHall, conveyor, silo1, silo2]));
  })();

  // 23. SRV_PARK (City Park Plaza with Gazebo, Flowerbeds & Trees)
  (() => {
    const plazaBase = new THREE.BoxGeometry(baseWidth * 0.94, 0.04, baseWidth * 0.94);
    plazaBase.translate(0, 0.02, 0);

    // Central Gazebo
    const gazeboBase = new THREE.CylinderGeometry(0.24, 0.26, 0.10, 8);
    gazeboBase.translate(0, 0.09, 0);

    const gazeboPosts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2;
      const post = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6);
      post.translate(Math.cos(ang) * 0.18, 0.14 + 0.175, Math.sin(ang) * 0.18);
      gazeboPosts.push(post);
    }

    const gazeboRoof = new THREE.ConeGeometry(0.30, 0.28, 8);
    gazeboRoof.translate(0, 0.49 + 0.14, 0);

    // Flowerbed borders
    const bed1 = new THREE.BoxGeometry(0.32, 0.06, 0.20);
    bed1.translate(-0.26, 0.05, -0.26);

    const bed2 = new THREE.BoxGeometry(0.32, 0.06, 0.20);
    bed2.translate(0.26, 0.05, 0.26);

    geometries.set('SRV_PARK', mergeGeometries([plazaBase, gazeboBase, ...gazeboPosts, gazeboRoof, bed1, bed2]));
  })();

  return geometries;
}
