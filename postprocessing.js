/**
 * postprocessing.js – Pipeline cinematografica anamorphic hi-end
 *
 * Pipeline:
 *   1. RenderPass → render scena base
 *   2. UnrealBloomPass → glow (god rays dal sole)
 *   3. Anamorphic Streak → flare orizzontali stile lente anamorfica
 *   4. Film Grain + Vignette + Chromatic Aberration + Color Grading
 *
 * Quality toggle: 'normal' (default) / 'ultra' (più forte)
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ── Anamorphic Streak Pass ──
 * Estrae pixel luminosi, li sfoca orizzontalmente e li somma.
 * Simula lo streak tipico delle lenti anamorfiche (es. Panavision).
 *
 * Tecnica:
 *   1. Threshold: estrae solo pixel HDR > soglia
 *   2. Blur orizzontale a kernel largo (13 tap) con pesi gaussiani
 *   3. Composizione additiva con il frame originale
 */
const AnamorphicStreakShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2() },
    uStrength: { value: 0.5 },
    uThreshold: { value: 0.7 }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uStrength;
    uniform float uThreshold;
    varying vec2 vUv;

    void main() {
      vec4 orig = texture2D(tDiffuse, vUv);
      // Luminanza percettiva
      float luma = dot(orig.rgb, vec3(0.2126, 0.7152, 0.0722));

      // Estrai solo pixel sopra soglia
      vec3 bright = max(orig.rgb - uThreshold, 0.0);

      // Blur orizzontale (13 campioni pesati gaussiani)
      vec3 streak = vec3(0.0);
      float texelX = 1.0 / uResolution.x;
      float weights[7];
      weights[0] = 0.2;
      weights[1] = 0.17;
      weights[2] = 0.13;
      weights[3] = 0.09;
      weights[4] = 0.06;
      weights[5] = 0.03;
      weights[6] = 0.015;

      for (int i = 0; i < 7; i++) {
        float off = float(i) * texelX * 4.0;
        vec3 s1 = max(texture2D(tDiffuse, vUv + vec2(off, 0.0)).rgb - uThreshold, 0.0);
        vec3 s2 = max(texture2D(tDiffuse, vUv - vec2(off, 0.0)).rgb - uThreshold, 0.0);
        streak += (s1 + s2) * weights[i];
      }

      // Tinta leggermente calda alle streak
      streak *= vec3(1.0, 0.85, 0.7);

      gl_FragColor = vec4(orig.rgb + streak * uStrength, 1.0);
    }
  `
};

/* ── Cinematic Composite Pass ──
 * Combina: film grain + vignette + chromatic aberration + color grading
 *
 * Color Grading:
 *   Lift-Gamma-Gain semplificato + teal/orange split toning:
 *     shadows  → teal  (0.05, 0.1, 0.15) nelle ombre
 *     highlights → warm (0.1, 0.05, -0.05) nelle luci
 *   Approssimazione: mix in base alla luminanza del pixel.
 *
 * Film Grain:
 *   Rumore pseudo-random basato su UV + tempo:
 *     noise = fract(sin(dot(uv · t, vec2(12.9898, 78.233))) · 43758.5453)
 *   Questa è la classica funzione hash per random su GPU.
 *
 * Vignette:
 *   col *= 1 − pow(dist, 2.2) · intensity
 *   L'esponente 2.2 (≈ gamma) crea un falloff più cinematografico.
 *
 * Aberrazione cromatica:
 *   Campionamento R/G/B a UV offset radiale, più forte ai bordi.
 */
const CinematicCompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrainIntensity: { value: 0.04 },
    uVignetteIntensity: { value: 0.8 },
    uAberationStrength: { value: 0.0006 },
    uColorGrading: { value: 0.7 }
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrainIntensity;
    uniform float uVignetteIntensity;
    uniform float uAberationStrength;
    uniform float uColorGrading;
    varying vec2 vUv;

    // Hash function per film grain
    float random(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float dist = length(center);

      // ── Chromatic Aberration ──
      float aberration = uAberationStrength * (1.0 + dist * 2.0);
      float r = texture2D(tDiffuse, uv + center * aberration).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - center * aberration).b;
      vec3 col = vec3(r, g, b);

      // ── Color Grading (teal/orange split toning) ──
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.03, 0.07, 0.12);   // teal nelle ombre
      vec3 highlightTint = vec3(0.08, 0.04, -0.02); // warm nelle luci
      float shadowMask = 1.0 - smoothstep(0.0, 0.5, luma);
      float highlightMask = smoothstep(0.5, 1.0, luma);
      col += shadowTint * shadowMask * uColorGrading;
      col += highlightTint * highlightMask * uColorGrading;

      // Leggero boost contrasto (S-curve morbida)
      // CRITICO: clamp a [0,1] prima del polinomio, altrimenti
      // x²(3-2x) produce 0 per x>1 (distruggendo le aree HDR!)
      vec3 ldr = clamp(col, 0.0, 1.0);
      vec3 curved = ldr * ldr * (3.0 - 2.0 * ldr);
      col = mix(col, curved, 0.3);

      // ── Vignette (falloff cinematografico) ──
      col *= 1.0 - pow(dist, 2.2) * uVignetteIntensity;

      // ── Film Grain ──
      float grain = random(uv * uTime) * 2.0 - 1.0;
      col += grain * uGrainIntensity;

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

/**
 * Inizializza pipeline e restituisce oggetti controllabili.
 * @returns {{ composer, bloomPass, streakPass, compositePass, setQuality }}
 */
export function initPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Bloom
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.0, 0.4, 0.35
  );
  composer.addPass(bloomPass);

  // Anamorphic streaks
  const streakPass = new ShaderPass(AnamorphicStreakShader);
  streakPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  composer.addPass(streakPass);

  // Cinematic composite (grain + vignette + CA + color grading)
  const compositePass = new ShaderPass(CinematicCompositeShader);
  composer.addPass(compositePass);

  /** Quality presets */
  function setQuality(level) {
    if (level === 'ultra') {
      renderer.setPixelRatio(window.devicePixelRatio);
      bloomPass.strength = 1.4;
      bloomPass.radius = 0.6;
      streakPass.uniforms.uStrength.value = 0.6;
      compositePass.uniforms.uGrainIntensity.value = 0.03;
      compositePass.uniforms.uAberationStrength.value = 0.001;
    } else {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      bloomPass.strength = 1.0;
      bloomPass.radius = 0.4;
      streakPass.uniforms.uStrength.value = 0.5;
      compositePass.uniforms.uGrainIntensity.value = 0.04;
      compositePass.uniforms.uAberationStrength.value = 0.0006;
    }
  }

  return { composer, bloomPass, streakPass, compositePass, setQuality };
}
