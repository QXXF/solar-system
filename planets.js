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

        // ── Illuminazione solare (calibrata con MeshStandardMaterial) ──
        vec3 lightDir = normalize(uSunPos - vWorldPos);
        float NdotL = max(dot(vNormal, lightDir), 0.0);
        vec3 lit = col * (NdotL * 0.8 + 0.12);

    gl_FragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
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
        vec3 lit = col * (NdotL * 0.8 + 0.12);
    gl_FragColor = vec4(clamp(lit, 0.0, 1.0), 1.0);
} `
    });
}

/* ══════════════════════════════════════════════════════════════
   ANELLO SATURNO – Iconico, multi-banda, luminoso
   ══════════════════════════════════════════════════════════════
   Gli anelli appaiono come bande concentriche di ghiaccio: avorio/bianco sporco
   con sfumature beige e grigio pallido. Superficie granulare (milioni di frammenti).
   Divisioni evidenti (Cassini, Encke). Lato illuminato argenteo-brillante,
   lato ombra opaco e freddo con traslucidità ai bordi rarefatti.
*/
function createSaturnRing(innerR, outerR) {
    const geo = new THREE.RingGeometry(innerR, outerR, 192, 1);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        uv.setXY(i, (Math.sqrt(x * x + z * z) - innerR) / (outerR - innerR), 0.5);
    }

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uSunPos: { value: new THREE.Vector3(0, 0, 0) },
            uPlanetPos: { value: new THREE.Vector3(0, 0, 0) },
            uPlanetRadius: { value: 2.2 }
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;
            void main() {
                vUv = uv;
                vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                vWorldNormal = normalize((modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
                gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
            }`,
        fragmentShader: `
            uniform vec3 uSunPos;
            uniform vec3 uPlanetPos;
            uniform float uPlanetRadius;
            varying vec2 vUv;
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;

            // Hash per effetto granulare (frammenti di ghiaccio)
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            // Noise value morbido
            float vnoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            void main() {
                float t = clamp(vUv.x, 0.0, 1.0);

                // ═══════════════════════════════════════════
                // COLORE BASE – avorio ghiacciato / bianco sporco
                // ═══════════════════════════════════════════
                vec3 ivory     = vec3(0.92, 0.90, 0.85);
                vec3 beige     = vec3(0.88, 0.84, 0.78);
                vec3 paleGray  = vec3(0.78, 0.77, 0.75);

                // Gradiente radiale: interno più luminoso, esterno più grigio
                vec3 col = mix(ivory, beige, smoothstep(0.0, 0.5, t));
                col = mix(col, paleGray, smoothstep(0.5, 1.0, t));

                // ═══════════════════════════════════════════
                // GRANULARITÀ – frammenti di ghiaccio
                // ═══════════════════════════════════════════
                // Angolo attorno all'anello per variazione 2D
                vec2 worldXZ = vWorldPos.xz;
                float angle = atan(worldXZ.y, worldXZ.x);

                // Rumore ad alta frequenza per grana dei cristalli
                float grain = vnoise(vec2(t * 300.0, angle * 50.0)) * 0.08;
                float fineGrain = vnoise(vec2(t * 800.0, angle * 120.0)) * 0.04;
                col += (grain + fineGrain - 0.06); // centrato su zero

                // Sparkle occasionale (riflesso di particella)
                float sparkle = pow(hash(vec2(t * 500.0, angle * 80.0)), 12.0) * 0.3;
                col += sparkle;

                // ═══════════════════════════════════════════
                // PROFILO DENSITÀ – bande realistiche
                // ═══════════════════════════════════════════
                // Struttura degli anelli (da interno a esterno):
                // D ring (0.0-0.08): molto tenue
                // C ring (0.08-0.25): semi-trasparente
                // B ring (0.25-0.55): il più denso e luminoso
                // Cassini Division (0.55-0.62): gap quasi vuoto
                // A ring (0.62-0.88): medio-denso
                // Encke Gap (0.78-0.80): sottile gap
                // F ring (0.93-0.97): stretto e luminoso
                // Oltre: vuoto

                float density = 0.0;

                // D ring
                density += smoothstep(0.0, 0.03, t) * 0.12 * (1.0 - smoothstep(0.06, 0.08, t));

                // C ring 
                float cRing = smoothstep(0.08, 0.10, t) * (1.0 - smoothstep(0.23, 0.25, t));
                density += cRing * 0.35;
                // Ringlets dentro C ring
                density += cRing * sin(t * 180.0) * 0.08;

                // B ring (il più denso)
                float bRing = smoothstep(0.25, 0.27, t) * (1.0 - smoothstep(0.53, 0.55, t));
                density += bRing * 0.9;
                // Variazioni di densità dentro B ring
                density += bRing * sin(t * 60.0) * 0.05;
                density += bRing * sin(t * 120.0 + 0.7) * 0.03;

                // Cassini Division
                float cassini = smoothstep(0.55, 0.56, t) * (1.0 - smoothstep(0.61, 0.62, t));
                density *= (1.0 - cassini * 0.92);

                // A ring
                float aRing = smoothstep(0.62, 0.64, t) * (1.0 - smoothstep(0.86, 0.88, t));
                density += aRing * 0.55;
                density += aRing * sin(t * 90.0) * 0.04;

                // Encke Gap
                float encke = smoothstep(0.78, 0.785, t) * (1.0 - smoothstep(0.795, 0.80, t));
                density *= (1.0 - encke * 0.7);

                // F ring (stretto, brillante)
                float fRing = smoothstep(0.93, 0.94, t) * (1.0 - smoothstep(0.96, 0.97, t));
                density += fRing * 0.5;

                // Sfuma bordi estremi
                density *= smoothstep(0.0, 0.02, t);
                density *= 1.0 - smoothstep(0.97, 1.0, t);

                float alpha = clamp(density, 0.0, 1.0);

                // ═══════════════════════════════════════════
                // ILLUMINAZIONE SOLARE
                // ═══════════════════════════════════════════
                vec3 lightDir = normalize(uSunPos - vWorldPos);
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float NdotL = dot(vWorldNormal, lightDir);
                float absNdotL = abs(NdotL);

                // Lato illuminato: brillante, quasi argenteo
                vec3 litColor = col * 1.15 + vec3(0.06, 0.06, 0.08); // boost argenteo

                // Lato ombra: opaco e freddo
                vec3 shadowColor = col * 0.4 * vec3(0.85, 0.88, 0.95); // tinta blu-fredda

                // Mix basato sull'orientamento rispetto alla luce
                float litFactor = absNdotL;
                vec3 finalCol = mix(shadowColor, litColor, litFactor);

                // Forward scattering (traslucidità ai bordi rarefatti)
                // La luce attraversa le zone meno dense
                float VdotL = max(dot(viewDir, -lightDir), 0.0);
                float scatter = pow(VdotL, 4.0) * (1.0 - density * 0.7) * 0.35;
                finalCol += vec3(1.0, 0.95, 0.85) * scatter;

                // Back scatter morbido (riflesso diffuso)
                float backScatter = pow(max(dot(viewDir, lightDir), 0.0), 2.0) * 0.08;
                finalCol += col * backScatter;

                // ═══════════════════════════════════════════
                // OMBRA DEL PIANETA
                // ═══════════════════════════════════════════
                vec3 toSun = normalize(uSunPos - uPlanetPos);
                vec3 fragFromPlanet = vWorldPos - uPlanetPos;
                float projOnSun = dot(fragFromPlanet, toSun);
                vec3 closestOnRay = uPlanetPos + toSun * projOnSun;
                float distFromAxis = length(vWorldPos - closestOnRay);

                float planetShadow = smoothstep(uPlanetRadius * 0.92, uPlanetRadius * 1.08, distFromAxis);
                if (projOnSun < 0.0) {
                    // Nell'ombra: molto scuro ma non completamente nero
                    finalCol *= mix(0.06, 1.0, planetShadow);
                    // Bordo ombra leggermente bluastro
                    finalCol += vec3(0.02, 0.03, 0.06) * (1.0 - planetShadow);
                }

                // Traslucidità: zone rarefatte lasciano passare più luce
                alpha *= mix(0.85, 1.0, litFactor);

                gl_FragColor = vec4(finalCol, alpha);
            }`
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
            ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${a * opacity})`;
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
            new THREE.MeshStandardMaterial({
                color: m.color,
                roughness: 0.7,
                emissive: m.color,
                emissiveIntensity: 0.08
            })
        );
        group.add(mMesh);
        return { mesh: mMesh, orbitR: m.orbitR, speed: m.speed, name: m.name || 'Moon', radius: m.radius };
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
        name: 'Mercurio', radius: 0.35, orbitR: 8, speed: 4.15, rotSpeed: 0.004,
        hsl: [30, 20, 50], dotColor: '#a8937e', atmoColor: '#aa8866'
    });

    addPlanet(scene, {
        name: 'Venere', radius: 0.85, orbitR: 13, speed: 1.62, rotSpeed: -0.002,
        hsl: [40, 50, 65], dotColor: '#e8c56d', atmoColor: '#ffcc66'
    });

    addPlanet(scene, {
        name: 'Terra', radius: 1.0, orbitR: 18, speed: 1.0, rotSpeed: 0.01,
        hsl: [210, 60, 45], dotColor: '#4a90d9', atmoColor: '#4499ff',
        moons: [{ name: 'Luna', radius: 0.25, orbitR: 2.0, speed: 3.0, color: 0xbbbbbb }]
    });

    addPlanet(scene, {
        name: 'Marte', radius: 0.5, orbitR: 25, speed: 0.53, rotSpeed: 0.009,
        hsl: [10, 65, 42], dotColor: '#c1440e', atmoColor: '#dd6633'
    });

    addPlanet(scene, {
        name: 'Giove', radius: 2.8, orbitR: 45, speed: 0.084, rotSpeed: 0.02,
        dotColor: '#c88b3a', atmoColor: '#ddaa55', customMaterial: createJupiterMaterial(),
        moons: [
            { name: 'Io', radius: 0.2, orbitR: 4.5, speed: 2.5, color: 0xeeddaa },
            { name: 'Europa', radius: 0.25, orbitR: 5.5, speed: 1.8, color: 0xaabbcc },
            { name: 'Ganymede', radius: 0.18, orbitR: 6.5, speed: 1.2, color: 0xccbbaa },
            { name: 'Callisto', radius: 0.3, orbitR: 8.0, speed: 0.8, color: 0xddccbb }
        ]
    });

    addPlanet(scene, {
        name: 'Saturno', radius: 2.2, orbitR: 70, speed: 0.034, rotSpeed: 0.018,
        dotColor: '#d4b87a', atmoColor: '#ccaa66', tilt: 0.46,
        customMaterial: createSaturnMaterial(),
        isSaturnRing: true, ringInner: 2.8, ringOuter: 8.0,
        moons: [
            { name: 'Titan', radius: 0.35, orbitR: 7.5, speed: 1.6, color: 0xeeddcc },
            { name: 'Enceladus', radius: 0.15, orbitR: 8.5, speed: 2.2, color: 0xaabbaa }
        ]
    });

    addPlanet(scene, {
        name: 'Urano', radius: 1.5, orbitR: 100, speed: 0.012, rotSpeed: 0.012,
        hsl: [180, 45, 60], dotColor: '#7ec8e3', atmoColor: '#66cccc', tilt: 1.71,
        hasRing: true, ringInner: 2.2, ringOuter: 3.2, ringColor: [150, 200, 220], ringOpacity: 0.25
    });

    addPlanet(scene, {
        name: 'Nettuno', radius: 1.4, orbitR: 130, speed: 0.006, rotSpeed: 0.011,
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
