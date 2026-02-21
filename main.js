/* ═══════════════════════════════════════════════════════════════════════════
   SOLAR SYSTEM – Demo Three.js
   ═══════════════════════════════════════════════════════════════════════════
   Progetto puramente client-side: HTML + CSS + JS con Three.js via CDN.
   Renderizza il sistema solare con effetti di post-processing (bloom,
   vignette, aberrazione cromatica), stelle animate, anelli, atmosfere e
   fascia asteroidale.

   Struttura del file:
     1. Import e costanti
     2. Loader di progresso
     3. Generatore di texture procedurali
     4. Setup scena / renderer / camera
     5. Starfield (campo stellare)
     6. Sole (shader custom + corona)
     7. Factory pianeti (atmosfera, anelli, lune)
     8. Definizione dati pianeti
     9. Fascia asteroidi
    10. Post-processing (bloom, vignette, chromatic aberration)
    11. Label HTML overlay
    12. Loop di animazione
    13. Gestione resize
   ═════════════════════════════════════════════════════════════════════════ */

// ─── 1. Import e costanti ───────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * TAU = 2π ≈ 6.2832
 * Rappresenta un giro completo (360°) in radianti.
 * Lo usiamo ovunque calcoliamo angoli su orbite circolari:
 *   angolo = (i / N) * TAU   →  divide il cerchio in N parti uguali
 */
const TAU = Math.PI * 2;

/**
 * Interpolazione lineare (lerp):
 *   mix(a, b, t) = a + (b − a) · t
 * Quando t = 0 restituisce `a`, quando t = 1 restituisce `b`.
 * Usata per sfumare colori e valori nelle texture procedurali.
 */
const mix = (a, b, t) => a + (b - a) * t;


// ─── 2. Loader di progresso ─────────────────────────────────────────────────
/**
 * Gestisce la barra di avanzamento nel DOM.
 * - `setProgress(p)` imposta la percentuale (0-100)
 * - `hide()` nasconde il loader con transizione CSS
 *
 * La progressione è simulata: l'asset reale (Three.js) viene caricato
 * dall'import map, ma le texture sono procedurali e istantanee.
 * Usiamo comunque il loader per dare un feedback visivo durante
 * l'inizializzazione della scena (creazione geometrie, shader compiling).
 */
const loaderBar = document.getElementById('loaderBar');
const loaderPct = document.getElementById('loaderPct');

const loader = {
    /** Aggiorna larghezza barra e testo percentuale */
    setProgress(p) {
        const clamped = Math.min(100, Math.max(0, Math.round(p)));
        loaderBar.style.width = clamped + '%';
        loaderPct.textContent = clamped + ' %';
    },
    /** Nasconde l'overlay aggiungendo la classe .hidden (transizione via CSS) */
    hide() {
        document.getElementById('loader').classList.add('hidden');
    }
};

loader.setProgress(5);


// ─── 3. Generatore di texture procedurali ───────────────────────────────────
/**
 * Crea una texture Three.js partendo da un canvas 2D.
 * @param {number} size  - Dimensione quadrata in pixel
 * @param {Function} fn  - Callback (ctx, size) che disegna sul canvas
 * @returns {THREE.CanvasTexture}
 */
function generateTexture(size, fn) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    fn(ctx, size);
    return new THREE.CanvasTexture(c);
}

/**
 * Genera una texture per un pianeta usando rumore pseudo-procedurale.
 *
 * FORMULA DEL RUMORE:
 *   n1 = sin(x · 0.05) · cos(y · 0.07) · 0.5 + 0.5
 *   n2 = sin(x · 0.13 + y · 0.11) · 0.5 + 0.5
 *   n  = mix(n1, n2, 0.5)
 *
 * Spiegazione:
 *   - `sin(x · f)` produce bande ondulate a frequenza f.
 *   - Moltiplicando sin e cos a frequenze diverse si genera un pattern 2D
 *     che imita la turbolenza superficiale (cinture atmosferiche, crateri).
 *   - Il `· 0.5 + 0.5` riporta il risultato da [-1,1] a [0,1].
 *   - Mediando n1 e n2 si ottiene un pattern più complesso.
 *
 * Il valore `n` perturba poi la tinta (H), la saturazione (S) e la
 * luminosità (L) di base del pianeta, creando variazioni cromatiche.
 *
 * @param {number} size       - Dimensione in pixel
 * @param {number[]} baseHSL  - [H (gradi), S (%), L (%)]
 * @param {number} noiseAmt   - Ampiezza della perturbazione (default 0.15)
 */
function planetTexture(size, baseHSL, noiseAmt = .15) {
    return generateTexture(size, (ctx, s) => {
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const i = (y * s + x) * 4; // indice nel buffer RGBA

                // Rumore procedurale composto da due onde sinusoidali
                const n1 = Math.sin(x * .05) * Math.cos(y * .07) * .5 + .5;
                const n2 = Math.sin(x * .13 + y * .11) * .5 + .5;
                const n = mix(n1, n2, .5); // media dei due pattern

                // Perturbazione HSL in base al rumore
                const h = baseHSL[0] + (n - .5) * 20;                             // ±10° di tinta
                const sat = baseHSL[1] + (n - .5) * noiseAmt * 40;                // ±3% saturazione
                const lum = baseHSL[2] + (n - .5) * noiseAmt * 60;                // ±4.5% luminosità

                // Conversione HSL → RGB tramite Three.js
                const c = new THREE.Color().setHSL(
                    h / 360,
                    Math.max(0, Math.min(1, sat / 100)),
                    Math.max(0, Math.min(1, lum / 100))
                );
                img.data[i] = c.r * 255;
                img.data[i + 1] = c.g * 255;
                img.data[i + 2] = c.b * 255;
                img.data[i + 3] = 255; // opacità piena
            }
        }
        ctx.putImageData(img, 0, 0);
    });
}

/**
 * Genera la texture del sole con gradiente radiale e perturbazione.
 *
 * FORMULA:
 *   cx, cy  = (x / size − 0.5), (y / size − 0.5)   →  coordinate centrate [-0.5, 0.5]
 *   d       = √(cx² + cy²) · 2                      →  distanza dal centro [0, ~1.41]
 *   n       = sin(x·0.08 + y·0.06) · cos(y·0.1 − x·0.04) · 0.5 + 0.5
 *
 *   R = mix(255, 200, d) + n · 40    →  bianco al centro, arancione ai bordi
 *   G = mix(200,  80, d·1.2) + n·30  →  scurisce più rapidamente (×1.2)
 *   B = mix( 50,   0, d) + n · 10    →  quasi assente, dà il tono caldo
 *
 * Risultato: un disco con nucleo bianco-giallo che sfuma verso
 * l'arancione/rosso ai bordi, con granularità superficiale data da `n`.
 */
function sunTexture(size) {
    return generateTexture(size, (ctx, s) => {
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const i = (y * s + x) * 4;
                const cx = x / s - .5, cy = y / s - .5;
                const d = Math.sqrt(cx * cx + cy * cy) * 2;
                const n = Math.sin(x * .08 + y * .06) * Math.cos(y * .1 - x * .04) * .5 + .5;
                const r = mix(255, 200, d) + n * 40;
                const g = mix(200, 80, d * 1.2) + n * 30;
                const b = mix(50, 0, d) + n * 10;
                img.data[i] = Math.min(255, r);
                img.data[i + 1] = Math.min(255, g);
                img.data[i + 2] = Math.min(255, Math.max(0, b));
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    });
}

loader.setProgress(15);


// ─── 4. Setup scena / renderer / camera ─────────────────────────────────────
/**
 * WebGLRenderer con antialiasing e ACES Filmic tone mapping.
 *
 * ACES (Academy Color Encoding System) è una curva di tone mapping
 * usata nel cinema per comprimere l'high dynamic range (HDR) in valori
 * visualizzabili. La formula approssimata è:
 *   f(x) = (x · (2.51x + 0.03)) / (x · (2.43x + 0.59) + 0.14)
 * Produce neri profondi, highlight morbidi e colori più cinematografici.
 *
 * pixelRatio è limitato a 2 per bilanciare qualità e performance su
 * schermi HiDPI (Retina): oltre 2× il guadagno visivo è trascurabile
 * ma il costo GPU quadruplica.
 */
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

/**
 * Camera prospettica con FOV 55°.
 * - near = 0.1, far = 5000: range ampio per contenere sia i pianeti
 *   vicini sia lo starfield a ≈2000 unità.
 * - Posizione iniziale (30, 20, 50): visione obliqua a ~60 unità dal
 *   sole, abbastanza lontana da inquadrare i pianeti interni.
 */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 5000
);
camera.position.set(30, 20, 50);

/**
 * OrbitControls – permette rotazione (click+drag), pan (click destro)
 * e zoom (scroll).
 * - damping: smorzamento inerziale, rende il movimento più fluido.
 * - autoRotate: la scena ruota lentamente da sola (0.15 °/s).
 */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
controls.maxDistance = 300;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15;

loader.setProgress(25);


// ─── 5. Luci ────────────────────────────────────────────────────────────────
/**
 * Ambient light molto debole (0x111122): illumina debolmente il lato
 * in ombra dei pianeti, evitando che sia completamente nero.
 *
 * PointLight al centro (posizione del sole):
 *   - colore 0xfff0dd: bianco leggermente caldo
 *   - intensità 2.5
 *   - distanza 500: raggio di influenza
 *   - decay 0.6: attenuazione con la distanza secondo la formula
 *       I = intensità / (distanza ^ decay)
 *     Con decay < 1 la luce raggiunge anche i pianeti lontani.
 */
const ambientLight = new THREE.AmbientLight(0x111122, 0.3);
scene.add(ambientLight);

const sunLight = new THREE.PointLight(0xfff0dd, 2.5, 500, 0.6);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);


// ─── 6. Starfield (campo stellare) ──────────────────────────────────────────
/**
 * Crea 12.000 stelle distribuite su una sfera di raggio [400, 2000].
 *
 * DISTRIBUZIONE UNIFORME SULLA SFERA:
 *   θ = random() · 2π                  →  longitudine uniforme
 *   φ = acos(2 · random() − 1)         →  latitudine con distribuzione
 *                                          uniforme in area (non in angolo)
 *
 * La formula `acos(2·rand−1)` è fondamentale: se usassimo `rand·π` le
 * stelle si concentrerebbero ai poli. La trasformazione inverte la CDF
 * (Cumulative Distribution Function) di cos(φ), garantendo densità
 * uniforme sulla superficie sferica.
 *
 * Conversione sferica → cartesiana:
 *   x = r · sin(φ) · cos(θ)
 *   y = r · sin(φ) · sin(θ)
 *   z = r · cos(φ)
 *
 * COLORE DELLE STELLE – classificazione stellare semplificata:
 *   - 30% blu-azzurre (stelle O/B, H ≈ 0.6, alta saturazione)
 *   - 30% giallastre  (stelle G/K, H ≈ 0.1)
 *   - 40% bianche     (stelle A/F, H ≈ 0)
 *
 * SCINTILLIO (twinkling) nel fragment shader:
 *   alpha *= 0.7 + 0.3 · sin(time · 2.0 + size · 10.0)
 *   Ogni stella oscilla tra 70% e 100% di opacità a una fase
 *   diversa (dipendente dalla sua dimensione), simulando il
 *   fenomeno di scintillazione atmosferica.
 *
 * DIMENSIONE PROSPETTICA nel vertex shader:
 *   gl_PointSize = size · (200.0 / −mv.z)
 *   Riduce la dimensione del punto con la distanza dalla camera
 *   (mv.z è negativo in view space, da cui il segno meno).
 */
function createStarfield() {
    const count = 12000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Raggio casuale tra 400 e 2000
        const r = 400 + Math.random() * 1600;

        // Coordinate sferiche con distribuzione uniforme
        const theta = Math.random() * TAU;
        const phi = Math.acos(2 * Math.random() - 1);

        // Conversione sferica → cartesiana
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);

        // Colore basato sulla "temperatura" stellare
        const temp = Math.random();
        const c = new THREE.Color().setHSL(
            temp < .3 ? .6 : temp < .6 ? .1 : 0,   // H: blu / giallo / bianco
            temp < .3 ? .5 : .2,                     // S: più satura per le blu
            .7 + Math.random() * .3                  // L: luminosità 70–100%
        );
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;

        sizes[i] = .5 + Math.random() * 1.5; // dimensione punto
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        vertexShader: `
      attribute float size;
      varying vec3 vColor;
      varying float vSize;
      uniform float uTime;
      void main() {
        vColor = color;
        vSize = size;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Dimensione inversamente proporzionale alla distanza
        gl_PointSize = size * (200.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      varying float vSize;
      uniform float uTime;
      void main() {
        // Disco morbido: distanza dal centro del point sprite [0, 1]
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = 1.0 - smoothstep(0.0, 1.0, d);
        // Twinkling: oscillazione sinusoidale con fase per-stella
        alpha *= 0.7 + 0.3 * sin(uTime * 2.0 + vSize * 10.0);
        gl_FragColor = vec4(vColor, alpha);
      }
    `
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return mat;
}

const starMaterial = createStarfield();

loader.setProgress(40);


// ─── 7. Sole ────────────────────────────────────────────────────────────────
/**
 * Il sole usa uno shader custom per ottenere un aspetto "vivo":
 *
 * VERTEX SHADER – deformazione superficiale:
 *   pos += normal · sin(pos.x · 4 + t) · cos(pos.y · 4 + t · 0.7) · 0.05
 *
 *   Sposta ogni vertice lungo la sua normale di una quantità che
 *   varia sinusoidalmente nello spazio e nel tempo. Questo crea
 *   un effetto di "ribollimento" sulla superficie, come i granuli
 *   della fotosfera solare.
 *
 * FRAGMENT SHADER – distorsione UV animata:
 *   uv.x += sin(uv.y · 10 + t · 0.5) · 0.015
 *   uv.y += cos(uv.x · 8 + t · 0.3) · 0.015
 *
 *   Deforma le coordinate della texture in modo oscillante, creando
 *   un effetto di plasma/convezione. L'ampiezza 0.015 è piccola
 *   abbastanza da non stravolgere la texture ma sufficiente per
 *   dare vita alla superficie.
 *
 * EFFETTO FRESNEL (bordo luminoso):
 *   fresnel = 1 − dot(N, V)
 *   La dot product tra la normale e la direzione di vista è ≈1 al
 *   centro del disco e ≈0 ai bordi. Invertendo (1−dot) otteniamo
 *   un valore forte ai bordi: elevato alla terza potenza (pow³)
 *   crea un alone arancione-rosso concentrato sul limbo, simulando
 *   la cromosfera solare.
 *
 * PULSAZIONE:
 *   pulse = 0.9 + 0.1 · sin(t · 2)
 *   Una leggera oscillazione di luminosità complessiva (±10%).
 */
const sunGeo = new THREE.SphereGeometry(3, 64, 64);
const sunMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uTexture: { value: sunTexture(512) }
    },
    vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    uniform float uTime;
    void main() {
      vUv = uv;
      vNormal = normal;
      vec3 pos = position;
      // Deformazione "ribollimento" lungo la normale
      pos += normal * sin(pos.x * 4.0 + uTime)
                     * cos(pos.y * 4.0 + uTime * 0.7) * 0.05;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    fragmentShader: `
    uniform float uTime;
    uniform sampler2D uTexture;
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      // Distorsione UV animata (effetto plasma)
      vec2 uv = vUv;
      uv.x += sin(uv.y * 10.0 + uTime * 0.5) * 0.015;
      uv.y += cos(uv.x * 8.0  + uTime * 0.3) * 0.015;

      vec4 tex = texture2D(uTexture, uv);

      // Pulsazione luminosa
      float pulse = 0.9 + 0.1 * sin(uTime * 2.0);
      vec3 col = tex.rgb * vec3(1.3, 0.95, 0.5) * pulse;

      // Fresnel: bordo arancione (cromosfera)
      float fresnel = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
      col += vec3(1.0, 0.3, 0.0) * pow(fresnel, 3.0) * 0.6;

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
scene.add(sunMesh);

/**
 * CORONA SOLARE – sfera leggermente più grande (r=4.2 vs r=3) renderizzata
 * solo dalla faccia interna (BackSide), con shader trasparente.
 *
 * L'effetto si basa sullo stesso principio Fresnel della superficie:
 *   intensity = pow(0.7 − dot(N, V), 2.5)
 * Ma usando BackSide + trasparenza, il glow è visibile solo quando
 * si guarda "attraverso" il bordo della sfera esterna, creando un
 * alone luminoso attorno al sole.
 *
 * Flicker aggiunge leggere variazioni temporali che simulano l'attività
 * coronale (espulsioni di massa, flare).
 */
const coronaGeo = new THREE.SphereGeometry(4.2, 32, 32);
const coronaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewPos = mvPos.xyz;
      gl_Position = projectionMatrix * mvPos;
    }
  `,
    fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewPos;
    uniform float uTime;
    void main() {
      // Fresnel invertito (BackSide → normali invertite)
      float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
      // Variazioni temporali per simulare flare
      float flicker = 0.85 + 0.15 * sin(uTime * 3.0 + vViewPos.x * 2.0);
      vec3 col = mix(
        vec3(1.0, 0.6, 0.0),   // giallo-arancione
        vec3(1.0, 0.2, 0.0),   // rosso-arancione
        intensity
      ) * flicker;
      gl_FragColor = vec4(col, intensity * 0.6);
    }
  `
});
const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
scene.add(coronaMesh);

loader.setProgress(55);


// ─── 8. Factory pianeti ─────────────────────────────────────────────────────
const planets = [];

/**
 * Disegna una linea circolare di raggio `radius` sul piano XZ.
 * Serve come traccia orbitale visiva.
 *
 * FORMULA: per ogni segmento i su N:
 *   x = cos((i/N) · 2π) · r
 *   z = sin((i/N) · 2π) · r
 *   y = 0
 */
function createOrbitLine(radius) {
    const segments = 128;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * TAU;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.06
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    return line;
}

/**
 * Crea un guscio atmosferico attorno a un pianeta usando l'effetto Fresnel.
 *
 * PRINCIPIO: una sfera leggermente più grande del pianeta (×1.08),
 * renderizzata solo dall'interno (BackSide), con opacità che cresce
 * al bordo grazie alla formula:
 *
 *   intensity = pow(0.65 − dot(N, V), 4.0)
 *
 * dove:
 *   N = normale alla superficie (in view space)
 *   V = (0, 0, 1) = direzione della camera (approssimata)
 *
 * dot(N, V) ≈ 1 al centro → intensity ≈ 0 (trasparente)
 * dot(N, V) ≈ 0 ai bordi  → intensity alta (alone colorato)
 *
 * L'esponente 4.0 concentra l'alone su una fascia sottile al bordo.
 *
 * @param {number} radius  - Raggio del pianeta
 * @param {string} color   - Colore dell'atmosfera (es. '#4499ff')
 */
function createAtmosphere(radius, color) {
    const geo = new THREE.SphereGeometry(radius * 1.08, 32, 32);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) } },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
        gl_FragColor = vec4(uColor, intensity * 0.55);
      }
    `
    });
    return new THREE.Mesh(geo, mat);
}

/**
 * Crea un anello planetario (es. Saturno) con texture procedurale a bande.
 *
 * TEXTURE A BANDE:
 * Per ogni pixel x (0..511) lungo la larghezza:
 *   t     = x / 512                             →  posizione normalizzata [0,1]
 *   band  = sin(t · 60) · 0.5 + 0.5             →  ~30 bande concentriche
 *   gap   = sin(t · 120 + 1) · 0.3 + 0.7        →  variazione di gap (divisioni)
 *   fade  = 1 − |t − 0.5|² · 4                  →  sfuma ai bordi interno/esterno
 *   alpha = band · gap · fade · opacità base
 *
 * UV REMAPPING:
 * Le UV del RingGeometry vengono ridistribuite in modo che U rappresenti
 * la distanza radiale normalizzata: (distanza − rInterno) / (rEsterno − rInterno).
 * Questo permette alla texture 1D (le bande) di mapparsi correttamente sui cerchi.
 *
 * @param {number} innerR    - Raggio interno dell'anello
 * @param {number} outerR    - Raggio esterno
 * @param {number[]} color   - [R, G, B] 0–255
 * @param {number} opacity   - Opacità complessiva
 */
function createRing(innerR, outerR, color, opacity = 0.5) {
    const geo = new THREE.RingGeometry(innerR, outerR, 64);

    // Remapping delle UV: U = distanza radiale normalizzata
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const len = Math.sqrt(x * x + z * z);
        uv.setXY(i, (len - innerR) / (outerR - innerR), 1);
    }

    // Texture procedurale con pattern a bande concentriche
    const ringTex = generateTexture(512, (ctx, s) => {
        for (let x = 0; x < s; x++) {
            const t = x / s;
            const band = Math.sin(t * 60) * .5 + .5;         // ~30 bande
            const gap = Math.sin(t * 120 + 1) * .3 + .7;     // gap tra le bande
            const fade = 1 - Math.pow(Math.abs(t - .5) * 2, 2); // sfuma ai bordi
            const alpha = band * gap * fade;
            ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * opacity})`;
            ctx.fillRect(x, 0, 1, 1);
        }
    });
    ringTex.rotation = Math.PI / 2;

    const mat = new THREE.MeshStandardMaterial({
        map: ringTex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        opacity: opacity
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2; // Ruota per sdraiarsi sul piano XZ
    return mesh;
}

/**
 * Crea un pianeta completo e lo aggiunge alla scena.
 *
 * STRUTTURA:
 *   Group (orbita)
 *     ├── Mesh (corpo del pianeta)
 *     ├── [Mesh atmosfera]  – opzionale
 *     ├── [Mesh anello]     – opzionale
 *     └── [Mesh lune ×N]    – opzionali
 *
 * L'intero Group viene posizionato lungo l'orbita nel loop di animazione.
 */
function addPlanet(cfg) {
    const {
        name, radius, orbitR, speed, rotSpeed, hsl, tilt = 0,
        hasAtmo, atmoColor, hasRing, ringInner, ringOuter, ringColor, ringOpacity,
        moons = []
    } = cfg;

    const group = new THREE.Group();
    const tex = planetTexture(256, hsl);
    const geo = new THREE.SphereGeometry(radius, 48, 48);
    const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    if (hasAtmo) group.add(createAtmosphere(radius, atmoColor));
    if (hasRing) group.add(createRing(ringInner, ringOuter, ringColor, ringOpacity));

    // Inclinazione assiale (es. Urano ≈ 98° = 1.71 rad)
    mesh.rotation.z = tilt;

    // Traccia orbitale visiva
    createOrbitLine(orbitR);

    // Lune
    const moonMeshes = moons.map(m => {
        const mGeo = new THREE.SphereGeometry(m.radius, 24, 24);
        const mMat = new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.9 });
        const mMesh = new THREE.Mesh(mGeo, mMat);
        group.add(mMesh);
        return { mesh: mMesh, orbitR: m.orbitR, speed: m.speed };
    });

    scene.add(group);
    planets.push({
        name, group, mesh, orbitR, speed, rotSpeed, moonMeshes,
        angle: Math.random() * TAU  // angolo iniziale casuale
    });
}


// ─── 9. Definizione dati pianeti ────────────────────────────────────────────
/**
 * Velocità orbitale (speed):
 *   Valori relativi alla Terra (= 1.0). Più il pianeta è lontano dal sole
 *   più lento orbita, seguendo approssimativamente la terza legge di Keplero:
 *     T² ∝ a³  (T = periodo, a = semiasse maggiore)
 *   I valori sono accelerati per l'effetto visivo.
 *
 * Raggio orbitale (orbitR):
 *   Le distanze sono compresse rispetto alla realtà (dove Nettuno è ~30×
 *   la distanza Terra-Sole) per mantenere tutto visibile su schermo.
 *
 * HSL [H°, S%, L%]:
 *   Colore di base del pianeta, perturbato dalla texture procedurale.
 *
 * Tilt (radianti):
 *   Inclinazione assiale reale: Saturno ≈ 26.7° ≈ 0.46 rad,
 *   Urano ≈ 97.8° ≈ 1.71 rad (ruota quasi "sdraiato").
 */

addPlanet({
    name: 'Mercurio', radius: 0.4, orbitR: 7, speed: 4.15, rotSpeed: 0.004,
    hsl: [30, 20, 50]
});

addPlanet({
    name: 'Venere', radius: 0.9, orbitR: 10, speed: 1.62, rotSpeed: -0.002,
    hsl: [40, 50, 65], hasAtmo: true, atmoColor: '#ffcc66'
});

addPlanet({
    name: 'Terra', radius: 1.0, orbitR: 14, speed: 1.0, rotSpeed: 0.01,
    hsl: [210, 60, 45], hasAtmo: true, atmoColor: '#4499ff',
    moons: [{ radius: 0.25, orbitR: 2.0, speed: 3.0, color: 0xbbbbbb }]
});

addPlanet({
    name: 'Marte', radius: 0.55, orbitR: 18, speed: 0.53, rotSpeed: 0.009,
    hsl: [10, 65, 42], hasAtmo: true, atmoColor: '#dd6633'
});

addPlanet({
    name: 'Giove', radius: 2.5, orbitR: 28, speed: 0.084, rotSpeed: 0.02,
    hsl: [30, 45, 55],
    moons: [
        { radius: 0.2, orbitR: 4.0, speed: 2.5, color: 0xeeddaa },  // Io
        { radius: 0.25, orbitR: 5.0, speed: 1.8, color: 0xaabbcc },  // Europa
        { radius: 0.18, orbitR: 6.0, speed: 1.2, color: 0xccbbaa },  // Ganimede
        { radius: 0.3, orbitR: 7.5, speed: 0.8, color: 0xddccbb }   // Callisto
    ]
});

addPlanet({
    name: 'Saturno', radius: 2.0, orbitR: 40, speed: 0.034, rotSpeed: 0.018,
    hsl: [42, 40, 62], tilt: 0.46,
    hasRing: true, ringInner: 2.8, ringOuter: 4.8,
    ringColor: [210, 190, 160], ringOpacity: 0.6,
    moons: [
        { radius: 0.35, orbitR: 5.5, speed: 1.6, color: 0xeeddcc },  // Titano
        { radius: 0.15, orbitR: 6.5, speed: 2.2, color: 0xaabbaa }   // Rea
    ]
});

addPlanet({
    name: 'Urano', radius: 1.4, orbitR: 54, speed: 0.012, rotSpeed: 0.012,
    hsl: [180, 45, 60], tilt: 1.71,
    hasRing: true, ringInner: 2.0, ringOuter: 3.0,
    ringColor: [150, 200, 220], ringOpacity: 0.25,
    hasAtmo: true, atmoColor: '#66cccc'
});

addPlanet({
    name: 'Nettuno', radius: 1.3, orbitR: 66, speed: 0.006, rotSpeed: 0.011,
    hsl: [220, 60, 45],
    hasAtmo: true, atmoColor: '#3366ff'
});

loader.setProgress(70);


// ─── 10. Fascia asteroidi ───────────────────────────────────────────────────
/**
 * 1500 particelle distribuite casualmente in un toro (ciambella) tra
 * Marte (orbitR=18) e Giove (orbitR=28), cioè r ∈ [22, 26].
 *
 * DISTRIBUZIONE:
 *   angolo  = random() · 2π         →  posizione angolare casuale
 *   r       = 22 + random() · 4     →  raggio tra 22 e 26
 *   y       = (random() − 0.5) · 0.8 → dispersione verticale sottile
 *   x       = cos(angolo) · r
 *   z       = sin(angolo) · r
 *
 * La fascia ruota lentamente nel loop (0.0001 rad/frame).
 */
function createAsteroidBelt() {
    const count = 1500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * TAU;
        const r = 22 + Math.random() * 4;
        const y = (Math.random() - .5) * 0.8;

        pos[i * 3] = Math.cos(angle) * r;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = Math.sin(angle) * r;
        sizes[i] = 0.05 + Math.random() * 0.15;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
        color: 0x887766,
        size: 0.12,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        depthWrite: false
    });
    const belt = new THREE.Points(geo, mat);
    scene.add(belt);
    return belt;
}

const asteroidBelt = createAsteroidBelt();

loader.setProgress(80);


// ─── 11. Post-processing ────────────────────────────────────────────────────
/**
 * PIPELINE DI POST-PROCESSING (ordine dei pass):
 *
 * 1. RenderPass – renderizza la scena 3D nel framebuffer.
 *
 * 2. UnrealBloomPass – effetto "god rays" / glow:
 *    Simula la diffusione della luce nell'obiettivo fotografico.
 *    Internamente applica un threshold (soglia di luminosità),
 *    poi sfoca iterativamente con blur gaussiano a varie risoluzioni
 *    (mip chain), infine somma il risultato al render originale.
 *    Parametri:
 *      - strength  = 1.4  → intensità del bagliore
 *      - radius    = 0.6  → estensione della diffusione
 *      - threshold = 0.4  → solo pixel con luminanza > 0.4 brillano
 *    Il sole, essendo molto luminoso (emissivo), supera ampiamente
 *    la soglia e produce un halo esteso.
 *
 * 3. Vignette + Chromatic Aberration (shader custom):
 *
 *    VIGNETTE:
 *      dist = length(uv − 0.5)                →  distanza dal centro
 *      col *= 1 − dist² · intensity            →  scurisce i bordi
 *      Con intensity = 0.85, i bordi perdono ~20% di luminosità.
 *
 *    ABERRAZIONE CROMATICA:
 *      r = texture(tDiffuse, uv + centro · offset).r
 *      g = texture(tDiffuse, uv).g
 *      b = texture(tDiffuse, uv − centro · offset).b
 *
 *      I tre canali (R, G, B) vengono campionati a posizioni UV
 *      leggermente diverse, proporzionali alla distanza dal centro.
 *      Questo separa i colori ai bordi dell'immagine, simulando
 *      il difetto ottico delle lenti reali. L'offset 0.0012 è
 *      molto sottile, visibile solo ai bordi estremi.
 */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.4,    // strength – intensità
    0.6,    // radius   – estensione
    0.4     // threshold – soglia di luminanza
);
composer.addPass(bloomPass);

// Shader custom: vignette + aberrazione cromatica
const vignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        uIntensity: { value: 0.85 },
        uAberation: { value: 0.0012 }
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uAberation;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float dist = length(center);

      // Aberrazione cromatica: separa R/G/B ai bordi
      float r = texture2D(tDiffuse, uv + center * uAberation).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - center * uAberation).b;
      vec3 col = vec3(r, g, b);

      // Vignette: scurisce proporzionalmente a dist²
      col *= 1.0 - dist * dist * uIntensity;

      gl_FragColor = vec4(col, 1.0);
    }
  `
};
composer.addPass(new ShaderPass(vignetteShader));

loader.setProgress(90);


// ─── 12. Label HTML overlay ─────────────────────────────────────────────────
/**
 * Per ogni pianeta, un <div> flottante viene posizionato sopra di esso
 * usando la proiezione 3D → 2D della camera.
 *
 * PROIEZIONE:
 *   1. pos.project(camera)  →  coordinate NDC (Normalized Device Coordinates)
 *      dove x, y ∈ [−1, 1] e z ∈ [0, 1] (0 = near, 1 = far).
 *
 *   2. Conversione NDC → pixel dello schermo:
 *      screenX = pos.x · (width / 2) + (width / 2)
 *      screenY = −pos.y · (height / 2) + (height / 2)
 *      (Y invertito perché in NDC y punta in alto, in CSS punta in basso)
 *
 *   3. Se pos.z > 1 il punto è dietro la camera → nascondere il label.
 *
 * OPACITÀ basata sulla distanza:
 *   Clamp(1 − dist/200, 0.1, 0.7)
 *   I pianeti lontani hanno label più trasparenti per ridurre il clutter.
 */
const labelContainer = document.createElement('div');
labelContainer.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:10;overflow:hidden;';
document.body.appendChild(labelContainer);

const labels = planets.map(p => {
    const el = document.createElement('div');
    el.textContent = p.name;
    el.style.cssText = `
    position:absolute;
    font-family:'Inter','Segoe UI',sans-serif;
    font-size:11px;
    color:rgba(255,255,255,0.6);
    letter-spacing:1px;
    text-transform:uppercase;
    transform:translate(-50%,-100%);
    padding-bottom:4px;
    white-space:nowrap;
    text-shadow: 0 0 8px rgba(0,0,0,.9);
    transition: opacity .3s;
  `;
    labelContainer.appendChild(el);
    return { el, planet: p };
});

/** Aggiorna posizione e opacità di tutti i label a ogni frame */
function updateLabels() {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    labels.forEach(({ el, planet }) => {
        const pos = new THREE.Vector3();
        planet.group.getWorldPosition(pos);
        pos.project(camera);

        // Dietro la camera → nascosto
        if (pos.z > 1) { el.style.opacity = '0'; return; }

        // NDC → pixel
        el.style.left = (pos.x * halfW + halfW) + 'px';
        el.style.top = (-pos.y * halfH + halfH - 10) + 'px';

        // Opacità inversamente proporzionale alla distanza
        const dist = camera.position.distanceTo(planet.group.position);
        const opacity = THREE.MathUtils.clamp(1 - dist / 200, 0.1, 0.7);
        el.style.opacity = String(opacity);
    });
}


// ─── 13. Loop di animazione ─────────────────────────────────────────────────
/**
 * Ciclo RAF (requestAnimationFrame) – eseguito ad ogni frame del monitor.
 *
 * ORBITA PLANETARIA:
 *   p.angle += p.speed · 0.004
 *   x = cos(angle) · orbitR
 *   z = sin(angle) · orbitR
 *
 *   Il moto è circolare uniforme sul piano XZ.
 *   cos(θ) e sin(θ) parametrizzano un cerchio di raggio orbitR.
 *   L'incremento angolare per frame è proporzionale a `speed`.
 *   0.004 è un fattore di scala globale per rallentare il moto.
 *
 * ROTAZIONE ASSIALE:
 *   mesh.rotation.y += rotSpeed
 *   Ogni pianeta ruota attorno al proprio asse Y.
 *
 * ORBITA LUNARE:
 *   x = cos(t · speed) · orbitR
 *   z = sin(t · speed) · orbitR
 *   y = sin(t · speed · 0.3) · 0.15
 *
 *   Le lune usano il tempo assoluto `t` (non un angolo cumulativo)
 *   per evitare desincronizzazioni. L'oscillazione in Y (ampiezza 0.15)
 *   dà una lieve inclinazione orbitale visiva.
 */
const clock = new THREE.Clock();

loader.setProgress(100);

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // ── Aggiorna sole ──
    sunMat.uniforms.uTime.value = t;
    coronaMat.uniforms.uTime.value = t;
    sunMesh.rotation.y = t * 0.1;

    // ── Twinkling stelle ──
    starMaterial.uniforms.uTime.value = t;

    // ── Orbita e rotazione pianeti ──
    planets.forEach(p => {
        // Avanzamento angolo orbitale
        p.angle += p.speed * 0.004;

        // Posizione sul cerchio orbitale
        p.group.position.x = Math.cos(p.angle) * p.orbitR;
        p.group.position.z = Math.sin(p.angle) * p.orbitR;

        // Rotazione assiale
        p.mesh.rotation.y += p.rotSpeed;

        // Orbite lunari
        p.moonMeshes.forEach(m => {
            const ma = t * m.speed;
            m.mesh.position.x = Math.cos(ma) * m.orbitR;
            m.mesh.position.z = Math.sin(ma) * m.orbitR;
            m.mesh.position.y = Math.sin(ma * 0.3) * 0.15; // leggera inclinazione
        });
    });

    // ── Rotazione lenta della fascia asteroidi ──
    asteroidBelt.rotation.y += 0.0001;

    // ── Update controlli e render con post-processing ──
    controls.update();
    updateLabels();
    composer.render();
}

// Piccolo delay per far vedere la barra al 100% prima di nasconderla
setTimeout(() => {
    loader.hide();
    animate();
}, 400);


// ─── 14. Gestione resize ────────────────────────────────────────────────────
/**
 * Al ridimensionamento della finestra aggiorna:
 *   - aspect ratio della camera (larghezza / altezza)
 *   - dimensione del renderer
 *   - dimensione del composer (post-processing)
 *   - risoluzione del bloom pass
 */
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});
