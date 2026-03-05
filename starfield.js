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

export function createMilkyWay(scene) {
  // Sfera gigante che fa da vero e proprio "background" stellare profondo
  const geo = new THREE.SphereGeometry(4500, 64, 64);

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,       // Renderizza l'interno della sfera
    transparent: true,          // Permette di fondersi con il background della scena
    depthWrite: false,          // Non deve coprire i pianeti o le particelle
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform float uTime;

      // Un semplice hash 3D per generare il rumore procedurale
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      // Value noise 3D di base
      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }

      // Fractional Brownian Motion (fbm) per dettagli a piú ottave (le "nubi")
      float fbm(vec3 p) {
        float f = 0.0;
        float amp = 0.5;
        for(int i = 0; i < 4; i++) {
          f += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return f;
      }

      void main() {
        vec3 dir = normalize(vPos);
        
        // 1. Inclinazione realistica rispetto all'eclittica del sistema solare (~60 gradi)
        float angle = 1.05; // ~60 gradi in radianti
        float s = sin(angle), c = cos(angle);
        // Ruotiamo la direzione asse Z attorno all'asse X
        vec3 rotDir = vec3(dir.x, dir.y * c - dir.z * s, dir.y * s + dir.z * c);

        // 2. Banda galattica - Molto morbida, senza margini netti
        float distFromEquator = abs(rotDir.y);
        float bandBase = smoothstep(0.45, 0.0, distFromEquator); // Halo diafano primario
        float bandCore = smoothstep(0.15, 0.0, distFromEquator); // Nube centrale densa
        float band = bandBase * 0.6 + bandCore * 0.4;
        
        // 3. Modulazione delle Nubi Stellari (gas e miliardi di stelle irrisolte)
        float n1 = fbm(rotDir * 3.5);
        float n2 = fbm(rotDir * 12.0);
        
        // Moltiplichiamo il disturbo per la banda per mantenerlo nel "disco"
        float starlight = (n1 * 0.6 + n2 * 0.4) * band;
        starlight = smoothstep(0.15, 0.8, starlight); // Aumenta contrasto tenue

        // 4. Polveri Oscure (Dust Lanes) - Rami oscuri complessi
        float dust = fbm(rotDir * 6.0 + vec3(1.2, 3.4, 5.6));
        float dustMask = smoothstep(0.35, 0.65, dust);
        
        // Le polveri erodono la luce stellare principalmente nel core
        starlight *= (1.0 - dustMask * 0.85 * bandCore);

        // 5. Palette Colori Realistica Cosmica! Niente giallo o nero piatto
        // Sfumature: Spazio infinito bluastro -> Argento-Bluastro -> Bianco Opale
        vec3 colorEdge = vec3(0.02, 0.03, 0.05); // Bordo appena distinguibile
        vec3 colorMid = vec3(0.08, 0.12, 0.18);  // Corpo galattico silver-blu
        vec3 colorCore = vec3(0.22, 0.28, 0.35); // Core luminoso
        
        vec3 finalColor = mix(colorEdge, colorMid, starlight);
        finalColor = mix(finalColor, colorCore, pow(starlight, 2.0));
        
        // Cuore lievemente più caldo e dorato/crema ma *molto* delicato
        finalColor += vec3(0.15, 0.12, 0.08) * smoothstep(0.7, 1.0, starlight);

        // 6. Micro-stelle finissime aggiunte sopra il gas
        float starNoise = hash(rotDir * 600.0);
        float tinyStars = step(0.997, starNoise) * bandBase;
        finalColor += tinyStars * vec3(0.6, 0.7, 1.0) * (1.0 - dustMask);

        // 7. Alpha (trasparenza)
        float alpha = starlight * 0.7 + tinyStars * 0.5;
        alpha = clamp(alpha, 0.0, 1.0);
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);

  // CRITICO: Forza the render engine a disegnare questa sfera gigantesca PER PRIMA.
  // Essendo transparente, eviterà di alterare i calcoli di fusione colore dei pianeti.
  mesh.renderOrder = -99;

  scene.add(mesh);

  return { mesh, mat };
}
