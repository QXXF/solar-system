/**
 * planets.js – Factory pianeti con shader cinematografici
 *
 * Novità:
 *   - Giove: shader con bande atmosferiche + Grande Macchia Rossa
 *   - Saturno: shader a bande + anello iconico multi-banda luminoso
 *   - Tutti i pianeti hanno emissive fill (lato ombra visibile)
 *   - Atmosfera doppio strato Fresnel sfumata
 */
import * as THREE from 'three';
import { planetTexture, generateTexture } from './textures.js';

const TAU = Math.PI * 2;
export const planets = [];

/* ── Tracce orbitali ── */
function createOrbitLine(scene, radius) {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * TAU;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
    ));
}

/* ══════════════════════════════════════════════════════════════
   ATMOSFERA – doppio strato Fresnel morbido
   ══════════════════════════════════════════════════════════════ */
function createAtmosphere(radius, color) {
    const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) } },
        transparent: true, side: THREE.BackSide, depthWrite: false,
        vertexShader: `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        // Neghiamo la normale perché BackSide mostra le facce posteriori:
        // le normali originali puntano verso l'esterno (via dalla camera)
        // → dot(N, V) sarebbe sempre negativo → rim = 1 → alone solido.
        // Negando otteniamo il comportamento Fresnel corretto.
        vNormal = normalize(-(normalMatrix * normal));
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }`,
        fragmentShader: `
      uniform vec3 uColor; varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float facing = max(dot(vNormal, vViewDir), 0.0);
        float rim = 1.0 - facing;
        // Doppio strato: glow ampio + bordo sottile
        float softGlow = pow(rim, 2.5) * 0.3;
        float sharpEdge = pow(rim, 6.0) * 0.5;
        float alpha = (softGlow + sharpEdge) * 0.5;
        gl_FragColor = vec4(uColor, alpha);
      }`
    });
    return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 32, 32), mat);
}

/* ══════════════════════════════════════════════════════════════
   MATERIALE PIANETA STANDARD – MeshStandardMaterial + emissive
   ══════════════════════════════════════════════════════════════
   Usiamo MeshStandardMaterial di Three.js che gestisce correttamente:
   - Trasformazione normali (normalMatrix)
   - PBR lighting con la PointLight del sole
   - Shadow fill tramite il parametro `emissive`
   
   emissiveIntensity basso (0.08) garantisce che il lato in ombra
   non sia completamente nero ma visivamente distinguibile.
*/
function createPlanetMaterial(tex, emissiveColor) {
    return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.05,
        emissive: new THREE.Color(emissiveColor || '#111118'),
        emissiveMap: tex,
        emissiveIntensity: 0.08
    });
} `
    });
}

/* ══════════════════════════════════════════════════════════════
   GIOVE – Shader bande atmosferiche + Grande Macchia Rossa
   ══════════════════════════════════════════════════════════════
   Bande: si generano variando il colore in base alla latitudine (vUv.y)
     band = sin(uv.y · π · numBande + perturbazione)
   La perturbazione orizzontale crea ondulazioni realistiche.

   Grande Macchia Rossa:
     Distanza da un punto fisso (lon ≈ 0.65, lat ≈ 0.58)
     Sfuma con smoothstep, colore rossastro caldo.
*/
function createJupiterMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSunPos: { value: new THREE.Vector3(0, 0, 0) }
        },
        vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
void main() {
    vUv = uv;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
} `,
        fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunPos;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

void main() {
        float lat = vUv.y;
        float lon = vUv.x;

        // ── Bande atmosferiche ──
        // Perturbazione orizzontale: piccola ondulazione
        float perturb = sin(lon * 20.0 + lat * 5.0) * 0.015
        + sin(lon * 40.0 - lat * 8.0) * 0.008;
        float band = sin((lat + perturb) * 3.14159 * 14.0);

        // Colori: zone chiare (crema) e cinture scure (marrone)
        vec3 lightBand = vec3(0.88, 0.78, 0.60);  // crema
        vec3 darkBand = vec3(0.65, 0.45, 0.28);  // marrone
        vec3 col = mix(darkBand, lightBand, band * 0.5 + 0.5);

    // Variazione longitudinale sottile
    col += sin(lon * 30.0 + lat * 10.0) * 0.03;

        // ── Grande Macchia Rossa ──
        vec2 spotCenter = vec2(0.65, 0.58);
        vec2 spotDelta = vec2(lon - spotCenter.x, (lat - spotCenter.y) * 1.8);
        float spotDist = length(spotDelta);
        float spot = 1.0 - smoothstep(0.02, 0.06, spotDist);
        vec3 spotColor = vec3(0.85, 0.25, 0.12);
    col = mix(col, spotColor, spot * 0.8);

        // Swirl attorno alla macchia
        float swirl = sin(atan(spotDelta.y, spotDelta.x) * 3.0 + spotDist * 60.0) * 0.5 + 0.5;
    col = mix(col, spotColor * 0.7, swirl * spot * 0.3);

        // ── Illuminazione solare ──
        vec3 lightDir = normalize(uSunPos - vWorldPos);
        float NdotL = max(dot(vNormal, lightDir), 0.0);
        vec3 lit = col * NdotL * 1.2;
    lit += col * (1.0 - NdotL) * 0.08;

    gl_FragColor = vec4(lit, 1.0);
} `
    });
}

/* ══════════════════════════════════════════════════════════════
   SATURNO – Shader bande atmosferiche
   ══════════════════════════════════════════════════════════════
   Simile a Giove ma con palette più dorata/sabbia e bande più sottili.
*/
function createSaturnMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uSunPos: { value: new THREE.Vector3(0, 0, 0) }
        },
        vertexShader: `
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorldPos;
void main() {
    vUv = uv;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
} `,
        fragmentShader: `
      uniform vec3 uSunPos;
      varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorldPos;
void main() {
        float lat = vUv.y;
        float lon = vUv.x;
        float perturb = sin(lon * 15.0 + lat * 4.0) * 0.01;
        float band = sin((lat + perturb) * 3.14159 * 18.0);

        vec3 light = vec3(0.92, 0.82, 0.60);
        vec3 dark = vec3(0.75, 0.62, 0.40);
        vec3 col = mix(dark, light, band * 0.5 + 0.5);

    // Polo nord leggermente più scuro
    col *= 1.0 - smoothstep(0.8, 1.0, lat) * 0.2;
    col *= 1.0 - smoothstep(0.0, 0.2, lat) * 0.15;

        vec3 lightDir = normalize(uSunPos - vWorldPos);
        float NdotL = max(dot(vNormal, lightDir), 0.0);
        vec3 lit = col * NdotL * 1.2;
    lit += col * (1.0 - NdotL) * 0.08;
    gl_FragColor = vec4(lit, 1.0);
} `
    });
}

/* ══════════════════════════════════════════════════════════════
   ANELLO SATURNO – Iconico, multi-banda, luminoso
   ══════════════════════════════════════════════════════════════
   Divisione di Cassini (gap scuro a ~70% del raggio).
   Anello B (interno, più luminoso), anello A (esterno, più tenuo).
   Trasparenza variabile → look realistico.
*/
function createSaturnRing(innerR, outerR) {
    const geo = new THREE.RingGeometry(innerR, outerR, 128);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        uv.setXY(i, (Math.sqrt(x * x + z * z) - innerR) / (outerR - innerR), 1);
    }

    const mat = new THREE.ShaderMaterial({
        uniforms: { uSunPos: { value: new THREE.Vector3(0, 0, 0) } },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        vertexShader: `
      varying vec2 vUv; varying vec3 vWorldPos;
void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
} `,
        fragmentShader: `
      uniform vec3 uSunPos;
      varying vec2 vUv;
      varying vec3 vWorldPos;
void main() {
        float t = vUv.x; // 0 = bordo interno, 1 = bordo esterno

        // Colori base dell'anello
        vec3 innerColor = vec3(0.85, 0.75, 0.58);  // B ring, luminoso
        vec3 outerColor = vec3(0.70, 0.62, 0.50);  // A ring, più scuro
        vec3 col = mix(innerColor, outerColor, t);

        // Bande dettagliate
        float bands = sin(t * 120.0) * 0.5 + 0.5;
    bands *= sin(t * 200.0 + 0.5) * 0.3 + 0.7;
    col *= 0.7 + bands * 0.3;

        // ── Divisione di Cassini ── (gap scuro a ~60-65%)
        float cassini = 1.0 - smoothstep(0.57, 0.60, t) * (1.0 - smoothstep(0.63, 0.66, t));
        float alpha = cassini;

    // Sfuma ai bordi estremi
    alpha *= smoothstep(0.0, 0.08, t); // bordo interno
    alpha *= 1.0 - smoothstep(0.92, 1.0, t); // bordo esterno

    // Modulazione bande di opacità
    alpha *= 0.5 + bands * 0.5;

        // Illuminazione base
        vec3 lightDir = normalize(uSunPos - vWorldPos);
        float light = 0.4 + 0.6 * max(dot(vec3(0.0, 1.0, 0.0), lightDir), 0.0);
    col *= light;

    gl_FragColor = vec4(col, alpha * 0.85);
} `
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}

/* ── Anello generico (Urano) ── */
function createRing(innerR, outerR, color, opacity = 0.5) {
    const geo = new THREE.RingGeometry(innerR, outerR, 64);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        uv.setXY(i, (Math.sqrt(x * x + z * z) - innerR) / (outerR - innerR), 1);
    }
    const ringTex = generateTexture(512, (ctx, s) => {
        for (let x = 0; x < s; x++) {
            const t = x / s;
            const a = (Math.sin(t * 60) * .5 + .5) * (Math.sin(t * 120 + 1) * .3 + .7) * (1 - Math.pow(Math.abs(t - .5) * 2, 2));
            ctx.fillStyle = `rgba(${ color[0]}, ${ color[1]}, ${ color[2]}, ${ a * opacity})`;
            ctx.fillRect(x, 0, 1, 1);
        }
    });
    ringTex.rotation = Math.PI / 2;
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity
    }));
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
}

/* ══════════════════════════════════════════════════════════════
   addPlanet – assembla il gruppo pianeta
   ══════════════════════════════════════════════════════════════ */
function addPlanet(scene, cfg) {
    const {
        name, radius, orbitR, speed, rotSpeed, hsl, tilt = 0,
        atmoColor, hasRing, ringInner, ringOuter, ringColor, ringOpacity,
        moons = [], dotColor, customMaterial, isSaturnRing
    } = cfg;

    const group = new THREE.Group();

    // Materiale: custom (Jupiter/Saturn) o standard con emissive fill
    let mat;
    if (customMaterial) {
        mat = customMaterial;
    } else {
        mat = createPlanetMaterial(planetTexture(256, hsl), atmoColor);
    }

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), mat);
    group.add(mesh);

    // Atmosfera su tutti i pianeti
    group.add(createAtmosphere(radius, atmoColor));

    // Anelli
    if (isSaturnRing) {
        group.add(createSaturnRing(ringInner, ringOuter));
    } else if (hasRing) {
        group.add(createRing(ringInner, ringOuter, ringColor, ringOpacity));
    }

    mesh.rotation.z = tilt;
    createOrbitLine(scene, orbitR);

    // Lune
    const moonMeshes = moons.map(m => {
        const mMesh = new THREE.Mesh(
            new THREE.SphereGeometry(m.radius, 24, 24),
            new THREE.MeshStandardMaterial({ color: m.color, roughness: 0.9 })
        );
        group.add(mMesh);
        return { mesh: mMesh, orbitR: m.orbitR, speed: m.speed };
    });

    scene.add(group);
    planets.push({
        name, group, mesh, orbitR, speed, rotSpeed, moonMeshes, radius,
        angle: Math.random() * TAU, dotColor: dotColor || '#aaa',
        hasCustomShader: !!customMaterial
    });
}

/* ══════════════════════════════════════════════════════════════
   DATI PIANETI
   ══════════════════════════════════════════════════════════════ */
export function initPlanets(scene) {
    addPlanet(scene, {
        name: 'Mercury', radius: 0.35, orbitR: 8, speed: 4.15, rotSpeed: 0.004,
        hsl: [30, 20, 50], dotColor: '#a8937e', atmoColor: '#aa8866'
    });

    addPlanet(scene, {
        name: 'Venus', radius: 0.85, orbitR: 13, speed: 1.62, rotSpeed: -0.002,
        hsl: [40, 50, 65], dotColor: '#e8c56d', atmoColor: '#ffcc66'
    });

    addPlanet(scene, {
        name: 'Earth', radius: 1.0, orbitR: 18, speed: 1.0, rotSpeed: 0.01,
        hsl: [210, 60, 45], dotColor: '#4a90d9', atmoColor: '#4499ff',
        moons: [{ radius: 0.25, orbitR: 2.0, speed: 3.0, color: 0xbbbbbb }]
    });

    addPlanet(scene, {
        name: 'Mars', radius: 0.5, orbitR: 25, speed: 0.53, rotSpeed: 0.009,
        hsl: [10, 65, 42], dotColor: '#c1440e', atmoColor: '#dd6633'
    });

    addPlanet(scene, {
        name: 'Jupiter', radius: 2.8, orbitR: 45, speed: 0.084, rotSpeed: 0.02,
        dotColor: '#c88b3a', atmoColor: '#ddaa55', customMaterial: createJupiterMaterial(),
        moons: [
            { radius: 0.2, orbitR: 4.5, speed: 2.5, color: 0xeeddaa },
            { radius: 0.25, orbitR: 5.5, speed: 1.8, color: 0xaabbcc },
            { radius: 0.18, orbitR: 6.5, speed: 1.2, color: 0xccbbaa },
            { radius: 0.3, orbitR: 8.0, speed: 0.8, color: 0xddccbb }
        ]
    });

    addPlanet(scene, {
        name: 'Saturn', radius: 2.2, orbitR: 70, speed: 0.034, rotSpeed: 0.018,
        dotColor: '#d4b87a', atmoColor: '#ccaa66', tilt: 0.46,
        customMaterial: createSaturnMaterial(),
        isSaturnRing: true, ringInner: 3.0, ringOuter: 6.5,
        moons: [
            { radius: 0.35, orbitR: 7.5, speed: 1.6, color: 0xeeddcc },
            { radius: 0.15, orbitR: 8.5, speed: 2.2, color: 0xaabbaa }
        ]
    });

    addPlanet(scene, {
        name: 'Uranus', radius: 1.5, orbitR: 100, speed: 0.012, rotSpeed: 0.012,
        hsl: [180, 45, 60], dotColor: '#7ec8e3', atmoColor: '#66cccc', tilt: 1.71,
        hasRing: true, ringInner: 2.2, ringOuter: 3.2, ringColor: [150, 200, 220], ringOpacity: 0.25
    });

    addPlanet(scene, {
        name: 'Neptune', radius: 1.4, orbitR: 130, speed: 0.006, rotSpeed: 0.011,
        hsl: [220, 60, 45], dotColor: '#3366ff', atmoColor: '#3366ff'
    });
}

/* ── Fascia asteroidi ── */
export function createAsteroidBelt(scene) {
    const count = 1500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, r = 33 + Math.random() * 6;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = (Math.random() - .5) * .8;
        pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const belt = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x887766, size: 0.12, transparent: true, opacity: 0.5,
        sizeAttenuation: true, depthWrite: false
    }));
    scene.add(belt);
    return belt;
}
