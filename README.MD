# 🏙 LAMDACITY — 8-bit City Simulation

Una simulación de ciudad pixel art lofi donde eres dios. Los ciudadanos viven, trabajan, se reproducen y mueren. Tú decides el resto.

---

## ¿Qué hace esto?

**LAMDACITY** es una simulación de ciudad generativa construida con React + Canvas 2D. Tiene ciudadanos con vidas propias, un motor de eventos narrativos impulsado por IA (Groq), y un modo dios donde puedes escribir cualquier orden en lenguaje natural y la ciudad obedece.

### Ciudadanos
- Cada ciudadano tiene nombre, trabajo, etapa de vida (infancia → vejez), energía, hambre y felicidad
- Se mueven por la ciudad buscando trabajo, comida, descanso y socialización
- Se reproducen, envejecen y mueren de forma autónoma
- Sus rutinas son 100% locales — sin llamadas a la IA para comportamiento individual

### Ciudad
- Grilla de 28×28 celdas con calles, edificios, parques, mercados, hospitales, estadios, templos, granjas, bosques, lagos y más
- La ciudad evoluciona sola: construye nuevos edificios, avanza de era (antigua → medieval → industrial → moderna → futura)
- Guerras, festivales, desastres y milagros ocurren automáticamente cada ~8 minutos reales

### Modo Dios (IA)
- Escribe cualquier orden en lenguaje natural: `"ciudad rosa"`, `"matan todos"`, `"genera 50 aldeanos"`, `"aspecto medieval"`, `"crea una estatua dorada"`
- Las órdenes simples se ejecutan instantáneamente sin llamar a la IA (fast-path local)
- Las órdenes complejas o narrativas van a Groq (llama-3.1-8b-instant)
- Si pides algo que no existe en el juego, la IA **genera el código de la nueva estructura en tiempo real**, la registra y la commitea al repo automáticamente

### Estructuras custom generadas por IA
- Cuando pides `"crea una estatua dorada"` o `"agrega un volcán"`, Groq genera el código canvas pixel art
- La nueva celda aparece en el mapa, tiene efectos en el mundo y eventos propios
- El código se guarda en `src/engine/customCells.js` y se commitea al repo

### Variables del mundo
- Economía, felicidad, contaminación, cultura, tecnología, crimen, naturaleza
- Cada evento y orden divina las afecta
- Influyen en el comportamiento de los ciudadanos y la evolución de la ciudad

---

## Stack

- **React 19** + **Vite 8** — UI y bundling
- **Canvas 2D** — renderizado pixel art sin WebGL
- **Groq API** (llama-3.1-8b-instant) — eventos narrativos y modo dios
- **localStorage** — persistencia de celdas custom entre sesiones
- **GitHub Actions** — automatización diaria de nuevas features generadas por IA

---

## Setup

```bash
cd 8bit-city
npm install
```

Crea un `.env` en `8bit-city/`:
```
VITE_GROQ_API_KEY=tu_api_key_de_groq
```

```bash
npm run dev
```

Abre `http://localhost:5173`, ingresa tu API key de Groq y dale Start.

---

## Automatización diaria

Cada día a las 3am UTC, un GitHub Action genera entre 1 y 8 nuevas features para la ciudad usando la IA. Cada feature incluye:
- Nueva celda pixel art con código canvas generado por IA
- Efectos visuales únicos (animaciones con `tick`, modo noche)
- Impacto en las variables del mundo
- Eventos propios que se disparan periódicamente

Las features se commitean automáticamente al repo en `src/engine/customCells.js`.

---

## Controles

| Acción | Control |
|--------|---------|
| Zoom | Rueda del mouse |
| Mover mapa | Alt + drag |
| Seleccionar ciudadanos | Drag en el mapa |
| Orden divina | Escribir en el chat derecho |
| Pausa/Resume | Botón en panel izquierdo |
| Velocidad | Slider 1x–8x |

---

## Arquitectura

```
src/
├── engine/
│   ├── simulationEngine.js   — motor principal, tick loop, god mode
│   ├── citizenManager.js     — ciclo de vida de ciudadanos
│   ├── cityGenerator.js      — generación procedural de la ciudad
│   ├── groqClient.js         — cliente Groq con queue y fast-path local
│   ├── featureGenerator.js   — generación de nuevas celdas con IA
│   ├── customCellRegistry.js — registro runtime de celdas custom
│   ├── customCells.js        — celdas custom persistidas (auto-generado)
│   ├── newsSystem.js         — sistema de noticias narrativas
│   └── featureGenerator.js   — detección y generación de features nuevas
├── renderer/
│   ├── cityRenderer.js       — renderizado canvas de la ciudad
│   └── spriteSystem.js       — sprites de ciudadanos
├── components/
│   ├── GodChat.jsx           — interfaz modo dios + noticias
│   ├── SimCanvas.jsx         — canvas principal con zoom/pan/selección
│   ├── Controls.jsx          — controles de simulación
│   └── StatsPanel.jsx        — estadísticas y lista de ciudadanos
└── constants/
    ├── config.js             — configuración global
    └── palette.js            — paleta de colores pixel art
```

---

*Vibecoded con amor y sin planificación. Si algo se rompe, es un feature.*
