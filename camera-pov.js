/**
 * camera-pov.js – Camera POV cinematografica con crescent backlit
 *
 * Hover su dot → camera dietro il pianeta, pianeta centrato,
 * sole dietro → crescent illuminata sulla mezzaluna superiore.
 *
 * Posizionamento:
 *   awayDir = normalize(planetPos)         → vettore sole→pianeta
 *   camPos  = planetPos + awayDir × offset → DIETRO il pianeta (lato esterno)
 *   camPos.y += spostamento verticale      → leggermente sotto per vedere il crescent in alto
 *   camera.lookAt(planetPos)               → il pianeta è centrato in schermo
 *   Il sole rimane visibile DIETRO il pianeta → glow + crescent
 */
import * as THREE from 'three';
import { planets } from './planets.js';

let cameraMode = 'orbit';
let cameraTargetPos = new THREE.Vector3();
let cameraLookAtPos = new THREE.Vector3();
let savedCameraPos = new THREE.Vector3();
let savedControlsTarget = new THREE.Vector3();
let activePlanetIdx = -1;
const smoothFactor = 0.035;

function startPlanetPOV(camera, controls, idx) {
    if (cameraMode === 'orbit') {
        savedCameraPos.copy(camera.position);
        savedControlsTarget.copy(controls.target);
    }
    cameraMode = 'planet-pov';
    activePlanetIdx = idx;
    controls.enabled = false;
    controls.autoRotate = false;
}

function endPlanetPOV() {
    cameraMode = 'orbit';
    activePlanetIdx = -1;
    cameraTargetPos.copy(savedCameraPos);
    cameraLookAtPos.copy(savedControlsTarget);
}

export function updateCameraPOV(camera, controls) {
    if (cameraMode === 'planet-pov' && activePlanetIdx >= 0) {
        const p = planets[activePlanetIdx];
        const pPos = new THREE.Vector3();
        p.group.getWorldPosition(pPos);

        // Vettore dal sole al pianeta (direzione "esterna")
        const awayDir = pPos.clone().normalize();

        // Camera dietro il pianeta (dal lato opposto al sole)
        const offset = p.radius * 4 + 3;
        cameraTargetPos.copy(pPos).add(awayDir.clone().multiplyScalar(offset));
        // Leggermente sotto il centro del pianeta per mostrare il crescent in alto
        cameraTargetPos.y += p.radius * -0.5;

        // LookAt: il pianeta stesso (centrato in schermo)
        cameraLookAtPos.copy(pPos);
    }

    if (cameraMode === 'planet-pov' || (cameraMode === 'orbit' && !controls.enabled)) {
        camera.position.lerp(cameraTargetPos, smoothFactor);
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

export function initPlanetMenu(camera, controls) {
    const menu = document.getElementById('planet-menu');

    planets.forEach((p, i) => {
        const dot = document.createElement('div');
        dot.className = 'planet-dot';
        dot.dataset.name = p.name;
        dot.style.background = p.dotColor;
        dot.style.boxShadow = `0 0 6px ${p.dotColor}44`;

        dot.addEventListener('mouseenter', () => {
            startPlanetPOV(camera, controls, i);
            document.querySelectorAll('.planet-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        });
        dot.addEventListener('mouseleave', () => {
            endPlanetPOV();
            dot.classList.remove('active');
        });

        menu.appendChild(dot);
    });
}
