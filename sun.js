/**
 * sun.js - Sole con glow volumetrico multi-strato
 *
 * Il sole NON deve avere bordi definiti. L'effetto è ottenuto con:
 *   1. Core sphere: shader plasma senza Fresnel duro ai bordi
 *      → sfuma naturalmente a 0 verso il rim (alpha-blended)
 *   2. Glow layers: 4 sfere concentriche BackSide con Fresnel invertito,
 *      ciascuna a raggio + opacità diversi → falloff esponenziale
 *   3. Bloom del post-processing lavora su questo → effetto volumetrico
 */
import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { sunTexture, createFlareTexture } from './textures.js';

export function createSun(scene) {
  const SUN_RADIUS = 1.41;

  /* ══════════════════════════════════════════════════════════════
     CORE - sfera interna con bordi morbidi (alpha fade al rim)
     ══════════════════════════════════════════════════════════════ */
  const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
  const sunMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTexture: { value: sunTexture(512) }
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      uniform float uTime;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec3 pos = position;
        // Ribollimento superficiale
        pos += normal * sin(pos.x * 4.0 + uTime) * cos(pos.y * 4.0 + uTime * 0.7) * 0.06;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uTexture;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        // Distorsione UV animata (plasma)
        vec2 uv = vUv;
        uv.x += sin(uv.y * 10.0 + uTime * 0.5) * 0.02;
        uv.y += cos(uv.x * 8.0  + uTime * 0.3) * 0.02;
        vec4 tex = texture2D(uTexture, uv);

        float pulse = 0.92 + 0.08 * sin(uTime * 1.5);

        // Colore caldo brillante
        vec3 col = tex.rgb * vec3(1.3, 0.95, 0.55) * pulse;
        col = max(col, vec3(0.7, 0.35, 0.08));

        // Rim fade: il bordo sfuma a trasparente invece di avere un bordo netto
        float facing = max(dot(vNormal, vViewDir), 0.0);
        // Centro pieno, bordo svanisce dolcemente
        float coreFade = smoothstep(0.0, 0.45, facing);

        // Aggiungi un po' di emissione extra al bordo per il bloom
        col += vec3(1.0, 0.5, 0.1) * pow(1.0 - facing, 2.0) * 0.6;

        gl_FragColor = vec4(col, coreFade);
      }`
  });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sunMesh);

  /* ══════════════════════════════════════════════════════════════
     GLOW LAYERS - sfere concentriche BackSide per glow volumetrico
     ══════════════════════════════════════════════════════════════
     Approccio: `pow(facing, power)` — la luce è più intensa dove si guarda
     ATTRAVERSO la sfera verso il centro del sole, e decade a zero ai bordi
     geometrici. Nessun "anello" visibile, solo un gradiente continuo.
     
     Con additive blending, i layer si accumulano creando un blob luminoso
     senza discontinuità visibili.
  */
  const glowLayers = [
    // Vicini al core: densi e caldi
    { scale: 1.3, power: 1.5, opacity: 0.35, color: [1.0, 0.9, 0.55] },
    { scale: 1.7, power: 1.2, opacity: 0.22, color: [1.0, 0.75, 0.35] },
    // Medio: transizione morbida
    { scale: 2.3, power: 1.0, opacity: 0.14, color: [1.0, 0.6, 0.2] },
    { scale: 3.0, power: 0.8, opacity: 0.09, color: [1.0, 0.45, 0.12] },
    // Esterni: sottilissimi, ampia dispersione
    { scale: 4.2, power: 0.6, opacity: 0.05, color: [1.0, 0.35, 0.06] },
    { scale: 6.0, power: 0.5, opacity: 0.025, color: [1.0, 0.25, 0.02] },
  ];

  const coronaMats = [];

  glowLayers.forEach(layer => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(...layer.color) },
        uPower: { value: layer.power },
        uOpacity: { value: layer.opacity }
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vViewPos;
        void main() {
          vNormal = normalize(-(normalMatrix * normal));
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          vViewPos = mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uPower;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vViewPos;
        void main() {
          float facing = max(dot(vNormal, vViewDir), 0.0);

          // Centro-through: massimo dove guardi ATTRAVERSO verso il centro,
          // zero ai bordi geometrici → nessun edge visibile
          float glow = pow(facing, uPower);

          // Smoothing esponenziale extra per eliminare qualsiasi discontinuità
          glow *= exp(-2.0 * (1.0 - facing));

          // Flickering sottile 
          float flicker = 0.92 + 0.08 * sin(uTime * 2.0 + vViewPos.x * 1.2 + vViewPos.y * 0.7);

          vec3 col = uColor * flicker;
          float alpha = glow * uOpacity * flicker;

          gl_FragColor = vec4(col, alpha);
        }`
    });

    const glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_RADIUS * layer.scale, 32, 32),
      mat
    );
    scene.add(glowMesh);
    coronaMats.push(mat);
  });

  // Compatibilità: coronaMat espone il primo layer per main.js
  const coronaMat = coronaMats[0];
  // Aggiorniamo tutti i layer nell'update
  coronaMat._allLayers = coronaMats;

  /* ── Point Light ──
   * Con physically correct lights (Three.js r155+), l'intensità è in candela
   * e decade con 1/d². A distanza 18 (Terra): 800/324 ≈ 2.5, che è perfetto.
   * Il tone mapping ACES gestisce i valori alti vicino al sole (Mercurio).
   */
  const sunLight = new THREE.PointLight(0xfff5e0, 800, 0, 2);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // /* ── Lens Flare ── */
  // const lensflare = new Lensflare();
  // const fBig = createFlareTexture(256, 255, 230, 170);
  // const fSmall = createFlareTexture(128, 255, 200, 120);
  // const fRing = createFlareTexture(128, 120, 170, 255);
  // lensflare.addElement(new LensflareElement(fBig, 350, 0, new THREE.Color(1, 0.95, 0.8)));
  // lensflare.addElement(new LensflareElement(fSmall, 100, 0.15, new THREE.Color(1, 0.85, 0.6)));
  // lensflare.addElement(new LensflareElement(fRing, 60, 0.3, new THREE.Color(0.6, 0.7, 1)));
  // lensflare.addElement(new LensflareElement(fSmall, 40, 0.6, new THREE.Color(1, 0.7, 0.4)));
  // sunLight.add(lensflare);

  return { sunMesh, sunMat, coronaMat };
}
