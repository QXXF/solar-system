/**
 * main.js – Orchestrator cinematografico
 *
 * Importa tutti i moduli e gestisce: scene setup, animation loop,
 * quality toggle, labels, resize.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import CONFIG from './config.js';
import { createStarfield } from './starfield.js';
import { createSun } from './sun.js';
import { planets, initPlanets, createAsteroidBelt } from './planets.js';
import { initPostProcessing } from './postprocessing.js';
import { updateCameraPOV, initPlanetMenu } from './camera-pov.js';
import { createSolarWind, updateSolarWind, createCometSystem, particleParams } from './particles.js';

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
renderer.toneMappingExposure = CONFIG.renderer.exposure;
document.body.appendChild(renderer.domElement);

/* ── Scene & Camera ── */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(45, 30, 70);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = CONFIG.camera.dampingFactor;
controls.minDistance = 8;
controls.maxDistance = 500;
controls.autoRotate = CONFIG.camera.autoRotate;
controls.autoRotateSpeed = CONFIG.camera.autoRotateSpeed;

/* ── Ambient ── */
scene.add(new THREE.AmbientLight(0x0a0a1a, 0.4));
setProgress(15);

/* ── Init moduli ── */
const starMaterial = createStarfield(scene);
// Riferimento ai punti stelle per toggle visibilità
const starPoints = scene.children.find(c => c.isPoints && c.material === starMaterial);
setProgress(25);

const { sunMesh, sunMat, coronaMat } = createSun(scene);
// Prendi riferimento alla PointLight del sole
const sunLight = scene.children.find(c => c.isPointLight);
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

/* ══════════════════════════════════════════════════════════════
   DEBUG GUI – lil-gui + import/export CONFIG
   ══════════════════════════════════════════════════════════════ */
const toneOpts = {
    'ACES Filmic': THREE.ACESFilmicToneMapping,
    'Cineon': THREE.CineonToneMapping,
    'Reinhard': THREE.ReinhardToneMapping,
    'Linear': THREE.LinearToneMapping,
    'None': THREE.NoToneMapping
};
const toneReverse = Object.fromEntries(Object.entries(toneOpts).map(([k, v]) => [v, k]));

// Proxy per il tone mapping (stringa ↔ enum)
const toneProxy = { toneMapping: CONFIG.renderer.toneMapping };

// Parametri simulazione
const simParams = { speedMultiplier: CONFIG.simulation.speedMultiplier };
window._debugParams = simParams;

// Parametri sole (runtime)
const sunParams = {
    lightIntensity: CONFIG.sun.lightIntensity,
    glowOpacity: CONFIG.sun.glowOpacity,
    rotationSpeed: CONFIG.sun.rotationSpeed
};

// Parametri stelle (runtime)
const starParams = {
    twinkleSpeed: CONFIG.starfield.twinkleSpeed,
    fogDensity: CONFIG.starfield.fogDensity,
    visible: CONFIG.starfield.visible
};

// Parametri asteroidi (runtime)
const asteroidParams = {
    rotationSpeed: CONFIG.asteroids.rotationSpeed,
    visible: CONFIG.asteroids.visible
};

/** Applica un oggetto config a tutti i parametri runtime */
function applyConfig(cfg) {
    // Renderer
    renderer.toneMappingExposure = cfg.renderer.exposure;
    renderer.toneMapping = toneOpts[cfg.renderer.toneMapping] ?? THREE.ACESFilmicToneMapping;
    toneProxy.toneMapping = cfg.renderer.toneMapping;

    // Bloom
    bloomPass.strength = cfg.bloom.strength;
    bloomPass.radius = cfg.bloom.radius;
    bloomPass.threshold = cfg.bloom.threshold;

    // Streak
    streakPass.uniforms.uStrength.value = cfg.streak.strength;
    streakPass.uniforms.uThreshold.value = cfg.streak.threshold;

    // Cinematic
    compositePass.uniforms.uGrainIntensity.value = cfg.cinematic.grainIntensity;
    compositePass.uniforms.uVignetteIntensity.value = cfg.cinematic.vignetteIntensity;
    compositePass.uniforms.uAberationStrength.value = cfg.cinematic.aberrationStrength;
    compositePass.uniforms.uColorGrading.value = cfg.cinematic.colorGrading;

    // Camera
    controls.autoRotate = cfg.camera.autoRotate;
    controls.autoRotateSpeed = cfg.camera.autoRotateSpeed;
    controls.dampingFactor = cfg.camera.dampingFactor;
    camera.fov = cfg.camera.fov;
    camera.updateProjectionMatrix();

    // Simulation
    simParams.speedMultiplier = cfg.simulation.speedMultiplier;

    // Sole
    if (cfg.sun) {
        sunParams.lightIntensity = cfg.sun.lightIntensity;
        sunParams.glowOpacity = cfg.sun.glowOpacity;
        sunParams.rotationSpeed = cfg.sun.rotationSpeed;
        if (sunLight) sunLight.intensity = cfg.sun.lightIntensity;
        if (coronaMat._allLayers) {
            coronaMat._allLayers.forEach(mat => {
                mat.uniforms.uOpacity.value = mat._baseOpacity * cfg.sun.glowOpacity;
            });
        }
    }

    // Stelle
    if (cfg.starfield) {
        starParams.twinkleSpeed = cfg.starfield.twinkleSpeed;
        starParams.fogDensity = cfg.starfield.fogDensity;
        starParams.visible = cfg.starfield.visible;
        if (scene.fog) scene.fog.density = cfg.starfield.fogDensity;
        if (starPoints) starPoints.visible = cfg.starfield.visible;
    }

    // Vento solare
    if (cfg.solarWind) {
        particleParams.windSpeedMul = cfg.solarWind.speedMultiplier;
        particleParams.windVisible = cfg.solarWind.visible;
    }

    // Comete
    if (cfg.comets) {
        particleParams.cometSpawnRate = cfg.comets.spawnRate;
        particleParams.cometSpeedMul = cfg.comets.speedMultiplier;
        particleParams.cometTrailOpacity = cfg.comets.trailOpacity;
        particleParams.cometsVisible = cfg.comets.visible;
    }

    // Asteroidi
    if (cfg.asteroids) {
        asteroidParams.rotationSpeed = cfg.asteroids.rotationSpeed;
        asteroidParams.visible = cfg.asteroids.visible;
        asteroidBelt.visible = cfg.asteroids.visible;
    }
}

/** Legge lo stato corrente e restituisce un oggetto config */
function readCurrentConfig() {
    return {
        renderer: {
            exposure: renderer.toneMappingExposure,
            toneMapping: toneReverse[renderer.toneMapping] || 'ACES Filmic'
        },
        bloom: {
            strength: bloomPass.strength,
            radius: bloomPass.radius,
            threshold: bloomPass.threshold
        },
        streak: {
            strength: streakPass.uniforms.uStrength.value,
            threshold: streakPass.uniforms.uThreshold.value
        },
        cinematic: {
            grainIntensity: compositePass.uniforms.uGrainIntensity.value,
            vignetteIntensity: compositePass.uniforms.uVignetteIntensity.value,
            aberrationStrength: compositePass.uniforms.uAberationStrength.value,
            colorGrading: compositePass.uniforms.uColorGrading.value
        },
        camera: {
            autoRotate: controls.autoRotate,
            autoRotateSpeed: controls.autoRotateSpeed,
            dampingFactor: controls.dampingFactor,
            fov: camera.fov
        },
        simulation: {
            speedMultiplier: simParams.speedMultiplier
        },
        sun: {
            lightIntensity: sunParams.lightIntensity,
            glowOpacity: sunParams.glowOpacity,
            rotationSpeed: sunParams.rotationSpeed
        },
        starfield: {
            twinkleSpeed: starParams.twinkleSpeed,
            fogDensity: starParams.fogDensity,
            visible: starParams.visible
        },
        solarWind: {
            speedMultiplier: particleParams.windSpeedMul,
            visible: particleParams.windVisible
        },
        comets: {
            spawnRate: particleParams.cometSpawnRate,
            speedMultiplier: particleParams.cometSpeedMul,
            trailOpacity: particleParams.cometTrailOpacity,
            visible: particleParams.cometsVisible
        },
        asteroids: {
            rotationSpeed: asteroidParams.rotationSpeed,
            visible: asteroidParams.visible
        },
        qualityUltra: cfg_qualityUltra,
        qualityNormal: cfg_qualityNormal
    };
}

// Salva baseOpacity per i glow layers (serve per il moltiplicatore)
if (coronaMat._allLayers) {
    coronaMat._allLayers.forEach(mat => {
        mat._baseOpacity = mat.uniforms.uOpacity.value;
    });
}

// Quality preset proxy objects (modificabili dalla GUI)
const cfg_qualityUltra = { ...CONFIG.qualityUltra };
const cfg_qualityNormal = { ...CONFIG.qualityNormal };

// Applica i default da config.js all'avvio
applyConfig(CONFIG);

// ── Costruzione GUI ──
const gui = new GUI({ title: '🪐 Debug Panel' });

const rendererFolder = gui.addFolder('Renderer');
rendererFolder.add(renderer, 'toneMappingExposure', 0.1, 3.0, 0.05).name('Exposure');
rendererFolder.add(toneProxy, 'toneMapping', Object.keys(toneOpts)).name('Tone Mapping').onChange(v => {
    renderer.toneMapping = toneOpts[v];
});
rendererFolder.close();

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(bloomPass, 'strength', 0.0, 5.0, 0.05).name('Strength');
bloomFolder.add(bloomPass, 'radius', 0.0, 2.0, 0.01).name('Radius');
bloomFolder.add(bloomPass, 'threshold', 0.0, 1.0, 0.01).name('Threshold');
bloomFolder.close();

const streakFolder = gui.addFolder('Anamorphic Streak');
streakFolder.add(streakPass.uniforms.uStrength, 'value', 0.0, 2.0, 0.01).name('Strength');
streakFolder.add(streakPass.uniforms.uThreshold, 'value', 0.0, 1.5, 0.01).name('Threshold');
streakFolder.close();

const cineFolder = gui.addFolder('Cinematic');
cineFolder.add(compositePass.uniforms.uGrainIntensity, 'value', 0.0, 0.2, 0.001).name('Film Grain');
cineFolder.add(compositePass.uniforms.uVignetteIntensity, 'value', 0.0, 2.0, 0.05).name('Vignette');
cineFolder.add(compositePass.uniforms.uAberationStrength, 'value', 0.0, 0.01, 0.0001).name('Chrom. Aberr.');
cineFolder.add(compositePass.uniforms.uColorGrading, 'value', 0.0, 2.0, 0.05).name('Color Grading');
cineFolder.close();

const camFolder = gui.addFolder('Camera');
camFolder.add(controls, 'autoRotate').name('Auto Rotate');
camFolder.add(controls, 'autoRotateSpeed', 0.0, 2.0, 0.05).name('Rotate Speed');
camFolder.add(controls, 'dampingFactor', 0.01, 0.3, 0.01).name('Damping');
camFolder.add(camera, 'fov', 20, 120, 1).name('FOV').onChange(() => camera.updateProjectionMatrix());
camFolder.close();

const simFolder = gui.addFolder('Simulazione');
simFolder.add(simParams, 'speedMultiplier', 0.0, 5.0, 0.1).name('Velocità globale');
simFolder.close();

const sunFolder = gui.addFolder('Sole');
sunFolder.add(sunParams, 'lightIntensity', 0, 2000, 10).name('Intensità luce').onChange(v => {
    if (sunLight) sunLight.intensity = v;
});
sunFolder.add(sunParams, 'glowOpacity', 0.0, 3.0, 0.05).name('Glow opacity').onChange(v => {
    if (coronaMat._allLayers) {
        coronaMat._allLayers.forEach(mat => {
            mat.uniforms.uOpacity.value = mat._baseOpacity * v;
        });
    }
});
sunFolder.add(sunParams, 'rotationSpeed', 0.0, 1.0, 0.01).name('Rotazione');
sunFolder.close();

const starFolder = gui.addFolder('Stelle');
starFolder.add(starParams, 'visible').name('Visibili').onChange(v => {
    if (starPoints) starPoints.visible = v;
});
starFolder.add(starParams, 'twinkleSpeed', 0.0, 5.0, 0.1).name('Scintillio');
starFolder.add(starParams, 'fogDensity', 0.0, 0.005, 0.0001).name('Nebbia densità').onChange(v => {
    if (scene.fog) scene.fog.density = v;
});
starFolder.close();

const windFolder = gui.addFolder('Vento Solare');
windFolder.add(particleParams, 'windVisible').name('Visibile');
windFolder.add(particleParams, 'windSpeedMul', 0.0, 5.0, 0.1).name('Velocità');
windFolder.close();

const cometFolder = gui.addFolder('Comete');
cometFolder.add(particleParams, 'cometsVisible').name('Visibili');
cometFolder.add(particleParams, 'cometSpawnRate', 0.1, 5.0, 0.1).name('Freq. spawn');
cometFolder.add(particleParams, 'cometSpeedMul', 0.1, 5.0, 0.1).name('Velocità');
cometFolder.add(particleParams, 'cometTrailOpacity', 0.0, 1.0, 0.05).name('Scia opacità');
cometFolder.close();

const astFolder = gui.addFolder('Asteroidi');
astFolder.add(asteroidParams, 'visible').name('Visibili').onChange(v => {
    asteroidBelt.visible = v;
});
astFolder.add(asteroidParams, 'rotationSpeed', 0.0, 0.005, 0.0001).name('Rotazione');
astFolder.close();

// ── Quality Presets ──
const qFolder = gui.addFolder('Quality Presets');
qFolder.add({
    applyUltra() {
        renderer.setPixelRatio(window.devicePixelRatio);
        bloomPass.strength = cfg_qualityUltra.bloomStrength;
        bloomPass.radius = cfg_qualityUltra.bloomRadius;
        streakPass.uniforms.uStrength.value = cfg_qualityUltra.streakStrength;
        compositePass.uniforms.uGrainIntensity.value = cfg_qualityUltra.grainIntensity;
        compositePass.uniforms.uAberationStrength.value = cfg_qualityUltra.aberrationStrength;
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
}, 'applyUltra').name('Applica ULTRA');
qFolder.add({
    applyNormal() {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        bloomPass.strength = cfg_qualityNormal.bloomStrength;
        bloomPass.radius = cfg_qualityNormal.bloomRadius;
        streakPass.uniforms.uStrength.value = cfg_qualityNormal.streakStrength;
        compositePass.uniforms.uGrainIntensity.value = cfg_qualityNormal.grainIntensity;
        compositePass.uniforms.uAberationStrength.value = cfg_qualityNormal.aberrationStrength;
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
}, 'applyNormal').name('Applica NORMAL');
qFolder.close();

// ── Import / Export / Reset ──
const ioFolder = gui.addFolder('Preset');

ioFolder.add({
    exportJSON() {
        const json = JSON.stringify(readCurrentConfig(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'solar-system-config.json';
        a.click();
        URL.revokeObjectURL(url);
    }
}, 'exportJSON').name('Esporta JSON');

ioFolder.add({
    importJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const cfg = JSON.parse(reader.result);
                    applyConfig(cfg);
                    gui.controllersRecursive().forEach(c => c.updateDisplay());
                } catch (e) {
                    console.error('Config import error:', e);
                    alert('Errore nel file di configurazione!');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
}, 'importJSON').name('Importa JSON');

ioFolder.add({
    reset() {
        applyConfig(CONFIG);
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
}, 'reset').name('Reset Default');

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
    // Aggiorna tutti i glow layers volumetrici
    if (coronaMat._allLayers) {
        coronaMat._allLayers.forEach(mat => { mat.uniforms.uTime.value = t; });
    }
    sunMesh.rotation.y = t * sunParams.rotationSpeed;

    // Stelle
    starMaterial.uniforms.uTime.value = t * starParams.twinkleSpeed;

    // Pianeti
    planets.forEach(p => {
        p.angle += p.speed * 0.004 * (window._debugParams ? window._debugParams.speedMultiplier : 1.0);
        p.group.position.x = Math.cos(p.angle) * p.orbitR;
        p.group.position.z = Math.sin(p.angle) * p.orbitR;
        p.mesh.rotation.y += p.rotSpeed;

        // Aggiorna uTime per shader Jupiter
        if (p.hasCustomShader && p.mesh.material.uniforms.uTime) {
            p.mesh.material.uniforms.uTime.value = t;
        }

        // Aggiorna uSunPos per shader custom (Jupiter, Saturn, anelli)
        if (p.hasCustomShader && p.mesh.material.uniforms.uSunPos) {
            p.mesh.material.uniforms.uSunPos.value.set(0, 0, 0);
        }
        // Aggiorna uSunPos / uPlanetPos per i figli del gruppo (es. anelli Saturn)
        p.group.children.forEach(child => {
            if (child.material && child.material.uniforms) {
                if (child.material.uniforms.uSunPos) {
                    child.material.uniforms.uSunPos.value.set(0, 0, 0);
                }
                if (child.material.uniforms.uPlanetPos) {
                    child.material.uniforms.uPlanetPos.value.copy(p.group.position);
                }
            }
        });

        p.moonMeshes.forEach(m => {
            const ma = t * m.speed;
            m.mesh.position.x = Math.cos(ma) * m.orbitR;
            m.mesh.position.z = Math.sin(ma) * m.orbitR;
            m.mesh.position.y = Math.sin(ma * 0.3) * 0.15;
        });
    });

    if (asteroidParams.visible) asteroidBelt.rotation.y += asteroidParams.rotationSpeed;

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
