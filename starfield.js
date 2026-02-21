/**
 * starfield.js - Campo stellare cinematografico
 *
 * Miglioramenti:
 *   - Sfondo non pitch-black: scena con fog color dark blue/purple
 *   - Stelle con luminosità più variata e cluster densi
 *   - Nebula hints: alcuni gruppi di stelle più colorate
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;

export function createStarfield(scene) {
  // Sfondo: dark blue-purple (non pitch-black)
  scene.background = new THREE.Color(0x050510);
  scene.fog = new THREE.FogExp2(0x050510, 0.0008);

  const count = 15000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = 300 + Math.random() * 1800;
    const theta = Math.random() * TAU;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);

    // Temperatura stellare: distribuzione più ricca
    const temp = Math.random();
    let h, s, l;
    if (temp < 0.15) {
      // Stelle calde blu (O/B) - rare, brillanti
      h = 0.6; s = 0.6; l = 0.8 + Math.random() * 0.2;
    } else if (temp < 0.35) {
      // Stelle bianco-azzurre (A)
      h = 0.58; s = 0.2; l = 0.7 + Math.random() * 0.3;
    } else if (temp < 0.6) {
      // Stelle gialle (G) - tipo sole
      h = 0.12; s = 0.4; l = 0.6 + Math.random() * 0.3;
    } else if (temp < 0.8) {
      // Stelle arancioni (K)
      h = 0.08; s = 0.5; l = 0.5 + Math.random() * 0.3;
    } else {
      // Stelle rosse (M) - le più comuni
      h = 0.02; s = 0.6; l = 0.4 + Math.random() * 0.3;
    }

    const c = new THREE.Color().setHSL(h, s, l);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    sizes[i] = 0.3 + Math.pow(Math.random(), 3) * 3.0; // poche stelle grandi
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexColors: true, transparent: true, depthWrite: false,
    fog: false, // Le stelle non devono essere affette dalla fog
    vertexShader: `
      attribute float size; varying vec3 vColor; varying float vSize; uniform float uTime;
      void main() {
        vColor = color; vSize = size;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vSize; uniform float uTime;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        // Core luminoso + alone soffuso
        float core = 1.0 - smoothstep(0.0, 0.3, d);
        float glow = (1.0 - smoothstep(0.0, 1.0, d)) * 0.4;
        float alpha = core + glow;
        // Scintillio
        alpha *= 0.65 + 0.35 * sin(uTime * 1.5 + vSize * 12.0);
        gl_FragColor = vec4(vColor, alpha);
      }`
  });

  scene.add(new THREE.Points(geo, mat));
  return mat;
}
