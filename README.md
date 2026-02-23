# 🌌 Solar System

Simulazione interattiva e cinematografica del sistema solare, realizzata in **HTML + CSS + JavaScript** con [Three.js](https://threejs.org/) via CDN. Nessun bundler, nessuna dipendenza da installare.

## ✨ Caratteristiche

### Corpi celesti
- **Sole** con shader volumetrico: ribollimento vertex, distorsione UV animata, corona Fresnel multi-layer
- **9 corpi celesti** con proporzioni corrette dei raggi (scala relativa alla Terra) e inclinazioni assiali realistiche
- **Orbite inclinate** rispetto all'eclittica secondo i dati astronomici reali
- **15 lune** con inclinazione orbitale rispetto al pianeta ospite (incluso Tritone retrogrado)
- **Shader dedicati** per Giove (bande atmosferiche + Grande Macchia Rossa) e Saturno (bande dorate + anello multi-banda con Cassini/Encke division)
- **Atmosfere** Fresnel doppio strato su tutti i pianeti

### Fasce di asteroidi
- **Fascia principale** — ~1500 particelle tra Marte e Giove
- **Fascia di Kuiper** — ~2000 particelle oltre Nettuno, con distribuzione più sparsa e colori freddi

### Effetti cinematografici
- Bloom (UnrealBloomPass) con god rays dal sole
- Anamorphic streak orizzontale
- Aberrazione cromatica, vignette, film grain
- ACES Filmic tone mapping
- 12.000 stelle con scintillio shader
- Vento solare e comete particellari

### UI e controlli
- OrbitControls con damping inerziale e auto-rotazione
- Camera POV: inquadratura su ogni pianeta dal menu laterale
- Debug panel completo (lil-gui) con import/export configurazione JSON
- Quality presets (Normal / Ultra)
- Label HTML con proiezione 3D→2D e opacità adattiva

---

## 🪐 Dati astronomici

### Proporzioni e inclinazioni dei pianeti

| Pianeta | Raggio (Terra=1) | Tilt assiale | Inclinazione orbitale |
|---------|:-:|:-:|:-:|
| Mercurio | 0.38 | 0.03° | 7.00° |
| Venere | 0.95 | 177.4° ↻ | 3.39° |
| Terra | 1.00 | 23.44° | 0° (rif.) |
| Marte | 0.53 | 25.19° | 1.85° |
| Giove | 2.80* | 3.13° | 1.31° |
| Saturno | 2.30* | 26.73° | 2.49° |
| Urano | 1.50* | 97.77° | 0.77° |
| Nettuno | 1.40* | 28.32° | 1.77° |
| Plutone | 0.18 | 119.6° ↻ | 17.16° |

*\* Raggi dei giganti gassosi compressi per leggibilità (valori reali: 11.2, 9.5, 4.0, 3.9).*

### Lune

| Luna | Pianeta | Inclinazione orbitale |
|------|---------|:-:|
| Luna | Terra | 5.15° |
| Phobos | Marte | 1.08° |
| Deimos | Marte | 1.79° |
| Io | Giove | 0.04° |
| Europa | Giove | 0.47° |
| Ganimede | Giove | 0.18° |
| Callisto | Giove | 0.19° |
| Titano | Saturno | 0.33° |
| Encelado | Saturno | 0.02° |
| Rhea | Saturno | 0.35° |
| Miranda | Urano | 4.34° |
| Ariel | Urano | 0.04° |
| Tritone | Nettuno | 156.8° ↻ |
| Proteo | Nettuno | 0.08° |
| Caronte | Plutone | 0.08° |

---

## 🚀 Avvio

Serve un server HTTP statico (i moduli ES non funzionano con `file://`).

```bash
# Opzione 1 — npx (nessuna installazione)
npx -y serve . -l 3000

# Opzione 2 — Python
python -m http.server 3000
```

Apri **http://localhost:3000** nel browser.

---

## 📁 Struttura

```
solar-system/
├── index.html          Entry point, import map Three.js via CDN
├── style.css           Layout fullscreen, loader, UI
├── main.js             Orchestratore: scene, animation loop, debug GUI
├── planets.js          Pianeti, lune, atmosfere, shader, fasce asteroidi
├── sun.js              Sole: shader volumetrico + corona multi-layer
├── starfield.js        12K stelle con scintillio
├── particles.js        Vento solare + sistema comete
├── postprocessing.js   Bloom, streak, composite (grain/vignette/aberr.)
├── textures.js         Generazione texture procedurali
├── camera-pov.js       Camera POV + menu pianeti
├── config.js           Parametri tunabili centralizzati
└── vercel.json         Configurazione deploy Vercel
```

---

## 🎮 Controlli

| Azione | Input |
|--------|-------|
| Ruota | Click sinistro + trascina |
| Pan | Click destro + trascina |
| Zoom | Rotella del mouse |
| Camera su pianeta | Click nel menu laterale |

---

## � Note tecniche

- **Orbite inclinate** — Ogni pianeta si muove su un piano orbitale inclinato rispetto all'eclittica usando una rotazione attorno all'asse X: `y = sin(θ) · sin(i) · r`, `z = sin(θ) · cos(i) · r`
- **Fresnel atmosferico** — `intensity = pow(1 − dot(N, V), esponente)` concentra l'alone ai bordi del disco
- **Distribuzione uniforme sfera** (starfield) — `φ = acos(2·rand − 1)` inverte la CDF per densità uniforme
- **Fasce asteroidi** — Particelle 2D (`THREE.Points`) con `sizeAttenuation` e `depthWrite: false` per massima performance

---

## 📜 Licenza

Progetto dimostrativo. Three.js è rilasciata sotto [licenza MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
