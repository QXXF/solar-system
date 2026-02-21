/**
 * sun.js – Sole luminoso con shader custom + corona
 *
 * Il sole deve essere BRILLANTE – il centro è bianco-giallo caldo,
 * sfuma ad arancione/rosso ai bordi. Usa view-space Fresnel corretto.
 */
import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { sunTexture, createFlareTexture } from './textures.js';

export function createSun(scene) {
  /* ── Mesh sole ── */
  const sunGeo = new THREE.SphereGeometry(3, 64, 64);
  const sunMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTexture: { value: sunTexture(512) } },
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
        pos += normal * sin(pos.x * 4.0 + uTime) * cos(pos.y * 4.0 + uTime * 0.7) * 0.05;
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
        // Distorsione UV animata (effetto plasma)
        vec2 uv = vUv;
        uv.x += sin(uv.y * 10.0 + uTime * 0.5) * 0.015;
        uv.y += cos(uv.x * 8.0  + uTime * 0.3) * 0.015;
        vec4 tex = texture2D(uTexture, uv);

        // Pulsazione
        float pulse = 0.95 + 0.05 * sin(uTime * 2.0);

        // Colore base: la texture fornisce il gradiente radiale.
        // Moltiplichiamo per una tinta calda e rendiamo MOLTO luminoso.
        vec3 col = tex.rgb * vec3(1.2, 0.9, 0.5) * pulse;

        // Garantiamo un minimo di luminosità al centro
        // (la texture ha valori alti al centro, quindi col sarà alto)
        col = max(col, vec3(0.6, 0.3, 0.05));

        // Fresnel corretto con view direction
        float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
        // Bordo arancione-rosso (cromosfera)
        col += vec3(1.0, 0.4, 0.05) * pow(fresnel, 2.5) * 0.5;

        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sunMesh);

  /* ── Corona: glow esterno ── */
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true, side: THREE.BackSide, depthWrite: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vViewPos;
      void main() {
        vNormal = normalize(-(normalMatrix * normal)); // negato per BackSide
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        vViewPos = mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vViewPos;
      uniform float uTime;
      void main() {
        float facing = max(dot(vNormal, vViewDir), 0.0);
        float rim = 1.0 - facing;
        float intensity = pow(rim, 2.0);
        float flicker = 0.85 + 0.15 * sin(uTime * 3.0 + vViewPos.x * 2.0);
        vec3 col = mix(
          vec3(1.0, 0.7, 0.2),  // giallo-arancione
          vec3(1.0, 0.3, 0.0),  // rosso-arancione
          rim
        ) * flicker;
        gl_FragColor = vec4(col, intensity * 0.5);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(4.5, 32, 32), coronaMat));

  /* ── Point Light ── */
  const sunLight = new THREE.PointLight(0xfff5e0, 3.0, 1000, 0.4);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  /* ── Lens Flare ── */
  const lensflare = new Lensflare();
  const fBig = createFlareTexture(256, 255, 230, 170);
  const fSmall = createFlareTexture(128, 255, 200, 120);
  const fRing = createFlareTexture(128, 120, 170, 255);
  lensflare.addElement(new LensflareElement(fBig, 350, 0, new THREE.Color(1, 0.95, 0.8)));
  lensflare.addElement(new LensflareElement(fSmall, 100, 0.15, new THREE.Color(1, 0.85, 0.6)));
  lensflare.addElement(new LensflareElement(fRing, 60, 0.3, new THREE.Color(0.6, 0.7, 1)));
  lensflare.addElement(new LensflareElement(fSmall, 40, 0.6, new THREE.Color(1, 0.7, 0.4)));
  sunLight.add(lensflare);

  return { sunMesh, sunMat, coronaMat };
}
