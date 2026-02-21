/**
 * main.js – Orchestrator cinematografico
 *
 * Importa tutti i moduli e gestisce: scene setup, animation loop,
 * quality toggle, labels, resize.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStarfield } from './starfield.js';
import { createSun } from './sun.js';
import { planets, initPlanets, createAsteroidBelt } from './planets.js';
import { initPostProcessing } from './postprocessing.js';
import { updateCameraPOV, initPlanetMenu } from './camera-pov.js';
import { createSolarWind, updateSolarWind, createCometSystem } from './particles.js';

/* ── Loader ── */
const loaderBar = document.getElementById('loaderBar');
const loaderPct = document.getElementById('loaderPct');
function setProgress(p) {
    const c = Math.min(100, Math.max(0, Math.round(p)));
    loaderBar.style.width = c + '%';
    loaderPct.textContent = c + ' %';
}
setProgress(5);

/* ── Renderer ── */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

/* ── Scene & Camera ── */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(45, 30, 70);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
controls.maxDistance = 500;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15;

/* ── Ambient ── */
scene.add(new THREE.AmbientLight(0x0a0a1a, 0.4));
setProgress(15);

/* ── Init moduli ── */
const starMaterial = createStarfield(scene);
setProgress(25);

const { sunMesh, sunMat, coronaMat } = createSun(scene);
setProgress(40);

initPlanets(scene);
setProgress(55);

const asteroidBelt = createAsteroidBelt(scene);
setProgress(65);

const { composer, bloomPass, streakPass, compositePass, setQuality } = initPostProcessing(renderer, scene, camera);
setProgress(75);

/* ── Particles ── */
const solarWind = createSolarWind(scene);
const cometSystem = createCometSystem(scene);
setProgress(85);

/* ── Planet Menu & Camera POV ── */
initPlanetMenu(camera, controls);
setProgress(90);

/* ── Quality Toggle ── */
const qualityBtn = document.getElementById('quality-toggle');
let currentQuality = 'normal';

qualityBtn.addEventListener('click', () => {
    currentQuality = currentQuality === 'normal' ? 'ultra' : 'normal';
    setQuality(currentQuality);
    qualityBtn.textContent = currentQuality;
    qualityBtn.classList.toggle('ultra', currentQuality === 'ultra');
});

/* ── Labels ── */
const labelContainer = document.createElement('div');
labelContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;overflow:hidden;';
document.body.appendChild(labelContainer);

const labels = planets.map(p => {
    const el = document.createElement('div');
    el.textContent = p.name;
    el.style.cssText = `position:absolute;font-family:'Inter','Segoe UI',sans-serif;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:1px;text-transform:uppercase;transform:translate(-50%,-100%);padding-bottom:4px;white-space:nowrap;text-shadow:0 0 8px rgba(0,0,0,.9);transition:opacity .3s;`;
    labelContainer.appendChild(el);
    return { el, planet: p };
});

function updateLabels() {
    const halfW = window.innerWidth / 2, halfH = window.innerHeight / 2;
    labels.forEach(({ el, planet }) => {
        const pos = new THREE.Vector3();
        planet.group.getWorldPosition(pos);
        pos.project(camera);
        if (pos.z > 1) { el.style.opacity = '0'; return; }
        el.style.left = (pos.x * halfW + halfW) + 'px';
        el.style.top = (-pos.y * halfH + halfH - 10) + 'px';
        const dist = camera.position.distanceTo(planet.group.position);
        el.style.opacity = String(THREE.MathUtils.clamp(1 - dist / 300, 0.1, 0.7));
    });
}

/* ── Animation Loop ── */
const clock = new THREE.Clock();
setProgress(100);

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Sole
    sunMat.uniforms.uTime.value = t;
    coronaMat.uniforms.uTime.value = t;
    sunMesh.rotation.y = t * 0.1;

    // Stelle
    starMaterial.uniforms.uTime.value = t;

    // Pianeti
    planets.forEach(p => {
        p.angle += p.speed * 0.004;
        p.group.position.x = Math.cos(p.angle) * p.orbitR;
        p.group.position.z = Math.sin(p.angle) * p.orbitR;
        p.mesh.rotation.y += p.rotSpeed;

        // Aggiorna uTime per shader Jupiter
        if (p.hasCustomShader && p.mesh.material.uniforms.uTime) {
            p.mesh.material.uniforms.uTime.value = t;
        }

        p.moonMeshes.forEach(m => {
            const ma = t * m.speed;
            m.mesh.position.x = Math.cos(ma) * m.orbitR;
            m.mesh.position.z = Math.sin(ma) * m.orbitR;
            m.mesh.position.y = Math.sin(ma * 0.3) * 0.15;
        });
    });

    asteroidBelt.rotation.y += 0.0001;

    // Particles
    updateSolarWind(solarWind);
    cometSystem.update();

    // Camera POV
    updateCameraPOV(camera, controls);

    // Post-processing time
    compositePass.uniforms.uTime.value = t;

    if (controls.enabled) controls.update();
    updateLabels();
    composer.render();
}

setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('planet-menu').classList.add('visible');
    qualityBtn.classList.add('visible');
    animate();
}, 400);

/* ── Resize ── */
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    streakPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});
