/**
 * particles.js - Effetti particellari: solar wind + comete
 *
 * Solar Wind:
 *   Particelle emesse radialmente dal sole con velocità casuale.
 *   Vengono riciclate quando superano un raggio massimo.
 *
 * Comete:
 *   Punti luminosi con scia (trail), traiettorie paraboliche rare.
 *   Frequenza e velocità configurabili via particleParams.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;

/**
 * Parametri runtime esposti per il debug panel.
 * Vengono letti ogni frame dalle funzioni di update.
 */
export const particleParams = {
    /* Solar Wind */
    windSpeedMul: 1.0,      // moltiplicatore velocità vento solare
    windVisible: true,       // visibilità vento solare

    /* Comete */
    cometSpawnRate: 1.0,     // moltiplicatore frequenza spawn (1 = ~20s, 2 = ~10s)
    cometSpeedMul: 1.0,      // moltiplicatore velocità comete
    cometTrailOpacity: 0.4,  // opacità scia
    cometsVisible: true      // visibilità comete
};

/* ── Solar Wind ── */
export function createSolarWind(scene) {
    const count = 600;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        resetParticle(positions, velocities, sizes, i);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
      attribute float size;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = length(position);
        vAlpha = smoothstep(150.0, 5.0, dist) * 0.6;
        gl_PointSize = size * (80.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float alpha = (1.0 - smoothstep(0.0, 1.0, d)) * vAlpha;
        gl_FragColor = vec4(1.0, 0.85, 0.5, alpha);
      }`
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    return { points, positions, velocities, sizes, geo };
}

function resetParticle(pos, vel, sizes, i) {
    const theta = Math.random() * TAU;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 3.5 + Math.random() * 2;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);

    const speed = 0.05 + Math.random() * 0.15;
    const dir = new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).normalize();
    vel[i * 3] = dir.x * speed;
    vel[i * 3 + 1] = dir.y * speed;
    vel[i * 3 + 2] = dir.z * speed;

    sizes[i] = 0.3 + Math.random() * 0.8;
}

export function updateSolarWind(wind) {
    const { points, positions, velocities, sizes, geo } = wind;
    points.visible = particleParams.windVisible;
    if (!particleParams.windVisible) return;

    const mul = particleParams.windSpeedMul;
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
        positions[i * 3] += velocities[i * 3] * mul;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * mul;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * mul;

        const dist = Math.sqrt(positions[i * 3] ** 2 + positions[i * 3 + 1] ** 2 + positions[i * 3 + 2] ** 2);
        if (dist > 150) {
            resetParticle(positions, velocities, sizes, i);
        }
    }
    geo.attributes.position.needsUpdate = true;
}

/* ── Comete ── */
export function createCometSystem(scene) {
    const cometGroup = new THREE.Group();
    scene.add(cometGroup);

    const comets = [];

    function spawnComet() {
        const angle = Math.random() * TAU;
        const startR = 120 + Math.random() * 40;
        const startPos = new THREE.Vector3(
            Math.cos(angle) * startR,
            (Math.random() - 0.5) * 20,
            Math.sin(angle) * startR
        );

        const target = new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 30
        );
        const speedMul = particleParams.cometSpeedMul;
        const dir = target.sub(startPos).normalize().multiplyScalar((0.6 + Math.random() * 0.4) * speedMul);

        const trailLen = 30;
        const trailGeo = new THREE.BufferGeometry();
        const trailPos = new Float32Array(trailLen * 3);
        for (let i = 0; i < trailLen; i++) {
            trailPos[i * 3] = startPos.x;
            trailPos[i * 3 + 1] = startPos.y;
            trailPos[i * 3 + 2] = startPos.z;
        }
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));

        const trailMat = new THREE.LineBasicMaterial({
            color: 0xaaccff,
            transparent: true,
            opacity: particleParams.cometTrailOpacity,
            linewidth: 1
        });
        const trail = new THREE.Line(trailGeo, trailMat);
        cometGroup.add(trail);

        const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const headMat = new THREE.MeshBasicMaterial({
            color: 0xddeeff,
            transparent: true,
            opacity: 0.9
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.copy(startPos);
        cometGroup.add(head);

        comets.push({
            head, trail, trailPos, trailGeo, trailMat,
            pos: startPos.clone(),
            vel: dir,
            life: 0,
            maxLife: 300 + Math.random() * 200
        });
    }

    let nextSpawn = 500 + Math.random() * 800;
    let frameCount = 0;

    function update() {
        cometGroup.visible = particleParams.cometsVisible;
        if (!particleParams.cometsVisible) return;

        frameCount++;
        // Il rate moltiplica la frequenza: spawnInterval = base / rate
        const spawnInterval = Math.max(100, (500 + Math.random() * 300) / Math.max(0.1, particleParams.cometSpawnRate));
        if (frameCount >= nextSpawn) {
            spawnComet();
            nextSpawn = frameCount + spawnInterval;
        }

        for (let c = comets.length - 1; c >= 0; c--) {
            const comet = comets[c];
            comet.pos.add(comet.vel);
            comet.head.position.copy(comet.pos);
            comet.life++;

            // Aggiorna opacità trail in tempo reale
            comet.trailMat.opacity = particleParams.cometTrailOpacity;

            for (let i = comet.trailPos.length / 3 - 1; i > 0; i--) {
                comet.trailPos[i * 3] = comet.trailPos[(i - 1) * 3];
                comet.trailPos[i * 3 + 1] = comet.trailPos[(i - 1) * 3 + 1];
                comet.trailPos[i * 3 + 2] = comet.trailPos[(i - 1) * 3 + 2];
            }
            comet.trailPos[0] = comet.pos.x;
            comet.trailPos[1] = comet.pos.y;
            comet.trailPos[2] = comet.pos.z;
            comet.trailGeo.attributes.position.needsUpdate = true;

            if (comet.life > comet.maxLife) {
                cometGroup.remove(comet.head);
                cometGroup.remove(comet.trail);
                comet.head.geometry.dispose();
                comet.trail.geometry.dispose();
                comets.splice(c, 1);
            }
        }
    }

    return { update };
}

