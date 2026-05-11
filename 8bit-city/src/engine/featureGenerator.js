/**
 * Feature Generator
 * 
 * When a god order requests something that doesn't exist (e.g. "crea una estatua"),
 * this module uses Groq to generate the implementation code, registers it in the
 * custom cell registry, and commits it to git.
 */

import { CONFIG } from '../constants/config.js';
import { registerCustomCell, exportAsCode, getAllCustomCells } from './customCellRegistry.js';

// ── Known cell types (built-in + custom) ─────────────────────────────────────
const BUILTIN_TYPES = new Set([
  'street','residential','work','park','amusement','market','hospital',
  'school','factory','forest','lake','ruins','farm','temple','stadium','plaza',
]);

// ── Detect if an order is requesting a new/unknown feature ───────────────────
export function detectNewFeature(order) {
  const o = order.toLowerCase().trim();

  // Skip orders that are clearly handled by local fast-path
  const skipPatterns = [
    /(?:mata|matar|muera|extermina)\s+(?:a\s+)?(?:todos|todo)/,
    /todos\s+(?:mueran|mueren)/,
    /ordeno\s+que\s+mueran/,
    /(?:pasto|hierba|cielo)\s+(?:de\s+)?(?:rosa|rojo|azul|verde|amarillo|morado|naranja|blanco|negro|dorado|cian|gris)/,
    /(?:lluvia|llueve|sol|soleado|despejado)/,
    /(?:todos?\s+(?:sean?\s+)?felices?|fiesta|tristeza)/,
    /(?:arregla?|repara?|restaura?)\s+(?:la\s+)?ciudad/,
    /(?:ciudad\s+rural|rural|campo|futurista|cyberpunk|medieval)/,
    /(?:poblaci[oó]n|spawn)\s+\d+/,
    /(?:elimina|destruye?)\s+(?:todos?\s+)?(?:estadios?|parques?|hospitales?|escuelas?|mercados?)/,
    // Skip if it's just a number of known structures
    /^(?:genera|crea|a[nñ]ade?)\s+\d+\s+(?:aldeanos?|ciudadanos?|personas?)/,
  ];
  if (skipPatterns.some(p => p.test(o))) return null;

  // Patterns that suggest creating something new
  const createPatterns = [
    /(?:crea?|construye?|a[nñ]ade?|agrega?|instala?)\s+(?:una?\s+)?(.+)/,
    /(?:quiero|necesito|hazme)\s+(?:una?\s+)?(.+)/,
    /(?:que\s+haya|que\s+exista)\s+(?:una?\s+)?(.+)/,
  ];

  for (const pattern of createPatterns) {
    const match = o.match(pattern);
    if (!match) continue;

    let what = match[1].trim()
      .replace(/\s+en\s+(?:la\s+)?ciudad.*$/, '')
      .replace(/\s+(?:gigante|enorme|peque[nñ]o|grande|verde|rojo|azul|rosa|dorado|negro|blanco)$/, '')
      .replace(/\s+(?:de\s+\w+)$/, '')
      .trim();

    // Take only first 2 words max to avoid overly specific labels
    what = what.split(/\s+/).slice(0, 2).join(' ').trim();

    if (!what || what.length < 2) continue;

    // Normalize to a cell type id (no spaces, no accents, no special chars)
    const cellId = what
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20);

    if (!cellId || cellId.length < 2) continue;

    // Skip built-in types
    if (BUILTIN_TYPES.has(cellId)) continue;

    // Skip common non-structure words
    const skipWords = new Set([
      'todos','todo','ciudad','pasto','hierba','cielo','color','lluvia','sol',
      'felices','tristes','energia','poblacion','aldeanos','ciudadanos',
      'estadios','parques','hospitales','escuelas','mercados','fabricas',
      'ruinas','casas','trabajo','oficinas','bosques','lagos','templos',
      'granjas','plazas','diversiones','nube','gas','veneno','plaga',
    ]);
    if (skipWords.has(cellId)) continue;

    // Check if already registered as custom
    const existing = getAllCustomCells().find(c =>
      c.id === cellId || c.label.toLowerCase() === what
    );
    if (existing) return { isNew: false, cellId: existing.id, label: existing.label };

    return { isNew: true, cellId, label: what, originalOrder: order };
  }
  return null;
}

// ── Generate implementation via Groq ─────────────────────────────────────────
export async function generateFeature(apiKey, model, cellId, label, originalOrder) {
  const CS = CONFIG.CELL_SIZE; // 40px

  // Use a simpler, more reliable prompt
  const sys = `Genera código canvas 2D para una celda pixel art 8-bit de tipo "${label}" (${CS}x${CS}px).
Responde SOLO con este JSON (sin texto extra):
{"id":"${cellId}","label":"${label}","emoji":"🏛","drawFn":"ctx.fillStyle='#1a1a2a';ctx.fillRect(px,py,CS,CS);","behaviorAction":"explorar","worldEffect":{"happiness":5,"culture":5},"eventTriggers":[{"condition":"tick % 300 === 0","effect":"magia","news":"Algo ocurre en ${label}","worldEffect":{"happiness":5}}],"confirmacion":"Nueva estructura creada","noticia":"Nueva estructura en la ciudad"}

IMPORTANTE: drawFn debe ser código JS válido que use: ctx, px, py, CS, tick, isNight.
Ejemplo real para "estatua":
ctx.fillStyle='#2a2a3a';ctx.fillRect(px,py,CS,CS);ctx.fillStyle='#888899';ctx.fillRect(px+CS/2-3,py+CS-14,6,14);ctx.fillStyle='#aaaacc';ctx.fillRect(px+CS/2-5,py+8,10,CS-20);if(isNight){ctx.fillStyle='rgba(245,200,66,0.3)';ctx.fillRect(px,py,CS,CS);}

eventTriggers: máximo 2 triggers. condition debe ser expresión JS simple usando solo la variable "tick" (ej: "tick % 200 === 0"). effect debe ser uno de: explosion|magia|curacion|rayo|lluvia_objetos|onda|destello|fuego|nieve|arcoiris|generico. worldEffect puede tener: happiness, economy, pollution, culture (deltas numéricos).

Crea algo visualmente interesante para "${label}" con colores oscuros/lofi y animaciones con tick.`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  let p = null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Crea la celda pixel art para: "${label}" (orden original: "${originalOrder}")` },
        ],
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const raw = data.choices[0].message.content;
    try {
      p = JSON.parse(raw);
    } catch (err) {
      throw new Error('Groq devolvió JSON inválido');
    }
  } catch (err) {
    console.warn(`[FeatureGen] Groq generation failed for "${label}": ${err.message}. Falling back to local generator.`);
    // Fallback local cell when Groq fails — simple but valid drawFn and metadata
    const fallbackDraw = `ctx.fillStyle='#2a1a3a';ctx.fillRect(px,py,CS,CS);ctx.fillStyle='#ffb7c5';ctx.fillRect(px+Math.round(CS*0.15),py+Math.round(CS*0.15),Math.round(CS*0.7),Math.round(CS*0.7));`;
    const fallback = {
      emoji: '✨',
      drawFn: fallbackDraw,
      behaviorAction: 'explorar',
      worldEffect: { happiness: 2, culture: 1 },
      eventTriggers: [],
      confirmacion: `✦ ${label} ha sido creado (fallback local)`,
      noticia: `Nueva estructura: ${label}`,
    };
    const cell = {
      id: cellId,
      label: label,
      emoji: fallback.emoji,
      drawFn: fallback.drawFn,
      behaviorAction: fallback.behaviorAction,
      worldEffect: fallback.worldEffect,
      eventTriggers: fallback.eventTriggers,
      confirmacion: fallback.confirmacion,
      noticia: fallback.noticia,
    };
    try { registerCustomCell(cell); } catch (e) { console.warn('[FeatureGen] register failed', e.message); }
    try { await commitToGit(cell, exportAsCode()); cell._committed = true; } catch { cell._committed = false; }
    clearTimeout(t);
    return cell;
  }

    // Robust fallback — if drawFn is missing, generate a simple colored tile
    const drawFn = p.drawFn || p.draw_fn || p.draw || p.code ||
      `ctx.fillStyle='#2a1a3a';ctx.fillRect(px,py,CS,CS);ctx.fillStyle='#c060ff';ctx.font=(CS*0.5)+'px serif';ctx.fillText('${(p.emoji||'✨')}',px+CS*0.2,py+CS*0.7);`;

    const cell = {
      id: cellId, // Always use our normalized id, not Groq's
      label: label,
      emoji: p.emoji || '✨',
      drawFn,
      behaviorAction: p.behaviorAction || p.behavior_action || 'explorar',
      worldEffect: p.worldEffect || p.world_effect || { happiness: 5, culture: 5 },
      eventTriggers: Array.isArray(p.eventTriggers) ? p.eventTriggers.slice(0, 2) : [],
      confirmacion: (p.confirmacion || `✦ ${label} ha aparecido en la ciudad`).replace(/<[^>]*>/g, ''),
      noticia: (p.noticia || `🏗 Nueva estructura: ${label}`).replace(/<[^>]*>/g, ''),
    };

    // Test compile the drawFn before registering
    try {
      // eslint-disable-next-line no-new-func
      new Function('ctx', 'px', 'py', 'CS', 'tick', 'isNight', cell.drawFn);
    } catch (compileErr) {
      // Fallback to simple tile if code is invalid
      console.warn(`[FeatureGen] drawFn compile error for "${label}", using fallback:`, compileErr.message);
      cell.drawFn = `ctx.fillStyle='#2a1a3a';ctx.fillRect(px,py,CS,CS);ctx.fillStyle='#c060ff';ctx.font=(CS*0.5)+'px serif';ctx.fillText('${cell.emoji}',px+CS*0.2,py+CS*0.7);`;
    }

    // Register in runtime registry
    registerCustomCell(cell);

    // Commit to git via dev server — get result to show in chat
    const commitResult = await commitToGit(cell, exportAsCode()).catch(() => ({ ok: false }));
    cell._committed = commitResult?.committed || false;

    clearTimeout(t);
    return cell;
  }

// ── Commit the new feature to git via Vite dev server endpoint ───────────────
export async function commitToGit(cell, code) {
  try {
    const res = await fetch('/api/commit-cell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cell, code }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.committed) {
        console.log(`[LAMDACITY] ✅ Committed to git: ${cell.label}`);
        return { ok: true, committed: true };
      } else {
        console.log(`[LAMDACITY] 📝 File written (${data.message})`);
        return { ok: true, committed: false };
      }
    }
    return { ok: false };
  } catch (e) {
    console.warn('[LAMDACITY] Dev server not running — cell saved to localStorage only');
    return { ok: false };
  }
}
