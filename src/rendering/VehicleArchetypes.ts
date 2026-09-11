import * as THREE from 'three';

/**
 * Procedural Stylized-Realistic Vehicle Geometry Builder
 * Creates lightweight, high-performance merged buffer geometries with vertex colors
 * for windows, wheels, headlights, taillights, and body panels.
 */

interface SubMeshDef {
  geo: THREE.BufferGeometry;
  // Vertex color: [r, g, b] where [1,1,1] means body panel (modulated by instance color),
  // other colors (e.g. windows, wheels, lights) are rendered with fixed material colors.
  color: [number, number, number];
  isBody?: boolean;
}

function mergeVehicleParts(parts: SubMeshDef[]): THREE.BufferGeometry {
  let totalVerts = 0;
  parts.forEach((p) => {
    totalVerts += p.geo.attributes.position.count;
  });

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const colArr = new Float32Array(totalVerts * 3);
  const maskArr = new Float32Array(totalVerts); // 1.0 = body, 0.0 = fixed detail

  let offset = 0;
  parts.forEach((p) => {
    const pos = p.geo.attributes.position;
    const norm = p.geo.attributes.normal;
    const isBody = p.isBody ?? false;
    const [cr, cg, cb] = p.color;

    for (let i = 0; i < pos.count; i++) {
      posArr[(offset + i) * 3 + 0] = pos.getX(i);
      posArr[(offset + i) * 3 + 1] = pos.getY(i);
      posArr[(offset + i) * 3 + 2] = pos.getZ(i);

      if (norm) {
        normArr[(offset + i) * 3 + 0] = norm.getX(i);
        normArr[(offset + i) * 3 + 1] = norm.getY(i);
        normArr[(offset + i) * 3 + 2] = norm.getZ(i);
      } else {
        normArr[(offset + i) * 3 + 0] = 0;
        normArr[(offset + i) * 3 + 1] = 1;
        normArr[(offset + i) * 3 + 2] = 0;
      }

      colArr[(offset + i) * 3 + 0] = cr;
      colArr[(offset + i) * 3 + 1] = cg;
      colArr[(offset + i) * 3 + 2] = cb;

      maskArr[offset + i] = isBody ? 1.0 : 0.0;
    }
    offset += pos.count;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  merged.setAttribute('aBodyMask', new THREE.BufferAttribute(maskArr, 1));
  return merged;
}

// Helper: Wheel cylinder
function createWheel(x: number, y: number, z: number, radius = 0.034, width = 0.026): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius, width, 8);
  geo.rotateZ(Math.PI / 2);
  geo.translate(x, y, z);
  return geo;
}

/**
 * 1. Modern Sedan / City Car
 * Proportions: 0.15 wide x 0.11 high x 0.36 long
 */
export function createSedanGeometry(): THREE.BufferGeometry {
  const parts: SubMeshDef[] = [];

  // Lower chassis
  const chassis = new THREE.BoxGeometry(0.15, 0.045, 0.35);
  chassis.translate(0, 0.042, 0);
  parts.push({ geo: chassis, color: [1, 1, 1], isBody: true });

  // Cabin greenhouse
  const cabin = new THREE.BoxGeometry(0.128, 0.048, 0.19);
  cabin.translate(0, 0.082, -0.015);
  parts.push({ geo: cabin, color: [1, 1, 1], isBody: true });

  // Dark tinted windows (windshield, rear window, side glass)
  const frontGlass = new THREE.BoxGeometry(0.124, 0.042, 0.03);
  frontGlass.translate(0, 0.078, 0.075);
  parts.push({ geo: frontGlass, color: [0.12, 0.16, 0.22] });

  const rearGlass = new THREE.BoxGeometry(0.124, 0.040, 0.03);
  rearGlass.translate(0, 0.078, -0.10);
  parts.push({ geo: rearGlass, color: [0.12, 0.16, 0.22] });

  const sideGlass = new THREE.BoxGeometry(0.134, 0.034, 0.14);
  sideGlass.translate(0, 0.082, -0.015);
  parts.push({ geo: sideGlass, color: [0.10, 0.14, 0.20] });

  // Front bumper / grille trim
  const grille = new THREE.BoxGeometry(0.13, 0.02, 0.02);
  grille.translate(0, 0.036, 0.176);
  parts.push({ geo: grille, color: [0.15, 0.18, 0.22] });

  // Headlights (Warm White LED)
  const headL = new THREE.BoxGeometry(0.028, 0.016, 0.015);
  headL.translate(-0.048, 0.052, 0.176);
  parts.push({ geo: headL, color: [1.8, 1.7, 1.3] });

  const headR = new THREE.BoxGeometry(0.028, 0.016, 0.015);
  headR.translate(0.048, 0.052, 0.176);
  parts.push({ geo: headR, color: [1.8, 1.7, 1.3] });

  // Taillights (Crimson Red Glow)
  const tailL = new THREE.BoxGeometry(0.028, 0.016, 0.015);
  tailL.translate(-0.048, 0.052, -0.176);
  parts.push({ geo: tailL, color: [1.6, 0.15, 0.15] });

  const tailR = new THREE.BoxGeometry(0.028, 0.016, 0.015);
  tailR.translate(0.048, 0.052, -0.176);
  parts.push({ geo: tailR, color: [1.6, 0.15, 0.15] });

  // 4 Wheels (Dark Charcoal Rubber)
  const wFL = createWheel(-0.076, 0.032, 0.105);
  const wFR = createWheel(0.076, 0.032, 0.105);
  const wRL = createWheel(-0.076, 0.032, -0.105);
  const wRR = createWheel(0.076, 0.032, -0.105);
  [wFL, wFR, wRL, wRR].forEach((w) => parts.push({ geo: w, color: [0.08, 0.08, 0.09] }));

  return mergeVehicleParts(parts);
}

/**
 * 2. Modern SUV / Crossover
 * Proportions: 0.165 wide x 0.135 high x 0.38 long
 */
export function createSUVGeometry(): THREE.BufferGeometry {
  const parts: SubMeshDef[] = [];

  // Lower chassis
  const chassis = new THREE.BoxGeometry(0.162, 0.055, 0.37);
  chassis.translate(0, 0.052, 0);
  parts.push({ geo: chassis, color: [1, 1, 1], isBody: true });

  // Taller cabin with squared rear hatch
  const cabin = new THREE.BoxGeometry(0.142, 0.060, 0.23);
  cabin.translate(0, 0.102, -0.03);
  parts.push({ geo: cabin, color: [1, 1, 1], isBody: true });

  // Dark tinted windows
  const frontGlass = new THREE.BoxGeometry(0.138, 0.048, 0.03);
  frontGlass.translate(0, 0.098, 0.08);
  parts.push({ geo: frontGlass, color: [0.12, 0.16, 0.22] });

  const rearGlass = new THREE.BoxGeometry(0.138, 0.048, 0.03);
  rearGlass.translate(0, 0.098, -0.14);
  parts.push({ geo: rearGlass, color: [0.12, 0.16, 0.22] });

  const sideGlass = new THREE.BoxGeometry(0.148, 0.042, 0.18);
  sideGlass.translate(0, 0.102, -0.03);
  parts.push({ geo: sideGlass, color: [0.10, 0.14, 0.20] });

  // Roof luggage rails
  const railL = new THREE.BoxGeometry(0.012, 0.012, 0.18);
  railL.translate(-0.058, 0.136, -0.03);
  parts.push({ geo: railL, color: [0.25, 0.28, 0.32] });

  const railR = new THREE.BoxGeometry(0.012, 0.012, 0.18);
  railR.translate(0.058, 0.136, -0.03);
  parts.push({ geo: railR, color: [0.25, 0.28, 0.32] });

  // Headlights & Taillights
  const headL = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  headL.translate(-0.052, 0.062, 0.186);
  parts.push({ geo: headL, color: [1.8, 1.7, 1.3] });

  const headR = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  headR.translate(0.052, 0.062, 0.186);
  parts.push({ geo: headR, color: [1.8, 1.7, 1.3] });

  const tailL = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  tailL.translate(-0.052, 0.062, -0.186);
  parts.push({ geo: tailL, color: [1.6, 0.15, 0.15] });

  const tailR = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  tailR.translate(0.052, 0.062, -0.186);
  parts.push({ geo: tailR, color: [1.6, 0.15, 0.15] });

  // 4 Larger SUV Wheels
  const wFL = createWheel(-0.082, 0.038, 0.115, 0.038, 0.030);
  const wFR = createWheel(0.082, 0.038, 0.115, 0.038, 0.030);
  const wRL = createWheel(-0.082, 0.038, -0.115, 0.038, 0.030);
  const wRR = createWheel(0.082, 0.038, -0.115, 0.038, 0.030);
  [wFL, wFR, wRL, wRR].forEach((w) => parts.push({ geo: w, color: [0.08, 0.08, 0.09] }));

  return mergeVehicleParts(parts);
}

/**
 * 3. Modern City Transit Bus
 * Proportions: 0.18 wide x 0.16 high x 0.68 long
 */
export function createBusGeometry(): THREE.BufferGeometry {
  const parts: SubMeshDef[] = [];

  // Aerodynamic bus body
  const body = new THREE.BoxGeometry(0.178, 0.135, 0.66);
  body.translate(0, 0.095, 0);
  parts.push({ geo: body, color: [1, 1, 1], isBody: true });

  // Panoramic front windshield
  const windshield = new THREE.BoxGeometry(0.170, 0.085, 0.03);
  windshield.translate(0, 0.105, 0.322);
  parts.push({ geo: windshield, color: [0.10, 0.14, 0.20] });

  // Side passenger window strip
  const sideGlass = new THREE.BoxGeometry(0.184, 0.055, 0.48);
  sideGlass.translate(0, 0.110, -0.05);
  parts.push({ geo: sideGlass, color: [0.08, 0.12, 0.18] });

  // Rooftop AC / Climate pod
  const acPod = new THREE.BoxGeometry(0.12, 0.024, 0.22);
  acPod.translate(0, 0.172, -0.06);
  parts.push({ geo: acPod, color: [0.90, 0.92, 0.95] });

  // Front destination LED sign
  const destSign = new THREE.BoxGeometry(0.11, 0.016, 0.02);
  destSign.translate(0, 0.148, 0.324);
  parts.push({ geo: destSign, color: [1.8, 1.2, 0.2] });

  // Headlights & Taillights
  const headL = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  headL.translate(-0.056, 0.050, 0.332);
  parts.push({ geo: headL, color: [1.8, 1.7, 1.3] });

  const headR = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  headR.translate(0.056, 0.050, 0.332);
  parts.push({ geo: headR, color: [1.8, 1.7, 1.3] });

  const tailL = new THREE.BoxGeometry(0.032, 0.024, 0.015);
  tailL.translate(-0.056, 0.060, -0.332);
  parts.push({ geo: tailL, color: [1.6, 0.15, 0.15] });

  const tailR = new THREE.BoxGeometry(0.032, 0.024, 0.015);
  tailR.translate(0.056, 0.060, -0.332);
  parts.push({ geo: tailR, color: [1.6, 0.15, 0.15] });

  // 6 Bus Wheels (Front steering axle + dual rear axle)
  const wFL = createWheel(-0.090, 0.036, 0.22, 0.036, 0.028);
  const wFR = createWheel(0.090, 0.036, 0.22, 0.036, 0.028);
  const wR1L = createWheel(-0.090, 0.036, -0.16, 0.036, 0.028);
  const wR1R = createWheel(0.090, 0.036, -0.16, 0.036, 0.028);
  const wR2L = createWheel(-0.090, 0.036, -0.24, 0.036, 0.028);
  const wR2R = createWheel(0.090, 0.036, -0.24, 0.036, 0.028);
  [wFL, wFR, wR1L, wR1R, wR2L, wR2R].forEach((w) => parts.push({ geo: w, color: [0.08, 0.08, 0.09] }));

  return mergeVehicleParts(parts);
}

/**
 * 4. Heavy Logistics Freight Truck
 * Proportions: 0.18 wide x 0.19 high x 0.65 long
 */
export function createTruckGeometry(): THREE.BufferGeometry {
  const parts: SubMeshDef[] = [];

  // Front tractor cab
  const cab = new THREE.BoxGeometry(0.175, 0.125, 0.20);
  cab.translate(0, 0.095, 0.20);
  parts.push({ geo: cab, color: [1, 1, 1], isBody: true });

  // Windshield & side windows
  const windshield = new THREE.BoxGeometry(0.165, 0.052, 0.02);
  windshield.translate(0, 0.115, 0.298);
  parts.push({ geo: windshield, color: [0.10, 0.14, 0.20] });

  // Aerodynamic roof fairing / sun visor
  const fairing = new THREE.BoxGeometry(0.160, 0.035, 0.14);
  fairing.translate(0, 0.170, 0.18);
  parts.push({ geo: fairing, color: [1, 1, 1], isBody: true });

  // Cargo box / trailer
  const cargoBox = new THREE.BoxGeometry(0.182, 0.160, 0.42);
  cargoBox.translate(0, 0.120, -0.12);
  parts.push({ geo: cargoBox, color: [0.92, 0.93, 0.96] }); // Clean freight container

  // Side fuel tanks / chassis frame
  const frame = new THREE.BoxGeometry(0.165, 0.040, 0.38);
  frame.translate(0, 0.045, -0.10);
  parts.push({ geo: frame, color: [0.22, 0.24, 0.28] });

  // Headlights & Taillights
  const headL = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  headL.translate(-0.056, 0.048, 0.302);
  parts.push({ geo: headL, color: [1.8, 1.7, 1.3] });

  const headR = new THREE.BoxGeometry(0.032, 0.018, 0.015);
  headR.translate(0.056, 0.048, 0.302);
  parts.push({ geo: headR, color: [1.8, 1.7, 1.3] });

  const tailL = new THREE.BoxGeometry(0.032, 0.024, 0.015);
  tailL.translate(-0.056, 0.050, -0.332);
  parts.push({ geo: tailL, color: [1.6, 0.15, 0.15] });

  const tailR = new THREE.BoxGeometry(0.032, 0.024, 0.015);
  tailR.translate(0.056, 0.050, -0.332);
  parts.push({ geo: tailR, color: [1.6, 0.15, 0.15] });

  // 6 Heavy Wheels
  const wFL = createWheel(-0.090, 0.038, 0.22, 0.038, 0.030);
  const wFR = createWheel(0.090, 0.038, 0.22, 0.038, 0.030);
  const wR1L = createWheel(-0.090, 0.038, -0.18, 0.038, 0.030);
  const wR1R = createWheel(0.090, 0.038, -0.18, 0.038, 0.030);
  const wR2L = createWheel(-0.090, 0.038, -0.26, 0.038, 0.030);
  const wR2R = createWheel(0.090, 0.038, -0.26, 0.038, 0.030);
  [wFL, wFR, wR1L, wR1R, wR2L, wR2R].forEach((w) => parts.push({ geo: w, color: [0.08, 0.08, 0.09] }));

  return mergeVehicleParts(parts);
}

/**
 * 5. Emergency Service Vehicle (Police, Fire, Ambulance)
 */
export function createEmergencyGeometry(type: 'police' | 'fire' | 'ambulance'): THREE.BufferGeometry {
  const parts: SubMeshDef[] = [];

  if (type === 'police') {
    // Police Cruiser: Sedan body with roof lightbar
    const chassis = new THREE.BoxGeometry(0.15, 0.045, 0.35);
    chassis.translate(0, 0.042, 0);
    parts.push({ geo: chassis, color: [1, 1, 1], isBody: true });

    const cabin = new THREE.BoxGeometry(0.128, 0.048, 0.19);
    cabin.translate(0, 0.082, -0.015);
    parts.push({ geo: cabin, color: [1, 1, 1], isBody: true });

    const frontGlass = new THREE.BoxGeometry(0.124, 0.042, 0.03);
    frontGlass.translate(0, 0.078, 0.075);
    parts.push({ geo: frontGlass, color: [0.12, 0.16, 0.22] });

    const rearGlass = new THREE.BoxGeometry(0.124, 0.040, 0.03);
    rearGlass.translate(0, 0.078, -0.10);
    parts.push({ geo: rearGlass, color: [0.12, 0.16, 0.22] });

    // Roof lightbar (Blue & Red beacons)
    const barBase = new THREE.BoxGeometry(0.09, 0.012, 0.025);
    barBase.translate(0, 0.112, -0.015);
    parts.push({ geo: barBase, color: [0.2, 0.2, 0.2] });

    const beaconRed = new THREE.BoxGeometry(0.038, 0.016, 0.02);
    beaconRed.translate(-0.024, 0.122, -0.015);
    parts.push({ geo: beaconRed, color: [2.5, 0.1, 0.1] });

    const beaconBlue = new THREE.BoxGeometry(0.038, 0.016, 0.02);
    beaconBlue.translate(0.024, 0.122, -0.015);
    parts.push({ geo: beaconBlue, color: [0.1, 0.6, 2.5] });

    // Wheels & Lights
    const headL = new THREE.BoxGeometry(0.028, 0.016, 0.015);
    headL.translate(-0.048, 0.052, 0.176);
    parts.push({ geo: headL, color: [1.8, 1.7, 1.3] });

    const headR = new THREE.BoxGeometry(0.028, 0.016, 0.015);
    headR.translate(0.048, 0.052, 0.176);
    parts.push({ geo: headR, color: [1.8, 1.7, 1.3] });

    const tailL = new THREE.BoxGeometry(0.028, 0.016, 0.015);
    tailL.translate(-0.048, 0.052, -0.176);
    parts.push({ geo: tailL, color: [1.6, 0.15, 0.15] });

    const tailR = new THREE.BoxGeometry(0.028, 0.016, 0.015);
    tailR.translate(0.048, 0.052, -0.176);
    parts.push({ geo: tailR, color: [1.6, 0.15, 0.15] });

    const wFL = createWheel(-0.076, 0.032, 0.105);
    const wFR = createWheel(0.076, 0.032, 0.105);
    const wRL = createWheel(-0.076, 0.032, -0.105);
    const wRR = createWheel(0.076, 0.032, -0.105);
    [wFL, wFR, wRL, wRR].forEach((w) => parts.push({ geo: w, color: [0.08, 0.08, 0.09] }));
  } else if (type === 'fire') {
    // Fire Rescue Engine
    const cab = new THREE.BoxGeometry(0.18, 0.13, 0.20);
    cab.translate(0, 0.10, 0.18);
    parts.push({ geo: cab, color: [1, 1, 1], isBody: true });

    const rescueBody = new THREE.BoxGeometry(0.185, 0.14, 0.38);
    rescueBody.translate(0, 0.11, -0.10);
    parts.push({ geo: rescueBody, color: [1, 1, 1], isBody: true });

    // Rooftop ladder
    const ladder = new THREE.BoxGeometry(0.07, 0.02, 0.42);
    ladder.translate(0, 0.19, -0.06);
    parts.push({ geo: ladder, color: [0.85, 0.85, 0.88] });

    // Flashing emergency lightbar
    const bar = new THREE.BoxGeometry(0.14, 0.02, 0.03);
    bar.translate(0, 0.175, 0.18);
    parts.push({ geo: bar, color: [2.5, 0.1, 0.1] });

    // Wheels & Lights
    const headL = new THREE.BoxGeometry(0.032, 0.018, 0.015);
    headL.translate(-0.056, 0.052, 0.282);
    parts.push({ geo: headL, color: [1.8, 1.7, 1.3] });

    const headR = new THREE.BoxGeometry(0.032, 0.018, 0.015);
    headR.translate(0.056, 0.052, 0.282);
    parts.push({ geo: headR, color: [1.8, 1.7, 1.3] });

    const tailL = new THREE.BoxGeometry(0.032, 0.024, 0.015);
    tailL.translate(-0.056, 0.055, -0.292);
    parts.push({ geo: tailL, color: [1.6, 0.15, 0.15] });

    const tailR = new THREE.BoxGeometry(0.032, 0.024, 0.015);
    tailR.translate(0.056, 0.055, -0.292);
    parts.push({ geo: tailR, color: [1.6, 0.15, 0.15] });

    const wFL = createWheel(-0.092, 0.038, 0.20, 0.038, 0.030);
    const wFR = createWheel(0.092, 0.038, 0.20, 0.038, 0.030);
    const wRL = createWheel(-0.092, 0.038, -0.16, 0.038, 0.030);
    const wRR = createWheel(0.092, 0.038, -0.16, 0.038, 0.030);
    [wFL, wFR, wRL, wRR].forEach((w) => parts.push({ geo: w, color: [0.08, 0.08, 0.09] }));
  } else {
    // Ambulance Van
    const vanBody = new THREE.BoxGeometry(0.17, 0.14, 0.44);
    vanBody.translate(0, 0.10, 0);
    parts.push({ geo: vanBody, color: [1, 1, 1], isBody: true });

    const windshield = new THREE.BoxGeometry(0.16, 0.05, 0.02);
    windshield.translate(0, 0.11, 0.218);
    parts.push({ geo: windshield, color: [0.10, 0.14, 0.20] });

    const lightbar = new THREE.BoxGeometry(0.12, 0.02, 0.03);
    lightbar.translate(0, 0.18, 0.12);
    parts.push({ geo: lightbar, color: [2.5, 0.1, 0.1] });

    const headL = new THREE.BoxGeometry(0.028, 0.016, 0.015);
    headL.translate(-0.052, 0.052, 0.222);
    parts.push({ geo: headL, color: [1.8, 1.7, 1.3] });

    const headR = new THREE.BoxGeometry(0.028, 0.016, 0.015);
    headR.translate(0.052, 0.052, 0.222);
    parts.push({ geo: headR, color: [1.8, 1.7, 1.3] });

    const tailL = new THREE.BoxGeometry(0.028, 0.020, 0.015);
    tailL.translate(-0.052, 0.055, -0.222);
    parts.push({ geo: tailL, color: [1.6, 0.15, 0.15] });

    const tailR = new THREE.BoxGeometry(0.028, 0.020, 0.015);
    tailR.translate(0.052, 0.055, -0.222);
    parts.push({ geo: tailR, color: [1.6, 0.15, 0.15] });

    const wFL = createWheel(-0.086, 0.036, 0.14, 0.036, 0.028);
    const wFR = createWheel(0.086, 0.036, 0.14, 0.036, 0.028);
    const wRL = createWheel(-0.086, 0.036, -0.14, 0.036, 0.028);
    const wRR = createWheel(0.086, 0.036, -0.14, 0.036, 0.028);
    [wFL, wFR, wRL, wRR].forEach((w) => parts.push({ geo: w, color: [0.08, 0.08, 0.09] }));
  }

  return mergeVehicleParts(parts);
}
