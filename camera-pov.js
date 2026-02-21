/**
 * camera-pov.js - Camera POV con taglio netto + menu pianeti/lune
 *
 * Hover su pianeta/luna → camera si teletrasporta istantaneamente (hard cut)
 * Menu dots: dimensioni variabili proporzionali al raggio del pianeta
 */
import * as THREE from 'three';
import { planets } from './planets.js';

let cameraMode = 'orbit';
let cameraTargetPos = new THREE.Vector3();
let cameraLookAtPos = new THREE.Vector3();
let savedCameraPos = new THREE.Vector3();
let savedControlsTarget = new THREE.Vector3();
let activePlanetIdx = -1;
let activeMoonIdx = -1;
let needsInstantJump = false;

function startPlanetPOV(camera, controls, idx) {
    if (cameraMode === 'orbit') {
        savedCameraPos.copy(camera.position);
        savedControlsTarget.copy(controls.target);
    }
    cameraMode = 'planet-pov';
    activePlanetIdx = idx;
    activeMoonIdx = -1;
    needsInstantJump = true;
    controls.enabled = false;
    controls.autoRotate = false;
}

function startMoonPOV(camera, controls, planetIdx, moonIdx) {
    if (cameraMode === 'orbit') {
        savedCameraPos.copy(camera.position);
        savedControlsTarget.copy(controls.target);
    }
    cameraMode = 'moon-pov';
    activePlanetIdx = planetIdx;
    activeMoonIdx = moonIdx;
    needsInstantJump = true;
    controls.enabled = false;
    controls.autoRotate = false;
}

function endPOV() {
    cameraMode = 'orbit';
    activePlanetIdx = -1;
    activeMoonIdx = -1;
    needsInstantJump = true;
    cameraTargetPos.copy(savedCameraPos);
    cameraLookAtPos.copy(savedControlsTarget);
}

export function updateCameraPOV(camera, controls) {
    if (cameraMode === 'planet-pov' && activePlanetIdx >= 0) {
        const p = planets[activePlanetIdx];
        const pPos = new THREE.Vector3();
        p.group.getWorldPosition(pPos);

        const awayDir = pPos.clone().normalize();
        const offset = p.radius * 8;
        cameraTargetPos.copy(pPos).add(awayDir.clone().multiplyScalar(offset));
        cameraTargetPos.y += p.radius * 2;

        cameraLookAtPos.copy(pPos);
        cameraLookAtPos.y -= p.radius * 0.05;
    }

    if (cameraMode === 'moon-pov' && activePlanetIdx >= 0 && activeMoonIdx >= 0) {
        const p = planets[activePlanetIdx];
        const moon = p.moonMeshes[activeMoonIdx];
        if (moon) {
            const moonWorldPos = new THREE.Vector3();
            moon.mesh.getWorldPosition(moonWorldPos);

            const pPos = new THREE.Vector3();
            p.group.getWorldPosition(pPos);

            const moonToPlanet = pPos.clone().sub(moonWorldPos).normalize();
            const offset = moon.radius * 12 + 1.5;
            cameraTargetPos.copy(moonWorldPos).sub(moonToPlanet.clone().multiplyScalar(offset));
            cameraTargetPos.y += moon.radius * 3;

            cameraLookAtPos.copy(moonWorldPos);
        }
    }

    if (cameraMode === 'planet-pov' || cameraMode === 'moon-pov' || (cameraMode === 'orbit' && !controls.enabled)) {
        if (needsInstantJump) {
            // Taglio netto — nessuna animazione
            camera.position.copy(cameraTargetPos);
            needsInstantJump = false;
        } else if (cameraMode === 'planet-pov' || cameraMode === 'moon-pov') {
            // Segui il target (il pianeta/luna si muove)
            camera.position.copy(cameraTargetPos);
        } else {
            // Ritorno all'orbita: lerp morbido
            camera.position.lerp(cameraTargetPos, 0.05);
        }
        camera.lookAt(cameraLookAtPos);

        if (cameraMode === 'orbit') {
            if (camera.position.distanceTo(savedCameraPos) < 1.5) {
                controls.enabled = true;
                controls.autoRotate = true;
                controls.target.copy(savedControlsTarget);
            }
        }
    }
}

/* ── Calcola dimensione dot in base al raggio del pianeta ── */
function planetDotSize(radius) {
    // Scala: da Mercury (0.35) → 14px  a Jupiter (2.8) → 28px
    const minR = 0.35, maxR = 2.8;
    const minSize = 14, maxSize = 28;
    const t = Math.min(1, Math.max(0, (radius - minR) / (maxR - minR)));
    return Math.round(minSize + t * (maxSize - minSize));
}

export function initPlanetMenu(camera, controls) {
    const menu = document.getElementById('planet-menu');

    planets.forEach((p, i) => {
        const planetGroup = document.createElement('div');
        planetGroup.className = 'planet-group';

        // Dot pianeta con dimensione proporzionale
        const dot = document.createElement('div');
        dot.className = 'planet-dot';
        dot.dataset.name = p.name;
        dot.style.background = p.dotColor;
        dot.style.boxShadow = `0 0 6px ${p.dotColor}44`;
        const size = planetDotSize(p.radius);
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';

        dot.addEventListener('mouseenter', () => {
            startPlanetPOV(camera, controls, i);
            document.querySelectorAll('.planet-dot, .moon-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        });
        dot.addEventListener('mouseleave', (e) => {
            const related = e.relatedTarget;
            if (related && planetGroup.contains(related)) return;
            endPOV();
            dot.classList.remove('active');
        });

        planetGroup.appendChild(dot);

        // Lune
        if (p.moonMeshes.length > 0) {
            const moonContainer = document.createElement('div');
            moonContainer.className = 'moon-container';

            p.moonMeshes.forEach((moon, mi) => {
                const moonDot = document.createElement('div');
                moonDot.className = 'moon-dot';
                moonDot.dataset.name = moon.name;
                // Moon dot size proporzionale
                const moonSize = Math.round(6 + moon.radius * 16);
                moonDot.style.width = moonSize + 'px';
                moonDot.style.height = moonSize + 'px';

                moonDot.addEventListener('mouseenter', () => {
                    startMoonPOV(camera, controls, i, mi);
                    document.querySelectorAll('.planet-dot, .moon-dot').forEach(d => d.classList.remove('active'));
                    moonDot.classList.add('active');
                });
                moonDot.addEventListener('mouseleave', (e) => {
                    const related = e.relatedTarget;
                    if (related && planetGroup.contains(related)) return;
                    endPOV();
                    moonDot.classList.remove('active');
                });

                moonContainer.appendChild(moonDot);
            });

            planetGroup.appendChild(moonContainer);
        }

        planetGroup.addEventListener('mouseleave', () => {
            endPOV();
            planetGroup.querySelectorAll('.planet-dot, .moon-dot').forEach(d => d.classList.remove('active'));
        });

        menu.appendChild(planetGroup);
    });
}
