/**
 * config.js - Archivio centralizzato costanti simulazione
 *
 * Tutti i parametri tunabili del debug panel sono definiti qui.
 * Usato come default e come formato per import/export JSON.
 */

const CONFIG = {

    /* ── Renderer ── */
    renderer: {
        exposure: 3,
        toneMapping: 'ACES Filmic'
    },

    /* ── Bloom (UnrealBloomPass) ── */
    bloom: {
        strength: 1.55,
        radius: 1.29,
        threshold: 0.25
    },

    /* ── Anamorphic Streak ── */
    streak: {
        strength: 0,
        threshold: 1.5
    },

    /* ── Cinematic Composite ── */
    cinematic: {
        grainIntensity: 0.03,
        vignetteIntensity: 2,
        aberrationStrength: 0.0023,
        colorGrading: 1.4
    },

    /* ── Camera / Controls ── */
    camera: {
        autoRotate: true,
        autoRotateSpeed: 2,
        dampingFactor: 0.3,
        fov: 86
    },

    /* ── Simulazione ── */
    simulation: {
        speedMultiplier: 0.4
    },

    /* ── Sole ── */
    sun: {
        lightIntensity: 800,
        glowOpacity: 1.0,       // moltiplicatore opacità glow layers
        rotationSpeed: 0.1
    },

    /* ── Stelle ── */
    starfield: {
        twinkleSpeed: 1.5,      // velocità scintillio
        fogDensity: 0.0008,
        visible: true
    },

    /* ── Vento Solare ── */
    solarWind: {
        speedMultiplier: 0.15,
        visible: true
    },

    /* ── Comete ── */
    comets: {
        spawnRate: 1.0,          // 1 = ~20s, 2 = ~10s, 0.5 = ~40s
        speedMultiplier: 1.0,
        trailOpacity: 0.4,
        visible: true
    },

    /* ── Fascia Asteroidi ── */
    asteroids: {
        rotationSpeed: 0.0001,
        visible: true
    },

    /* ── Quality Presets (sovrascrivono i valori sopra) ── */
    qualityUltra: {
        pixelRatioFull: true,    // usa devicePixelRatio pieno
        bloomStrength: 1.4,
        bloomRadius: 0.6,
        streakStrength: 0.6,
        grainIntensity: 0.03,
        aberrationStrength: 0.001
    },

    qualityNormal: {
        pixelRatioFull: false,
        bloomStrength: 1.0,
        bloomRadius: 0.4,
        streakStrength: 0.5,
        grainIntensity: 0.04,
        aberrationStrength: 0.0006
    }
};

export default CONFIG;
