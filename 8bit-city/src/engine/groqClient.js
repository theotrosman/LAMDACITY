import { CONFIG } from '../constants/config.js';

// ── Single global queue — enforces minimum delay between ALL calls ────────────
let _queue = [];
let _processing = false;

function enqueue(fn, priority = false) {
  return new Promise((resolve, reject) => {
    if (priority) _queue.unshift({ fn, resolve, reject });
    else _queue.push({ fn, resolve, reject });
    if (!_processing) _processQueue();
  });
}

async function _processQueue() {
  _processing = true;
  while (_queue.length > 0) {
    const { fn, resolve, reject } = _queue.shift();
    try { resolve(await fn()); }
    catch (e) { reject(e); }
    await new Promise(r => setTimeout(r, CONFIG.GROQ_CALL_DELAY_MS));
  }
  _processing = false;
}

async function callGroq(apiKey, model, messages, timeoutMs, maxTokens) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.85, max_tokens: maxTokens,
        response_format: { type: 'json_object' } }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Groq API error ${res.status}: ${await res.text()}`);
    return (await res.json()).choices[0].message.content;
  } finally { clearTimeout(t); }
}

function sanitizeEffect(raw) {
  if (!raw || typeof raw !== 'string') return 'generico';
  const first = raw.split('|')[0].trim().toLowerCase();
  return first || 'generico';
}

// ── LOCAL fast-path: handle common orders without calling Groq ───────────────
export function tryLocalOrder(order, allCitizens) {
  // Keep original for extracting explicit mention blocks like "[→ A, B]"
  const original = (order || '').toString();
  // Extract names from bracket mention syntax: [→ Name1, Name2]
  const bracketMatch = original.match(/\[→\s*([^\]]+)\]/);
  const bracketNames = bracketMatch ? bracketMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];

  // Normalize and strip mention/annotation fragments before matching
  let o = original.toLowerCase().replace(/\[.*?\]|<.*?>/g, '').replace(/→/g, '').trim();
  const oClean = o;

  // ── Eliminate specific cell type — checked FIRST to avoid kill-pattern false positives ──
  const elimMap = {
    estadio: 'stadium', estadios: 'stadium',
    parque: 'park', parques: 'park',
    hospital: 'hospital', hospitales: 'hospital',
    escuela: 'school', escuelas: 'school',
    mercado: 'market', mercados: 'market',
    fabrica: 'factory', fabricas: 'factory',
    bosque: 'forest', bosques: 'forest',
    lago: 'lake', lagos: 'lake',
    templo: 'temple', templos: 'temple',
    casa: 'residential', casas: 'residential', vivienda: 'residential', viviendas: 'residential',
    edificio: 'residential', edificios: 'residential',
    trabajo: 'work', oficina: 'work', oficinas: 'work',
    ruinas: 'ruins',
    granja: 'farm', granjas: 'farm',
    plaza: 'plaza', plazas: 'plaza',
    diversiones: 'amusement',
  };
  const elimMatch = oClean.match(/(?:elimina|destruye?|borra?|quita|demol[ei])\s+(?:todos?\s+(?:los?\s+)?)?(\w+)/);
  if (elimMatch) {
    const cellType = elimMap[elimMatch[1]];
    if (cellType) return _localResult({ eliminar_tipo: cellType, efecto: 'explosion',
      confirmacion: `✦ Todos los ${elimMatch[1]} han sido destruidos`, visual: `Los ${elimMatch[1]} explotan`, reaccion: 'panico' });
  }

  // ── Kill orders — checked AFTER elimMap so "elimina todos los estadios" is handled above ──
  // Handles: "matan todos", "ordeno que mueran", "mata a todos", "que mueran todos",
  //          "nube tóxica que mate a todos", "lluvia que mate", etc.
  const killAllPatterns = [
    // "mata/matar/mueran/extermina + todos/todo" — but NOT "elimina" (too ambiguous)
    /(?:mata|matar|muera[n]?|extermina)\s+(?:a\s+)?(?:todos|todo)/,
    // "elimina + todos/todo" only when followed by citizens/people words OR at end of string
    /elimina\s+(?:a\s+)?(?:todos|todo)\s*$|elimina\s+(?:a\s+)?todos\s+(?:los\s+)?(?:ciudadanos|personas|habitantes|aldeanos)/,
    /todos\s+(?:mueran|mueren|muertos|mueran)/,
    /ordeno\s+que\s+mueran/,
    /que\s+(?:todos\s+)?mueran/,
    /(?:mata|kill|destruye)\s+(?:a\s+)?(?:la\s+)?(?:ciudad|todos|todo)/,
    /(?:nube|gas|lluvia|veneno|plaga|virus|bomba).+(?:mat[ae]|muer[ae]|extermin|destruy)/,
    /(?:mat[ae]|muer[ae]|extermin|destruy).+(?:todos|todo|ciudad)/,
  ];
  if (killAllPatterns.some(p => p.test(oClean))) {
    return _localResult({
      matar_todos: true,
      efecto: 'explosion',
      confirmacion: '✦ Extinción total. Nadie sobrevive.',
      visual: 'Una ola de destrucción arrasa con todos',
      reaccion: 'panico',
    });
  }

  // ── Color orders ──────────────────────────────────────────────────────────
  const colorMap = {
    rosa: '#ffb7c5', sakura: '#ffb7c5', pink: '#ffb7c5',
    rojo: '#ff4040', red: '#ff4040',
    azul: '#4a8af8', blue: '#4a8af8',
    verde: '#50c878', green: '#50c878',
    amarillo: '#f5c842', yellow: '#f5c842',
    morado: '#c060ff', purple: '#c060ff', violeta: '#c060ff',
    naranja: '#ff9040', orange: '#ff9040',
    blanco: '#ffffff', white: '#ffffff',
    negro: '#111122', black: '#111122',
    dorado: '#ffd700', gold: '#ffd700',
    cian: '#40e0d0', cyan: '#40e0d0',
    gris: '#888899', gray: '#888899',
  };

  const grassColorMatch = oClean.match(/(?:pasto|hierba|c[eé]sped|grass)\s+(?:sea\s+|de\s+|color\s+)?(\w+)/);
  const skyColorMatch   = oClean.match(/(?:cielo|sky)\s+(?:sea\s+|de\s+|color\s+)?(\w+)/);
  // Building color — "edificios verdes", "casas rosas", "todos los edificios sean X"
  const buildingColorMatch = oClean.match(/(?:edificios?|casas?|buildings?|todo[s]?\s+(?:los?\s+)?edificios?)\s+(?:sean?\s+|de\s+|color\s+)?(\w+)/);
  // City color — attempt to catch variations like "que se vuelva rosa", "vuelva rosa", "vuelvan rosa", etc.
  const cityColorMatch  = oClean.match(/(?:ciudad|todo|pinta|ti[nñ]e|color|vuelv[ae]|vuelva|vuelvan|se\s+vuelv[ae]|vuelve)\s+(?:de\s+)?(\w+)/);

  if (grassColorMatch) {
    const col = colorMap[grassColorMatch[1]];
    if (col) return _localResult({ grass_color: col, efecto: 'magia',
      confirmacion: `✦ El pasto se vuelve ${grassColorMatch[1]}`, visual: 'La naturaleza cambia de color', reaccion: 'asombro' });
  }
  if (skyColorMatch) {
    const col = colorMap[skyColorMatch[1]];
    if (col) return _localResult({ sky_color: col, efecto: 'magia',
      confirmacion: `✦ El cielo se vuelve ${skyColorMatch[1]}`, visual: 'El firmamento cambia de color', reaccion: 'asombro' });
  }
  if (buildingColorMatch) {
    const col = colorMap[buildingColorMatch[1]];
    if (col) return _localResult({ building_color: col, efecto: 'magia',
      confirmacion: `✦ Los edificios se vuelven ${buildingColorMatch[1]}`, visual: 'Los edificios cambian de color mágicamente', reaccion: 'asombro' });
  }
  if (cityColorMatch) {
    const col = colorMap[cityColorMatch[1]];
    if (col) return _localResult({ color_override: col, efecto: 'magia',
      confirmacion: `✦ La ciudad se tiñe de ${cityColorMatch[1]}`, visual: 'Un manto de color cubre la ciudad', reaccion: 'asombro' });
  }

  // ── Per-target energy grants: "dale mucha energía a Nicolás" or bracket mentions [→ Nicolás]
  // Extract explicit names from common patterns
  const giveEnergyMatch = oClean.match(/(?:dale|da|otorga|entrega)\s+(?:mucha\s+|mucho\s+)?energ(?:[íi]a)(?:\s+(?:a|para)\s+([\wáéíóúñ]+))?/);
  const atMentions = [...original.matchAll(/@(\w+)/g)].map(m => m[1]);
  const explicitAName = giveEnergyMatch && giveEnergyMatch[1] ? [giveEnergyMatch[1]] : [];
  const nameCandidates = [...bracketNames, ...atMentions, ...explicitAName].filter(Boolean);
  if ((giveEnergyMatch && nameCandidates.length > 0) || (giveEnergyMatch && nameCandidates.length === 0 && /dale/.test(oClean))) {
    // Map names to citizen IDs
    const targets = [];
    for (const nm of nameCandidates) {
      const lower = nm.toLowerCase();
      const found = allCitizens.find(c => c.alive && (c.name.toLowerCase() === lower || c.name.toLowerCase().startsWith(lower.slice(0,3))));
      if (found) targets.push(found.id);
    }
    // If no explicit name, apply to everyone as a fallback
    if (targets.length === 0 && nameCandidates.length === 0) {
      // boost all
      return _localResult({ boost_todos: { e: 60 }, efecto: 'explosion',
        confirmacion: '✦ Una gran cantidad de energía ha sido canalizada, afectando a todos', visual: 'Una explosión de energía ilimitada', reaccion: 'celebracion' });
    }
    // Build cambios_atributos mapping
    const cambios = {};
    for (const id of targets) cambios[id] = { e: 80 };
    return _localResult({ cambios_atributos: cambios, efecto: 'explosion',
      confirmacion: `✦ Energía concedida a ${nameCandidates.join(', ')}`, visual: 'Una explosión de energía ilimitada', reaccion: 'asombro' });
  }

  // ── Reset colors ──────────────────────────────────────────────────────────
  if (/(?:quita|elimina|reset|normal|original)\s+(?:el\s+)?color/.test(o)) {
    return _localResult({ color_override: 'RESET', grass_color: 'RESET', sky_color: 'RESET',
      efecto: 'destello', confirmacion: '✦ Los colores vuelven a la normalidad', visual: 'Colores originales restaurados' });
  }

  // ── Theme / style transforms ──────────────────────────────────────────────
  // "aspecto medieval", "estilo medieval", "ciudad medieval", etc.
  if (/(?:aspecto|estilo|tema|look|modo)\s+medieval|ciudad\s+medieval|medieval/.test(o)) {
    return _localResult({
      celdas_masivas: 'all_residential', nuevo_tipo: 'temple',
      building_color: '#8b6914',
      grass_color: '#2a4a10',
      sky_color: '#1a1a2e',
      efecto: 'magia',
      confirmacion: '✦ La ciudad adopta un aspecto medieval',
      visual: 'Castillos y templos reemplazan los edificios modernos',
      reaccion: 'asombro',
    });
  }
  if (/(?:aspecto|estilo|tema)\s+apocaliptico|apocalipsis|post[- ]?apocaliptico/.test(o)) {
    return _localResult({
      celdas_masivas: 'all_cells', nuevo_tipo: 'ruins',
      sky_color: '#2a0a0a', grass_color: '#1a1a0a',
      efecto: 'explosion',
      confirmacion: '✦ La ciudad queda en ruinas post-apocalípticas',
      visual: 'El mundo se derrumba en cenizas',
      reaccion: 'panico',
    });
  }
  if (/(?:aspecto|estilo|tema)\s+tropical|tropical|isla|playa/.test(o)) {
    return _localResult({
      celdas_masivas: 'all_work', nuevo_tipo: 'park',
      grass_color: '#40c840', sky_color: '#4a8af8',
      efecto: 'arcoiris',
      confirmacion: '✦ La ciudad se convierte en un paraíso tropical',
      visual: 'Palmeras y playas rodean la ciudad',
      reaccion: 'celebracion',
    });
  }
  if (/(?:aspecto|estilo|tema)\s+(?:de\s+)?noche|ciudad\s+nocturna|modo\s+noche/.test(o)) {
    return _localResult({
      sky_color: '#050510', building_color: '#1a0a2a',
      efecto: 'destello',
      confirmacion: '✦ La ciudad entra en modo noche permanente',
      visual: 'Las luces de neón brillan en la oscuridad',
      reaccion: 'asombro',
    });
  }

  // ── Terrain transforms ────────────────────────────────────────────────────
  if (/(?:todo\s+(?:el\s+)?(?:piso|suelo|ciudad)\s+(?:sea\s+)?pasto|convierte?\s+(?:todo\s+)?en\s+pasto|ciudad\s+de\s+pasto)/.test(o)) {
    return _localResult({ celdas_masivas: 'all_cells', nuevo_tipo: 'park', grass_color: '#50c878',
      efecto: 'magia', confirmacion: '✦ La ciudad entera se convierte en un jardín', visual: 'Pasto y árboles brotan por todas partes', reaccion: 'asombro' });
  }
  if (/(?:todo\s+(?:sea\s+)?(?:ruinas?|destruido|escombros)|destruye?\s+(?:todo|la\s+ciudad))/.test(o)) {
    return _localResult({ celdas_masivas: 'all_cells', nuevo_tipo: 'ruins',
      efecto: 'explosion', confirmacion: '✦ La ciudad queda en ruinas', visual: 'Todo se derrumba', reaccion: 'panico' });
  }

  // ── Rural / nature transforms ─────────────────────────────────────────────
  if (/(?:ciudad\s+rural|rural|campo|aldea|pueblo\s+peque|naturaleza\s+pura|todo\s+(?:sea\s+)?(?:campo|bosque|naturaleza))/.test(o)) {
    return _localResult({ celdas_masivas: 'all_cells', nuevo_tipo: 'farm', grass_color: '#3a6a20',
      efecto: 'magia', confirmacion: '✦ La ciudad se convierte en un pueblo rural', visual: 'Granjas y campos reemplazan los edificios', reaccion: 'asombro' });
  }
  if (/(?:ciudad\s+(?:de\s+)?bosque|todo\s+(?:sea\s+)?bosque|selva)/.test(o)) {
    return _localResult({ celdas_masivas: 'all_cells', nuevo_tipo: 'forest', grass_color: '#1a3a10',
      efecto: 'magia', confirmacion: '✦ La ciudad se convierte en un bosque', visual: 'Árboles gigantes cubren todo', reaccion: 'asombro' });
  }
  if (/(?:ciudad\s+(?:del\s+)?futuro|futurista|cyberpunk|neo[- ]?ciudad)/.test(o)) {
    return _localResult({ celdas_masivas: 'all_residential', nuevo_tipo: 'work', sky_color: '#0a0a2e',
      efecto: 'rayo', confirmacion: '✦ La ciudad se transforma en metrópolis futurista', visual: 'Rascacielos de neón dominan el horizonte', reaccion: 'asombro' });
  }

  // ── Population ────────────────────────────────────────────────────────────
  const popMatch   = o.match(/(?:genera|crea|spawn|a[nñ]ade?|agrega?)\s+(\d+)\s+(?:aldeanos?|ciudadanos?|personas?|habitantes?)/);
  const setPopMatch = o.match(/(?:poblaci[oó]n|pop(?:ulacion)?)\s+(?:a\s+|=\s*|de\s+)?(\d+)/);
  const subePop    = o.match(/(?:sube|aumenta|incrementa)\s+(?:la\s+)?poblaci[oó]n\s+(?:a\s+)?(\d+)/);
  const popN = popMatch || setPopMatch || subePop;
  if (popN) {
    const n = parseInt(popN[1]);
    if (!isNaN(n) && n > 0) return _localResult({ nueva_poblacion: n, efecto: 'lluvia_objetos',
      confirmacion: `✦ La población se establece en ${n}`, visual: `${n} ciudadanos llenan la ciudad`, reaccion: 'celebracion' });
  }

  // ── Build specific cell type ──────────────────────────────────────────────
  const buildMap = {
    estadio: 'stadium', 'estadio de futbol': 'stadium', 'estadio de futbol': 'stadium',
    parque: 'park', hospital: 'hospital', escuela: 'school', mercado: 'market',
    bosque: 'forest', lago: 'lake', templo: 'temple',
    'parque de diversiones': 'amusement', diversiones: 'amusement',
    granja: 'farm', plaza: 'plaza',
  };
  const buildMatch = o.match(/(?:construye?|genera?|crea?|pon(?:er)?|a[nñ]ade?|agrega?)\s+(?:un[ao]?\s+)?(.+)/);
  if (buildMatch) {
    const what = buildMatch[1].trim();
    for (const [key, type] of Object.entries(buildMap)) {
      if (what.includes(key)) return _localResult({ construir_tipo: type,
        construir_cantidad: parseInt(what.match(/(\d+)/)?.[1] || '1'),
        efecto: 'destello', confirmacion: `✦ Construyendo ${key} en la ciudad`,
        visual: 'Nuevas estructuras emergen del suelo', reaccion: 'celebracion' });
    }
  }

  // ── Weather / atmosphere ──────────────────────────────────────────────────
  // Note: "lluvia que mate" is already caught by kill patterns above
  if (/(?:^lluvia$|^llueve$|^rain$|empieza\s+(?:a\s+)?llover|que\s+llueva)/.test(o)) {
    return _localResult({ toggle_rain: true, efecto: 'nieve',
      confirmacion: '✦ Comienza a llover', visual: 'Nubes oscuras cubren la ciudad' });
  }
  if (/(?:sol|soleado|despejado|para\s+(?:de\s+)?llover|deja\s+de\s+llover)/.test(o)) {
    return _localResult({ toggle_rain: false, efecto: 'destello',
      confirmacion: '✦ El sol brilla sobre la ciudad', visual: 'Las nubes se disipan' });
  }

  // ── Happiness / energy boosts ─────────────────────────────────────────────
  if (/(?:todos?\s+(?:sean?\s+)?felices?|fiesta|celebra(?:ci[oó]n)?|baile?\s+todos?)/.test(o)) {
    return _localResult({ boost_todos: { f: 40, e: 20 }, efecto: 'arcoiris',
      confirmacion: '✦ ¡Todos celebran con alegría!', visual: 'La ciudad estalla en fiesta', reaccion: 'baile' });
  }
  if (/(?:todos?\s+(?:est[eé]n?\s+)?(?:tristes?|lloren?|sufran?)|tristeza)/.test(o)) {
    return _localResult({ boost_todos: { f: -40 }, efecto: 'lluvia_objetos',
      confirmacion: '✦ Una ola de tristeza invade la ciudad', visual: 'Todos lloran', reaccion: 'llanto' });
  }
  if (/(?:todos?\s+(?:tengan?\s+)?(?:energ[ií]a|fuerza)|revive?\s+todos?)/.test(o)) {
    return _localResult({ boost_todos: { e: 60, h: -30 }, efecto: 'curacion',
      confirmacion: '✦ Energía divina recarga a todos', visual: 'Luz curativa envuelve la ciudad', reaccion: 'celebracion' });
  }

  // ── Repair / restore city ─────────────────────────────────────────────────
  if (/(?:arregla?|repara?|restaura?|reconstruye?|sana?)\s+(?:la\s+)?ciudad/.test(o)) {
    return _localResult({ celdas_masivas: 'all_cells', nuevo_tipo: 'residential',
      boost_todos: { e: 30, f: 20 }, efecto: 'curacion',
      confirmacion: '✦ La ciudad ha sido restaurada', visual: 'Nuevos edificios reemplazan las ruinas', reaccion: 'celebracion' });
  }

  return null; // Let Groq or feature generator handle it
}

function _localResult(fields) {
  return {
    ciudadanos_afectados: [],
    matar_ids: [],
    matar_todos: fields.matar_todos || false,
    tipo_de_efecto: sanitizeEffect(fields.efecto || 'generico'),
    descripcion_visual: fields.visual || 'Algo ocurre en la ciudad',
    duracion_en_ticks: 30,
    cambios_atributos: fields.cambios_atributos || {},
    reaccion_ciudadanos: fields.reaccion || 'ninguna',
    celdas_masivas: fields.celdas_masivas || 'ninguna',
    nuevo_tipo_masivo: fields.nuevo_tipo || null,
    color_override: fields.color_override || null,
    building_color: fields.building_color || null,
    grass_color: fields.grass_color || null,
    sky_color: fields.sky_color || null,
    nueva_poblacion: fields.nueva_poblacion || null,
    eliminar_tipo: fields.eliminar_tipo || null,
    construir_tipo: fields.construir_tipo || null,
    construir_cantidad: fields.construir_cantidad || 1,
    toggle_rain: fields.toggle_rain ?? null,
    boost_todos: fields.boost_todos || null,
    modificaciones_celda: [],
    cambios_mundo: {},
    noticia: '',
    mensaje_confirmacion: fields.confirmacion || 'Orden ejecutada.',
    _isLocal: true,
  };
}

// ── God Mode order — called only when local fast-path returns null ────────────
export async function interpretGodOrder(apiKey, model, order, selectedCitizens, allCitizens, cityInfo, worldVars) {
  const sys = `Ciudad pixel art. Dios omnipotente. Responde SOLO JSON válido:
{"afectados":[IDs],"matar_todos":false,"matar":[IDs],"efecto":"explosion|magia|curacion|rayo|lluvia_objetos|onda|destello|fuego|nieve|arcoiris|generico","visual":"descripcion breve","ticks":25,"atributos":{"ID":{"e":delta,"f":delta,"h":delta}},"reaccion":"panico|celebracion|confusion|huida|baile|llanto|asombro|ninguna","celdas_masivas":"all_residential|all_work|all_park|all_street|all_cells|ninguna","nuevo_tipo":"park|work|residential|street|amusement|market|hospital|school|factory|forest|lake|ruins|farm|temple|stadium|plaza","color_override":null,"grass_color":null,"sky_color":null,"nueva_poblacion":null,"celdas":[{"xy":"x,y","tipo":"park"}],"mundo":{"economia":0,"felicidad":0},"confirmacion":"descripcion de lo que paso"}
Reglas: matar→matar_todos:true. Sé dramático y literal. NO uses placeholders como <70ch>.`;

  const sel = selectedCitizens.slice(0, 5).map(c =>
    `${c.id}:${c.name}(${c.stage})E${Math.round(c.energy)}`
  ).join(',');
  const others = allCitizens.filter(c => !selectedCitizens.find(s => s.id === c.id))
    .slice(0, 8).map(c => `${c.id}:${c.name}`).join(',');

  const raw = await enqueue(() => callGroq(apiKey, model, [
    { role: 'system', content: sys },
    { role: 'user', content: `ORDEN:"${order}" Sel:[${sel||'todos'}] Otros:[${others}] ${cityInfo}` },
  ], CONFIG.GROQ_TIMEOUT_GOD, CONFIG.GROQ_MAX_TOKENS_GOD), true);

  const p = JSON.parse(raw);

  // Sanitize confirmacion — reject if it looks like a placeholder
  let confirmacion = p.confirmacion || 'Orden ejecutada.';
  if (confirmacion.includes('<') || confirmacion.includes('>') || confirmacion.length < 3) {
    confirmacion = 'Orden ejecutada en la ciudad.';
  }
  let visual = p.visual || 'Algo misterioso ocurre';
  if (visual.includes('<') || visual.includes('>') || visual.length < 3) {
    visual = 'Algo misterioso ocurre en la ciudad';
  }

  return {
    ciudadanos_afectados: (Array.isArray(p.afectados) ? p.afectados : []).map(Number),
    matar_ids: (Array.isArray(p.matar) ? p.matar : []).map(Number),
    matar_todos: p.matar_todos === true,
    tipo_de_efecto: sanitizeEffect(p.efecto),
    descripcion_visual: visual,
    duracion_en_ticks: Math.max(15, parseInt(p.ticks) || 25),
    cambios_atributos: p.atributos || {},
    reaccion_ciudadanos: p.reaccion || 'ninguna',
    celdas_masivas: p.celdas_masivas || 'ninguna',
    nuevo_tipo_masivo: p.nuevo_tipo || null,
    color_override: p.color_override || null,
    grass_color: p.grass_color || null,
    sky_color: p.sky_color || null,
    nueva_poblacion: p.nueva_poblacion != null ? parseInt(p.nueva_poblacion) : null,
    eliminar_tipo: null,
    construir_tipo: null,
    construir_cantidad: 1,
    toggle_rain: null,
    boost_todos: null,
    modificaciones_celda: Array.isArray(p.celdas) ? p.celdas : [],
    cambios_mundo: p.mundo || {},
    noticia: '',
    mensaje_confirmacion: confirmacion,
  };
}

// ── World event — 1 call every 600 ticks ─────────────────────────────────────
export async function generateWorldEvent(apiKey, model, citizens, worldVars, tick, recentTypes) {
  const era = worldVars.population_era || 'ancient';

  const sys = `Narrador épico de LAMDACITY era ${era}. UN evento dramático. JSON:
{"titulo":"TITULAR EN MAYUSCULAS","descripcion":"descripcion del evento","efecto":"explosion|magia|curacion|rayo|lluvia_objetos|onda|destello|fuego|nieve|arcoiris|generico","afectados":[IDs max4],"atributos":{"ID":{"e":d,"f":d}},"reaccion":"panico|celebracion|confusion|baile|asombro|llanto|ninguna","celdas":[{"xy":"x,y","tipo":"park|ruins|hospital|stadium|forest|lake|amusement"}],"mundo":{"economia":d,"felicidad":d,"contaminacion":d,"cultura":d},"tipo":"guerra|festival|desastre|descubrimiento|revolucion|epidemia|milagro"}
Eco:${Math.round(worldVars.economy)} Fel:${Math.round(worldVars.happiness)} Era:${era} Evita:${recentTypes.slice(0,2).join(',')||'-'}
NO uses placeholders. Escribe texto real y dramático.`;

  const pop = citizens.filter(c => c.alive).slice(0, 8)
    .map(c => `${c.id}:${c.name}`).join(',');

  const raw = await enqueue(() => callGroq(apiKey, model, [
    { role: 'system', content: sys },
    { role: 'user', content: `T:${tick} [${pop}]` },
  ], CONFIG.GROQ_TIMEOUT_EVENT, CONFIG.GROQ_MAX_TOKENS_EVENT));

  const p = JSON.parse(raw);
  return {
    titulo: p.titulo || 'ALGO OCURRIÓ EN LAMDACITY',
    descripcion: p.descripcion || '',
    tipo_de_efecto: sanitizeEffect(p.efecto),
    afectados_ids: Array.isArray(p.afectados) ? p.afectados.map(Number) : [],
    cambios_atributos: p.atributos || {},
    reaccion: p.reaccion || 'ninguna',
    modificaciones_celda: Array.isArray(p.celdas) ? p.celdas : [],
    cambios_mundo: p.mundo || {},
    tipo: p.tipo || 'evento',
  };
}

// ── Ask AI about a citizen's thoughts / reaction (optional, queued) ───────
export async function askCitizenQuestion(apiKey, model, citizen) {
  if (!apiKey) throw new Error('No API key');
  const sys = `Eres un analista corto y directo. Recibe datos de un ciudadano y responde SOLO JSON válido:
{"text":"respuesta corta","emotion":"miedo|tristeza|ira|alegria|confusion|asombro","movement":"quieto|caminar|correr|huir|deambular","deltas":{"e":-5,"f":-10}}
Explica en 1-3 frases cómo reaccionaría el ciudadano.`;
  const pop = `${citizen.id}:${citizen.name} stage:${citizen.stage} energy:${Math.round(citizen.energy)} hunger:${Math.round(citizen.hunger)} happiness:${Math.round(citizen.happiness)}`;
  try {
    const raw = await enqueue(() => callGroq(apiKey, model, [
      { role: 'system', content: sys },
      { role: 'user', content: `CITIZEN:${pop} DESCRIBE: ¿Por qué existo?` },
    ], CONFIG.GROQ_TIMEOUT_EVENT, CONFIG.GROQ_MAX_TOKENS_EVENT));
    try { return JSON.parse(raw); } catch { return { text: raw.slice(0,140), emotion: 'confusion', movement: 'deambular', deltas: {} }; }
  } catch (e) {
    throw e;
  }
}
