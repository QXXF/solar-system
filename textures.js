/**
 * textures.js - Generatori di texture procedurali
 *
 * Tutte le texture sono create via Canvas 2D, senza file esterni.
 */
import * as THREE from 'three';

const mix = (a, b, t) => a + (b - a) * t;

/** Crea una CanvasTexture tramite callback di disegno */
export function generateTexture(size, fn) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    fn(ctx, size);
    return new THREE.CanvasTexture(c);
}

/**
 * Texture pianeta: rumore sinusoidale composto che perturba HSL.
 *   n = mix( sin(x·f1)·cos(y·f2), sin(x·f3+y·f4), 0.5 )
 *   H/S/L di base ± perturbazione proporzionale a n
 */
export function planetTexture(size, baseHSL, noiseAmt = .15) {
    return generateTexture(size, (ctx, s) => {
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
            const i = (y * s + x) * 4;
            const n1 = Math.sin(x * .05) * Math.cos(y * .07) * .5 + .5;
            const n2 = Math.sin(x * .13 + y * .11) * .5 + .5;
            const n = mix(n1, n2, .5);
            const h = baseHSL[0] + (n - .5) * 20;
            const sat = baseHSL[1] + (n - .5) * noiseAmt * 40;
            const lum = baseHSL[2] + (n - .5) * noiseAmt * 60;
            const c = new THREE.Color().setHSL(h / 360, Math.max(0, Math.min(1, sat / 100)), Math.max(0, Math.min(1, lum / 100)));
            img.data[i] = c.r * 255; img.data[i + 1] = c.g * 255; img.data[i + 2] = c.b * 255; img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    });
}

/**
 * Texture sole: gradiente radiale + perturbazione.
 *   d = distanza dal centro → sfuma da bianco-giallo (centro) a rosso (bordi)
 */
export function sunTexture(size) {
    return generateTexture(size, (ctx, s) => {
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
            const i = (y * s + x) * 4;
            const cx = x / s - .5, cy = y / s - .5;
            const d = Math.sqrt(cx * cx + cy * cy) * 2;
            const n = Math.sin(x * .08 + y * .06) * Math.cos(y * .1 - x * .04) * .5 + .5;
            img.data[i] = Math.min(255, mix(255, 200, d) + n * 40);
            img.data[i + 1] = Math.min(255, mix(200, 80, d * 1.2) + n * 30);
            img.data[i + 2] = Math.min(255, Math.max(0, mix(50, 0, d) + n * 10));
            img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    });
}

/** Disco sfumato radiale per lens flare */
export function createFlareTexture(size, r, g, b) {
    return generateTexture(size, (ctx, s) => {
        const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
        grad.addColorStop(0.2, `rgba(${r},${g},${b},0.8)`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},0.3)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, s, s);
    });
}
