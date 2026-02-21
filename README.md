# 🌌 Solar System - Three.js Demo

Demo interattiva del sistema solare realizzata in **HTML + CSS + JavaScript** puro, con [Three.js](https://threejs.org/) caricata via CDN.

---

## Screenshot

![Solar System](https://img.shields.io/badge/status-running-brightgreen) ![Three.js](https://img.shields.io/badge/Three.js-0.170-blue)

---

## 🚀 Come lanciare

### Prerequisito

Un qualsiasi **server HTTP statico** (i moduli ES non funzionano aprendo il file direttamente con `file://`).

### Opzione 1 - npx (nessuna installazione)

```bash
npx -y serve . -l 3000
```

Apri il browser su **http://localhost:3000**

### Opzione 2 - Python

```bash
python -m http.server 3000
```

### Opzione 3 - VS Code

Installa l'estensione **Live Server** e clicca "Go Live" in basso a destra.

---

## 📁 Struttura del progetto

```
solar-system/
  ├── index.html     ← Entry point, import map Three.js via CDN
  ├── style.css      ← Reset, canvas fullscreen, loader minimale
  ├── main.js        ← Tutta la logica Three.js (~600 righe, documentato)
  └── README.md
```

Nessuna dipendenza da installare. Nessun bundler. Tutto gira dal browser.

---

## 🪐 Cosa contiene

| Feature | Descrizione |
|---------|-------------|
| **Sole** | Shader custom con deformazione vertex (ribollimento), distorsione UV animata, effetto Fresnel al bordo |
| **Corona solare** | Sfera `BackSide` trasparente con glow Fresnel + flicker temporale |
| **8 pianeti** | Texture procedurali (rumore sinusoidale HSL), rotazione assiale, orbita circolare |
| **Atmosfere** | Fresnel shader su Terra, Venere, Marte, Urano, Nettuno |
| **Anelli** | Saturno e Urano - texture a bande procedurali con remapping UV radiale |
| **Lune** | Terra (Luna), Giove (4 galileiane), Saturno (Titano, Rea) |
| **Fascia asteroidi** | 1500 particelle distribuite in un toro tra Marte e Giove |
| **Starfield** | 12.000 stelle con distribuzione sferica uniforme e scintillio shader |
| **Bloom** | UnrealBloomPass - god rays dal sole, threshold 0.4 |
| **Vignette** | Scurimento ai bordi dello schermo (dist² × 0.85) |
| **Aberrazione cromatica** | Separazione R/G/B proporzionale alla distanza dal centro |
| **ACES tone mapping** | Curva cinematografica per neri profondi e highlight morbidi |
| **Label HTML** | Nomi dei pianeti proiettati 3D → 2D con opacità adattiva |
| **Controlli** | OrbitControls con damping inerziale e auto-rotazione |
| **Loader** | Barra di progresso minimale 0→100% durante l'inizializzazione |

---

## 🔬 Formule matematiche principali

Il codice è documentato in italiano per ogni formula. Ecco un riepilogo:

### Distribuzione uniforme sulla sfera (starfield)

```
θ = random() · 2π
φ = acos(2 · random() − 1)
x = r · sin(φ) · cos(θ)
y = r · sin(φ) · sin(θ)
z = r · cos(φ)
```

`acos(2·rand−1)` inverte la CDF di cos(φ), garantendo densità uniforme sulla superficie invece di concentrarsi ai poli.

### Effetto Fresnel (atmosfere, corona)

```
intensity = pow(k − dot(N, V), esponente)
```

`dot(N, V) ≈ 1` al centro del disco, `≈ 0` ai bordi. Invertendo e alzando a potenza si ottiene un alone concentrato sul bordo, simulando la diffusione atmosferica.

### Orbita circolare

```
angle += speed · dt
x = cos(angle) · raggio
z = sin(angle) · raggio
```

Parametrizzazione standard del cerchio. L'incremento angolare è proporzionale alla velocità orbitale.

### Bloom (UnrealBloomPass)

Threshold → blur gaussiano multi-risoluzione → composizione additiva. Solo i pixel con luminanza > 0.4 generano il glow.

### Aberrazione cromatica

```
R = texture(uv + offset)
G = texture(uv)
B = texture(uv − offset)
offset = (uv − 0.5) · 0.0012
```

I tre canali vengono letti a coordinate leggermente diverse, separando i colori ai bordi.

---

## 🎮 Controlli

| Azione | Input |
|--------|-------|
| **Ruota** | Click sinistro + trascina |
| **Pan** | Click destro + trascina |
| **Zoom** | Rotella del mouse |

La scena ruota automaticamente molto lentamente (0.15 °/s).

---

## 🛠 Personalizzazione

Per aggiungere un pianeta, basta una chiamata ad `addPlanet()` in `main.js`:

```js
addPlanet({
  name: 'Pluto',
  radius: 0.3,
  orbitR: 80,
  speed: 0.004,
  rotSpeed: 0.008,
  hsl: [30, 15, 45],
  hasAtmo: false
});
```

---

## 📜 Licenza

Progetto dimostrativo. Three.js è rilasciata sotto licenza MIT.
