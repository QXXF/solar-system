# Solar System

Simulazione **interattiva e cinematografica del Sistema Solare** realizzata in **HTML, CSS e JavaScript**, basata su Three.js via CDN.
Non richiede bundler né installazioni: basta un semplice server statico.

---

## Funzionalità

### 🪐 Corpi Celesti

* **Sole volumetrico** con:

  * Bubble vertex animato
  * Distorsione UV dinamica
  * Corona Fresnel multi-layer
* **9 pianeti** con:

  * Proporzioni corrette dei raggi (scala relativa alla Terra)
  * Inclinazioni assiali realistiche
  * Orbite inclinate secondo dati astronomici reali
* **15 lune**, incluse orbite inclinate rispetto al pianeta ospite
  (presente anche **Tritone retrogrado**)
* **Shader personalizzati**:

  * Giove → bande atmosferiche + Grande Macchia Rossa
  * Saturno → bande dorate + anelli multi-banda con divisioni di Cassini ed Encke
* **Atmosfere Fresnel doppio strato** su tutti i pianeti

---

### ☄️ Fasce di Asteroidi

* **Fascia Principale**
  ~1500 particelle tra Marte e Giove
* **Fascia di Kuiper**
  ~2000 particelle oltre Nettuno, distribuzione più rarefatta e tonalità fredde

---

### Effetti Cinematografici

* Bloom (UnrealBloomPass) con god rays solari
* Streak anamorfici orizzontali
* Aberrazione cromatica
* Vignettatura e film grain
* Tone mapping ACES Filmic
* 12.000 stelle con shader di scintillio
* Sistema particellare per vento solare e comete

---

### Interfaccia & Controlli

* OrbitControls con:

  * Damping inerziale
  * Auto-rotazione
* Modalità **Camera POV** per inquadrature dedicate a ogni pianeta
* Menu laterale di navigazione
* Debug panel completo (lil-gui)

  * Import / Export configurazione JSON
* Preset qualità: **Normal / Ultra**
* Label HTML con proiezione 3D → 2D e opacità adattiva

---

## Dati Astronomici

### Pianeti — Proporzioni e Inclinazioni

| Pianeta  | Raggio (Terra=1) | Tilt assiale | Inclinazione orbitale |
| -------- | :--------------: | :----------: | :-------------------: |
| Mercurio |       0.38       |     0.03°    |         7.00°         |
| Venere   |       0.95       |   177.4° ↻   |         3.39°         |
| Terra    |       1.00       |    23.44°    |       0° (rif.)       |
| Marte    |       0.53       |    25.19°    |         1.85°         |
| Giove    |       2.80*      |     3.13°    |         1.31°         |
| Saturno  |       2.30*      |    26.73°    |         2.49°         |
| Urano    |       1.50*      |    97.77°    |         0.77°         |
| Nettuno  |       1.40*      |    28.32°    |         1.77°         |
| Plutone  |       0.18       |   119.6° ↻   |         17.16°        |

* I raggi dei giganti gassosi sono stati compressi per leggibilità
(valori reali: 11.2, 9.5, 4.0, 3.9).

---

### Lune

| Luna     | Pianeta | Inclinazione orbitale |
| -------- | ------- | :-------------------: |
| Luna     | Terra   |         5.15°         |
| Phobos   | Marte   |         1.08°         |
| Deimos   | Marte   |         1.79°         |
| Io       | Giove   |         0.04°         |
| Europa   | Giove   |         0.47°         |
| Ganimede | Giove   |         0.18°         |
| Callisto | Giove   |         0.19°         |
| Titano   | Saturno |         0.33°         |
| Encelado | Saturno |         0.02°         |
| Rhea     | Saturno |         0.35°         |
| Miranda  | Urano   |         4.34°         |
| Ariel    | Urano   |         0.04°         |
| Tritone  | Nettuno |        156.8° ↻       |
| Proteo   | Nettuno |         0.08°         |
| Caronte  | Plutone |         0.08°         |

---

## Avvio del Progetto

È necessario un server HTTP statico (i moduli ES non funzionano con `file://`).

```bash
# Opzione 1 — npx (senza installazioni)
npx -y serve . -l 3000

# Opzione 2 — Python
python -m http.server 3000
```

Apri nel browser:

```
http://localhost:3000
```

---

## Struttura del Progetto

```
solar-system/
├── index.html          Entry point + import map Three.js via CDN
├── style.css           Layout fullscreen, loader, UI
├── main.js             Setup scena e animation loop
├── planets.js          Pianeti, lune, shader, fasce asteroidi
├── sun.js              Shader volumetrico + corona
├── starfield.js        Campo stellare (12K stelle)
├── particles.js        Vento solare + comete
├── postprocessing.js   Bloom, streak, compositing
├── textures.js         Texture procedurali
├── camera-pov.js       Sistema Camera POV
├── config.js           Parametri centralizzati
└── vercel.json         Configurazione deploy
```

---

## Controlli

| Azione            | Input                     |
| ----------------- | ------------------------- |
| Ruota             | Click sinistro + trascina |
| Pan               | Click destro + trascina   |
| Zoom              | Rotella mouse             |
| Camera su pianeta | Click nel menu laterale   |

---

## Note Tecniche

**Orbite inclinate**
Ogni pianeta orbita su un piano inclinato rispetto all’eclittica tramite rotazione sull’asse X:

```
y = sin(θ) · sin(i) · r  
z = sin(θ) · cos(i) · r
```

**Fresnel atmosferico**

```
intensity = pow(1 − dot(N, V), esponente)
```

Concentra l’alone luminoso ai bordi del disco planetario.

**Distribuzione uniforme su sfera (starfield)**

```
φ = acos(2·rand − 1)
```

Inversione della CDF per ottenere densità uniforme.

**Fasce asteroidali**

* Implementate con `THREE.Points`
* `sizeAttenuation` attivo
* `depthWrite: false`
* Ottimizzate per performance elevate

---

## Licenza

Progetto dimostrativo.
Three.js è distribuita sotto licenza MIT.
