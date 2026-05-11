import { CONFIG } from '../constants/config.js';
import { generateCity, findPath, findNearest, getCellsOfType } from './cityGenerator.js';
import { createInitialPopulation, createCitizen, resetIdCounter, updateCitizenAge, shouldDie, canReproduce, reproduce, applyBehaviorEffect, decayAttributes } from './citizenManager.js';
import { interpretGodOrder, generateWorldEvent, tryLocalOrder } from './groqClient.js';
import { NewsSystem } from './newsSystem.js';
import { createRNG, randomInt, randomChoice } from '../utils/rng.js';
import { loadCustomCells, getAllCustomCells, hasCustomCell, getCustomCellEventTriggers } from './customCellRegistry.js';
import { detectNewFeature, generateFeature } from './featureGenerator.js';
import { askCitizenQuestion } from './groqClient.js';

const { CELL, STAGE } = CONFIG;

// ── 100% LOCAL behavior system — zero API calls for citizens ─────────────────
// Behaviors are driven by: job, stage, time of day, world variables, needs

const JOB_BEHAVIORS = {
  médico:      ['trabajar','trabajar','comer','socializar','descansar','trabajar'],
  maestro:     ['trabajar','trabajar','leer','comer','socializar','caminar'],
  ingeniero:   ['trabajar','trabajar','leer','comer','explorar','descansar'],
  artista:     ['explorar','trabajar','socializar','caminar','leer','comer'],
  comerciante: ['trabajar','comprar','socializar','comer','trabajar','caminar'],
  agricultor:  ['trabajar','trabajar','comer','descansar','caminar','trabajar'],
  constructor: ['trabajar','trabajar','comer','descansar','caminar','trabajar'],
  cocinero:    ['trabajar','trabajar','comer','socializar','comprar','descansar'],
  músico:      ['trabajar','socializar','explorar','jugar','comer','caminar'],
  científico:  ['trabajar','leer','explorar','trabajar','comer','descansar'],
  policía:     ['caminar','trabajar','caminar','comer','trabajar','descansar'],
  bombero:     ['trabajar','descansar','jugar','comer','socializar','trabajar'],
  periodista:  ['explorar','trabajar','socializar','caminar','leer','comer'],
  abogado:     ['trabajar','leer','trabajar','comer','socializar','descansar'],
  arquitecto:  ['trabajar','explorar','leer','comer','trabajar','descansar'],
  mecánico:    ['trabajar','trabajar','comer','descansar','caminar','trabajar'],
  jardinero:   ['trabajar','caminar','explorar','comer','descansar','trabajar'],
  chef:        ['trabajar','comprar','trabajar','comer','socializar','descansar'],
  programador: ['trabajar','leer','trabajar','comer','descansar','explorar'],
  diseñador:   ['trabajar','explorar','leer','comer','socializar','caminar'],
  default:     ['caminar','trabajar','comer','socializar','descansar','caminar'],
};

const STAGE_BEHAVIORS = {
  infancia: ['jugar','jugar','comer','explorar','socializar','dormir','jugar','caminar'],
  juventud: ['caminar','trabajar','socializar','explorar','comer','jugar','leer','descansar'],
  adultez:  ['trabajar','trabajar','comer','socializar','caminar','descansar','trabajar','dormir'],
  vejez:    ['caminar','leer','socializar','descansar','comer','leer','caminar','dormir'],
};

const BEHAVIOR_DESCRIPTIONS = {
  trabajar:   ['Trabajando duro','En la oficina','Reunión de trabajo','Terminando el turno','Jornada laboral'],
  comer:      ['Almorzando','Desayunando','Cenando','Comiendo en el parque','Merienda rápida'],
  dormir:     ['Durmiendo profundo','Siesta reparadora','Descansando en casa','Noche de sueño'],
  socializar: ['Charlando con vecinos','Reunión con amigos','Conversando en la plaza','Café con colegas'],
  caminar:    ['Paseando por la ciudad','Caminando al trabajo','Explorando el barrio','Paseo matutino'],
  explorar:   ['Descubriendo rincones','Explorando la ciudad','Aventura urbana','Recorriendo calles'],
  descansar:  ['Relajándose en casa','Tarde libre','Descansando','Momento de paz'],
  jugar:      ['Jugando en el parque','Partido de fútbol','Juegos con amigos','Diversión'],
  leer:       ['Leyendo el diario','En la biblioteca','Estudiando','Leyendo un libro'],
  comprar:    ['Haciendo compras','En el mercado','Comprando víveres','De shopping'],
};

function getLocalBehavior(rng, citizen, dayPhase) {
  // Need-based override
  if (citizen.energy < 20) return { action: 'dormir', duration: randomInt(rng, 15, 25), description: 'Agotado, necesita descansar' };
  if (citizen.hunger > 80) return { action: 'comer', duration: randomInt(rng, 8, 14), description: 'Hambre urgente' };

  // Time of day influence
  if (dayPhase < 0.1 || dayPhase > 0.85) { // night
    return { action: 'dormir', duration: randomInt(rng, 18, 28), description: 'Durmiendo de noche' };
  }

  // Stage-based pool
  const stagePool = STAGE_BEHAVIORS[citizen.stage] || STAGE_BEHAVIORS.adultez;
  // Job-based pool
  const jobPool = JOB_BEHAVIORS[citizen.job] || JOB_BEHAVIORS.default;

  // Mix: 60% job, 40% stage
  const pool = rng() < 0.6 ? jobPool : stagePool;
  const action = randomChoice(rng, pool);
  const descs = BEHAVIOR_DESCRIPTIONS[action] || ['...'];
  const description = randomChoice(rng, descs);
  const duration = randomInt(rng, 10, 22);

  return { action, duration, description };
}

// ── World state — civilization variables ─────────────────────────────────────
const DEFAULT_WORLD = {
  economy: 50, happiness: 60, pollution: 20, culture: 40,
  technology: 30, crime: 10, nature: 60,
  // Civilization
  population_era: 'ancient',   // ancient → medieval → industrial → modern → future
  at_war: false,
  war_tick: 0,
  districts: [],               // named districts that form over time
  constructions: [],           // ongoing building projects
  era_progress: 0,             // 0-100, advances era
};

export class SimulationEngine {
  constructor(onStateUpdate, onGodResponse) {
    this.onStateUpdate = onStateUpdate;
    this.onGodResponse = onGodResponse;
    this.running = false;
    this.paused = false;
    this.speed = 1;
    this.tick = 0;
    this.city = null;
    this.citizens = [];
    this.rng = null;
    this.seed = null;
    this.apiKey = '';
    this.model = CONFIG.GROQ_MODEL_DEFAULT;
    this.worldVars = { ...DEFAULT_WORLD };
    this.stats = { totalBirths: 0, totalDeaths: 0, groqCalls: 0, groqErrors: 0 };
    this.effects = [];
    this.floatingTexts = [];
    this.pendingGodOrders = [];
    this.godHistory = [];
    this.news = new NewsSystem();
    this._tickTimer = null;
    this._reproductionCooldown = new Map();
    this._socialCooldown = new Map();
    this._nextEventTick = CONFIG.GROQ_EVENT_INTERVAL;
    this._generatingEvent = false;
    this._recentEventTypes = [];
    this._constructionQueue = [];
    this._lastPopMilestone = 0;
    this._godKilledAll = false;
    this._dynamicPopMax = null;
    this.citizenAIEnabled = false;
    // Load any custom cells from previous sessions
    loadCustomCells();
  }

  setCitizenAIGlobal(enabled) { this.citizenAIEnabled = !!enabled; }

  init(apiKey, model, seed) {
    this.stop();
    resetIdCounter();
    this.apiKey = apiKey;
    this.model = model || CONFIG.GROQ_MODEL_DEFAULT;
    this.seed = seed ?? Math.floor(Math.random() * 999999);
    this.rng = createRNG(this.seed);
    this.tick = 0;
    this.worldVars = { ...DEFAULT_WORLD };
    this.stats = { totalBirths: 0, totalDeaths: 0, groqCalls: 0, groqErrors: 0 };
    this.effects = [];
    this.floatingTexts = [];
    this.pendingGodOrders = [];
    this.godHistory = [];
    this.news = new NewsSystem();
    this._reproductionCooldown = new Map();
    this._socialCooldown = new Map();
    this._nextEventTick = CONFIG.GROQ_EVENT_INTERVAL;
    this._generatingEvent = false;
    this._recentEventTypes = [];
    this._constructionQueue = [];
    this._lastPopMilestone = 0;
    this._godKilledAll = false;
    this._dynamicPopMax = null;

    this.city = generateCity(this.seed, CONFIG.GRID_DEFAULT);
    this.citizens = createInitialPopulation(this.rng, this.city);
    for (const c of this.citizens) {
      c.job = randomChoice(this.rng, CONFIG.JOBS);
      c.vehicle = randomChoice(this.rng, CONFIG.VEHICLES);
      c._sprite = null;
    }

    this.running = true;
    this.paused = false;
    this._scheduleNextTick();
    this._emitState();
  }

  pause()  { this.paused = true;  clearTimeout(this._tickTimer); }
  resume() { if (!this.running) return; this.paused = false; this._scheduleNextTick(); }
  stop()   { this.running = false; this.paused = false; clearTimeout(this._tickTimer); }
  restart(apiKey, model, seed) { this.init(apiKey, model, seed); }

  setSpeed(speed) {
    this.speed = Math.max(1, Math.min(CONFIG.MAX_SPEED, speed));
    if (this.running && !this.paused) { clearTimeout(this._tickTimer); this._scheduleNextTick(); }
  }

  _scheduleNextTick() {
    this._tickTimer = setTimeout(() => this._doTick(), CONFIG.TICK_INTERVAL_MS / this.speed);
  }

  async _doTick() {
    if (!this.running || this.paused) return;
    this.tick++;

    // Apply pending god orders
    while (this.pendingGodOrders.length > 0) this._applyGodOrder(this.pendingGodOrders.shift());

    // World event (Groq) — only 1 call every 600 ticks
    if (this.tick >= this._nextEventTick && !this._generatingEvent) {
      this._nextEventTick = this.tick + CONFIG.GROQ_EVENT_INTERVAL;
      this._triggerWorldEvent();
    }

    // Autonomous city evolution (no API)
    if (this.tick % 60 === 0) this._evolveCityAutonomously();

    // Process constructions
    this._processConstructions();

    // Natural world variable drift
    if (this.tick % 30 === 0) this._driftWorldVars();

    const dayPhase = (this.tick % CONFIG.DAY_LENGTH) / CONFIG.DAY_LENGTH;
    const newCitizens = [];

    for (const citizen of this.citizens) {
      if (!citizen.alive) continue;
      updateCitizenAge(citizen);
      decayAttributes(citizen);

      if (shouldDie(citizen)) {
        citizen.alive = false;
        this.stats.totalDeaths++;
        this.news.addDeath(citizen);
        this._addFloat(citizen.pixelX, citizen.pixelY, '💀', '#e85050', 50);
        continue;
      }

      // Crisis / happiness alerts
      if (citizen.energy < 15 && !citizen._crisisAlerted) {
        citizen._crisisAlerted = true;
        this._addFloat(citizen.pixelX, citizen.pixelY, '⚠', '#ff4040', 35);
      } else if (citizen.energy > 30) citizen._crisisAlerted = false;

      // Move along path
      this._moveCitizen(citizen);

      // Behavior tick
      citizen.behaviorTicksLeft--;
      if (citizen.behaviorTicksLeft <= 0) {
        applyBehaviorEffect(citizen, citizen.behavior.action);
        citizen.lastBehavior = { ...citizen.behavior };
        // Get next behavior — 100% local, zero API
        const next = getLocalBehavior(this.rng, citizen, dayPhase);
        citizen.behavior = next;
        citizen.behaviorTicksLeft = next.duration;
        this._setPathForBehavior(citizen, next.action);
      }
    }

    // Social interactions
    if (this.tick % 15 === 0) this._processSocial();

    // Reproduction
    this.citizens = this.citizens.filter(c => c.alive);
    this._checkReproduction(newCitizens);
    this.citizens.push(...newCitizens);

    // Min population — only enforce if no god kill order was just applied
    while (this.citizens.filter(c => c.alive).length < CONFIG.POP_MIN && !this._godKilledAll) {
      const c = createCitizen(this.rng, this.city);
      c.job = randomChoice(this.rng, CONFIG.JOBS);
      c.vehicle = randomChoice(this.rng, CONFIG.VEHICLES);
      this.citizens.push(c);
      this.stats.totalBirths++;
    }
    // Reset kill flag after one tick
    this._godKilledAll = false;
    if (this.citizens.length > (this._dynamicPopMax || CONFIG.POP_MAX)) this.citizens = this.citizens.slice(0, this._dynamicPopMax || CONFIG.POP_MAX);

    // Population milestones
    const pop = this.citizens.filter(c => c.alive).length;
    const milestone = Math.floor(pop / 10) * 10;
    if (milestone > this._lastPopMilestone && milestone >= 10) {
      this._lastPopMilestone = milestone;
      this.news.addPopulation(milestone);
    }

    // Tick effects & floats
    this.effects = this.effects.map(e => ({ ...e, ticksLeft: e.ticksLeft - 1 })).filter(e => e.ticksLeft > 0);
    // Cap effects to prevent lag from accumulation
    if (this.effects.length > 20) this.effects = this.effects.slice(-20);
    this.floatingTexts = this.floatingTexts.map(t => ({ ...t, life: t.life - 1, y: t.y - 0.7 })).filter(t => t.life > 0);
    // Process any scheduled citizen AI calls (locura / introspection)
    try { await this._processCitizenAICalls(); } catch (e) { console.warn('[AI] citizen calls error', e.message); }

    this._emitState();
    this._scheduleNextTick();
  }

  async _processCitizenAICalls() {
    if (!this.citizenAIEnabled) return;
    if (!this.citizens || this.citizens.length === 0) return;
    let calls = 0;
    for (const c of this.citizens) {
      if (!c.alive) continue;
      if (!c.insane && !c._questioning) continue;
      if (!c.nextAiCallTick) c.nextAiCallTick = this.tick + CONFIG.AI_CALL_INTERVAL_TICKS;
      if (this.tick < c.nextAiCallTick) continue;
      if (calls >= CONFIG.AI_MAX_CALLS_PER_TICK) break;
      c.nextAiCallTick = this.tick + CONFIG.AI_CALL_INTERVAL_TICKS;
      calls++;

      // Attempt external AI call if apiKey present, else fallback local
      let response = null;
      if (this.apiKey) {
        try {
          response = await askCitizenQuestion(this.apiKey, this.model, c);
        } catch (e) {
          response = null;
        }
      }

      if (!response) {
        // Local simulated reaction
        const emotions = ['miedo','tristeza','ira','alegria','confusion','asombro'];
        const moves = ['quieto','caminar','correr','huir','deambular'];
        const emo = emotions[Math.floor(this.rng()*emotions.length)];
        const mov = moves[Math.floor(this.rng()*moves.length)];
        response = { text: `Se pregunta por su existencia y siente ${emo}`, emotion: emo, movement: mov, deltas: { e: -5, f: -6 } };
      }

      // Apply response: adjust attributes and behavior
      try {
        if (response.deltas) {
          if (response.deltas.e != null) c.energy = Math.max(0, Math.min(100, c.energy + response.deltas.e));
          if (response.deltas.f != null) c.happiness = Math.max(0, Math.min(100, c.happiness + response.deltas.f));
          if (response.deltas.h != null) c.hunger = Math.max(0, Math.min(100, c.hunger + response.deltas.h));
        }
        // Map emotion to emoji
        const emoMap = { miedo: '😨', tristeza: '😢', ira: '😡', alegria: '😃', confusion: '😵', asombro: '🤯' };
        const emoj = emoMap[response.emotion] || '😶';
        this._addFloat(c.pixelX, c.pixelY - 10, emoj, '#f5c842', 40);
        // Movement override for short time
        const moveMap = { quieto: 'dormir', caminar: 'caminar', correr: 'caminar', huir: 'caminar', deambular: 'explorar' };
        const act = moveMap[response.movement] || 'caminar';
        c.behavior = { action: act, duration: Math.max(8, Math.floor(Math.abs((response.deltas?.e||0))/1)+12), description: response.text };
        c.behaviorTicksLeft = c.behavior.duration;
      } catch (e) { /* ignore */ }
    }
  }

  // ── Autonomous city evolution — no API ────────────────────────────────────
  _evolveCityAutonomously() {
    const pop = this.citizens.filter(c => c.alive).length;
    const eco = this.worldVars.economy;
    const tech = this.worldVars.technology;

    // Era progression
    this.worldVars.era_progress = Math.min(100, this.worldVars.era_progress + 0.5);
    const eras = ['ancient', 'medieval', 'industrial', 'modern', 'future'];
    const eraIdx = Math.floor(this.worldVars.era_progress / 20);
    const newEra = eras[Math.min(eraIdx, 4)];
    if (newEra !== this.worldVars.population_era) {
      this.worldVars.population_era = newEra;
      const eraNames = { medieval:'Medieval', industrial:'Industrial', modern:'Moderno', future:'Futuro' };
      this.news.addCustom(`🏛 NUEVA ERA: La ciudad entra en la era ${eraNames[newEra] || newEra}`, 'milestone');
      this._addCityEffect('magia', (this.city.size * CONFIG.CELL_SIZE) / 2, (this.city.size * CONFIG.CELL_SIZE) / 2, 80);
    }

    // Aggressive construction — always build something every 60 ticks
    // Priority based on world state
    const buildOptions = [];
    if (pop > 5)  buildOptions.push({ type: CELL.RESIDENTIAL, msg: '🏠 Nuevas viviendas en construcción', weight: 3 });
    if (eco > 40) buildOptions.push({ type: CELL.MARKET,      msg: '🏪 Nuevo mercado en construcción',   weight: 2 });
    if (eco > 50) buildOptions.push({ type: CELL.WORK,        msg: '🏢 Nuevo edificio de trabajo',       weight: 2 });
    buildOptions.push(              { type: CELL.PARK,        msg: '🌳 Nuevo parque en construcción',    weight: 2 });
    if (tech > 40) buildOptions.push({ type: CELL.SCHOOL,     msg: '🏫 Nueva escuela en construcción',   weight: 1 });
    if (this.worldVars.happiness > 60) buildOptions.push({ type: CELL.STADIUM, msg: '🏟 Estadio en construcción', weight: 1 });
    if (this.worldVars.culture > 50)   buildOptions.push({ type: CELL.TEMPLE,  msg: '⛩ Templo cultural',         weight: 1 });
    if (this.worldVars.nature > 60)    buildOptions.push({ type: CELL.FOREST,  msg: '🌲 Bosque plantado',         weight: 1 });
    if (eco > 70) buildOptions.push({ type: CELL.HOSPITAL,    msg: '🏥 Hospital en construcción',        weight: 1 });
    if (eco > 80) buildOptions.push({ type: CELL.AMUSEMENT,   msg: '🎡 Parque de diversiones',           weight: 1 });

    // Weighted random pick
    const totalWeight = buildOptions.reduce((s, o) => s + o.weight, 0);
    let r = this.rng() * totalWeight;
    for (const opt of buildOptions) {
      r -= opt.weight;
      if (r <= 0) { this._queueConstruction(opt.type, opt.msg); break; }
    }

    // War effects
    if (this.worldVars.at_war) {
      this.worldVars.economy = Math.max(0, this.worldVars.economy - 0.5);
      this.worldVars.happiness = Math.max(0, this.worldVars.happiness - 0.3);
      this.worldVars.pollution = Math.min(100, this.worldVars.pollution + 0.2);
      // War destroys random buildings
      if (this.tick % 30 === 0) {
        const buildings = [];
        for (let y = 0; y < this.city.size; y++)
          for (let x = 0; x < this.city.size; x++)
            if ([CELL.RESIDENTIAL, CELL.WORK, CELL.MARKET].includes(this.city.grid[y][x].type))
              buildings.push({ x, y });
        if (buildings.length > 0) {
          const target = randomChoice(this.rng, buildings);
          // Never destroy custom cells during war
          if (!hasCustomCell(this.city.grid[target.y][target.x].type)) {
            this.city.grid[target.y][target.x] = { ...this.city.grid[target.y][target.x], type: CELL.RUINS, modified: true, modifiedAt: this.tick };
            this._addFloat(target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, target.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, '💥', '#e85050', 40);
          }
        }
      }
      if (this.tick - this.worldVars.war_tick > 300) {
        this.worldVars.at_war = false;
        this.news.addCustom('🕊 ARMISTICIO: La guerra ha terminado. La ciudad reconstruye.', 'milestone');
        this._addCityEffect('curacion', (this.city.size * CONFIG.CELL_SIZE) / 2, (this.city.size * CONFIG.CELL_SIZE) / 2, 60);
      }
    }

    // Fire custom cell event triggers
    const customTriggers = getCustomCellEventTriggers();
    for (const { cellId, label, emoji, triggers } of customTriggers) {
      // Only fire if this cell type exists in the city
      const exists = this.city.grid.some(row => row.some(c => c.type === cellId));
      if (!exists) continue;
      for (const trigger of triggers) {
        try {
          // eslint-disable-next-line no-new-func
          const condFn = new Function('tick', `return !!(${trigger.condition})`);
          if (condFn(this.tick)) {
            const effect = trigger.effect || 'generico';
            const cx = (this.city.size * CONFIG.CELL_SIZE) / 2;
            const cy = (this.city.size * CONFIG.CELL_SIZE) / 2;
            this._addCityEffect(effect, cx, cy, 40);
            if (trigger.news) this.news.addCustom(`${emoji} ${trigger.news}`, 'custom');
            if (trigger.worldEffect) {
              const keyMap = { happiness: 'happiness', economy: 'economy', pollution: 'pollution', culture: 'culture' };
              for (const [k, v] of Object.entries(trigger.worldEffect)) {
                const key = keyMap[k] || k;
                if (this.worldVars[key] !== undefined) {
                  this.worldVars[key] = Math.max(0, Math.min(100, this.worldVars[key] + v));
                }
              }
            }
          }
        } catch { /* invalid condition, skip */ }
      }
    }
  }

  _queueConstruction(cellType, message) {
    // Find a street cell to build on
    const streets = getCellsOfType(this.city, CELL.STREET);
    if (streets.length === 0) return;
    const target = randomChoice(this.rng, streets);
    const key = `${target.x},${target.y}`;
    if (this._constructionQueue.find(c => c.key === key)) return;

    this._constructionQueue.push({
      key, x: target.x, y: target.y,
      cellType, message,
      ticksLeft: randomInt(this.rng, 20, 40),
    });
    this.news.addCustom(message, 'construction');
    this._addFloat(
      target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
      target.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
      '🏗', '#f5c842', 40
    );
  }

  _processConstructions() {
    const done = [];
    for (const c of this._constructionQueue) {
      c.ticksLeft--;
      if (c.ticksLeft <= 0) {
        // Complete construction — never overwrite custom cells
        if (this.city.grid[c.y]?.[c.x] && !hasCustomCell(this.city.grid[c.y][c.x].type)) {
          this.city.grid[c.y][c.x] = {
            ...this.city.grid[c.y][c.x],
            type: c.cellType,
            modified: true,
            modifiedAt: this.tick,
          };
          const px = c.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
          const py = c.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
          this._addFloat(px, py, '✅', '#50c878', 50);
          this._addCityEffect('destello', px, py, 30);
          const typeNames = {
            [CELL.MARKET]:'mercado', [CELL.SCHOOL]:'escuela', [CELL.STADIUM]:'estadio',
            [CELL.PARK]:'parque', [CELL.RESIDENTIAL]:'viviendas', [CELL.TEMPLE]:'templo',
            [CELL.HOSPITAL]:'hospital', [CELL.AMUSEMENT]:'parque de diversiones',
          };
          this.news.addCustom(`✅ INAUGURADO: Nuevo ${typeNames[c.cellType]||c.cellType} abre sus puertas`, 'construction');
        }
        done.push(c);
      }
    }
    this._constructionQueue = this._constructionQueue.filter(c => !done.includes(c));
  }

  _driftWorldVars() {
    const w = this.worldVars;
    const pop = this.citizens.filter(c => c.alive).length;

    // Natural drift based on population and current state
    w.economy    = Math.max(0, Math.min(100, w.economy    + (pop > 20 ? 0.3 : -0.2) + (Math.random() - 0.5) * 0.5));
    w.happiness  = Math.max(0, Math.min(100, w.happiness  + (w.economy > 50 ? 0.2 : -0.2) + (Math.random() - 0.5) * 0.4));
    w.pollution  = Math.max(0, Math.min(100, w.pollution  + (w.technology > 50 ? -0.1 : 0.1)));
    w.culture    = Math.max(0, Math.min(100, w.culture    + (w.happiness > 60 ? 0.15 : -0.1)));
    w.technology = Math.max(0, Math.min(100, w.technology + (w.economy > 60 ? 0.1 : 0)));
    w.crime      = Math.max(0, Math.min(100, w.crime      + (w.happiness < 40 ? 0.2 : -0.1)));
    w.nature     = Math.max(0, Math.min(100, w.nature     + (w.pollution < 30 ? 0.1 : -0.15)));
    w.era_progress = Math.min(100, w.era_progress + (w.technology > 50 ? 0.3 : 0.1));
  }

  _addCityEffect(type, x, y, ticks) {
    this.effects.push({ id: Date.now() + Math.random(), type, x, y, ticksLeft: ticks, totalTicks: ticks, description: '' });
  }

  // ── World event (Groq) ────────────────────────────────────────────────────
  async _triggerWorldEvent() {
    if (!this.apiKey) return;
    this._generatingEvent = true;
    try {
      this.stats.groqCalls++;
      const event = await generateWorldEvent(
        this.apiKey, this.model, this.citizens, this.worldVars, this.tick, this._recentEventTypes
      );

      // Apply world var changes
      const keyMap = { economia:'economy', felicidad:'happiness', contaminacion:'pollution', cultura:'culture', tecnologia:'technology', crimen:'crime', naturaleza:'nature' };
      for (const [k, v] of Object.entries(event.cambios_mundo || {})) {
        const key = keyMap[k] || k;
        if (this.worldVars[key] !== undefined) {
          this.worldVars[key] = Math.max(0, Math.min(100, this.worldVars[key] + v));
        }
      }

      // Special event types
      if (event.tipo === 'guerra' || event.tipo === 'revolucion') {
        this.worldVars.at_war = true;
        this.worldVars.war_tick = this.tick;
      }
      if (event.tipo === 'festival' || event.tipo === 'celebracion') {
        this.worldVars.happiness = Math.min(100, this.worldVars.happiness + 10);
      }

      // Apply citizen attribute changes (clamped)
      for (const [idStr, changes] of Object.entries(event.cambios_atributos || {})) {
        const c = this.citizens.find(c => c.id === parseInt(idStr));
        if (!c) continue;
        if (changes.e != null) c.energy    = Math.max(5,  Math.min(100, c.energy    + Math.max(-20, changes.e)));
        if (changes.f != null) c.happiness = Math.max(0,  Math.min(100, c.happiness + Math.max(-30, changes.f)));
        if (changes.h != null) c.hunger    = Math.max(0,  Math.min(100, c.hunger    + Math.min(30,  changes.h)));
      }

      // Apply cell modifications
      this._applyCellMods(event.modificaciones_celda || []);

      // Citizen reactions
      if (event.reaccion && event.reaccion !== 'ninguna') {
        this._applyCitizenReaction(event.reaccion, event.afectados_ids || [], this.citizens.filter(c => c.alive));
      }

      // Visual effects — max 2 total to prevent lag accumulation
      const cx = (this.city.size * CONFIG.CELL_SIZE) / 2;
      const cy = (this.city.size * CONFIG.CELL_SIZE) / 2;
      // Main effect at center
      this._addCityEffect(event.tipo_de_efecto, cx, cy, 80);
      // One random quarter effect
      const qs = this.city.size * CONFIG.CELL_SIZE / 4;
      const quarters = [[qs, qs], [cx + qs, qs], [qs, cy + qs], [cx + qs, cy + qs]];
      const q = quarters[Math.floor(Math.random() * quarters.length)];
      this._addCityEffect(event.tipo_de_efecto, q[0], q[1], 60);

      // News — rich narrative
      this.news.addCustom(`📰 ${event.titulo}`, event.tipo || 'evento');
      if (event.descripcion) this.news.addCustom(`   ↳ ${event.descripcion}`, 'detail');

      // Track recent events to avoid repetition
      this._recentEventTypes.unshift(event.tipo);
      if (this._recentEventTypes.length > 5) this._recentEventTypes.pop();

      // Notify god chat
      this.onGodResponse?.({
        mensaje_confirmacion: event.titulo,
        tipo_de_efecto: event.tipo_de_efecto,
        descripcion_visual: event.descripcion,
        ciudadanos_afectados: event.afectados_ids || [],
      }, '🌍 EVENTO MUNDIAL');

    } catch (err) {
      this.stats.groqErrors++;
    } finally {
      this._generatingEvent = false;
    }
  }

  // ── Cell modifications ────────────────────────────────────────────────────
  _applyCellMods(mods) {
    for (const mod of mods) {
      const xy = mod.xy || mod.celda || '';
      const parts = xy.split(',');
      if (parts.length < 2) continue;
      const x = parseInt(parts[0]), y = parseInt(parts[1]);
      if (isNaN(x) || isNaN(y) || !this.city.grid[y]?.[x]) continue;
      // Never overwrite custom cells — they are sacred
      if (hasCustomCell(this.city.grid[y][x].type)) continue;
      this.city.grid[y][x] = { ...this.city.grid[y][x], type: mod.tipo || mod.nuevo_tipo || CELL.PARK, modified: true, modifiedAt: this.tick };
      const px = x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
      const py = y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
      this._addFloat(px, py, '✨', '#f5c842', 30);
    }
  }

  // ── Citizen reactions ─────────────────────────────────────────────────────
  _applyCitizenReaction(reaccion, affectedIds, allCitizens) {
    const targets = affectedIds.length > 0
      ? allCitizens.filter(c => affectedIds.includes(c.id))
      : allCitizens;

    const reactionEmojis = {
      panico: ['😱','🏃','💨'], celebracion: ['🎉','🥳','✨'],
      confusion: ['❓','😵'], huida: ['🏃','💨'],
      baile: ['💃','🕺','🎵'], llanto: ['😭','💧'],
      asombro: ['😮','⭐'],
    };
    const emojis = reactionEmojis[reaccion] || ['!'];

    const reactionBehaviors = {
      panico:      { action: 'caminar',   duration: 12, description: 'Huyendo aterrorizado' },
      huida:       { action: 'caminar',   duration: 15, description: 'Escapando del peligro' },
      celebracion: { action: 'socializar',duration: 18, description: 'Celebrando eufórico' },
      baile:       { action: 'socializar',duration: 20, description: 'Bailando sin parar' },
      llanto:      { action: 'descansar', duration: 14, description: 'Llorando desconsolado' },
      asombro:     { action: 'explorar',  duration: 10, description: 'Mirando atónito' },
      confusion:   { action: 'caminar',   duration: 8,  description: 'Desorientado' },
    };

    for (const c of targets) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      this._addFloat(c.pixelX, c.pixelY - 16, emoji, '#f5c842', 45);
      const beh = reactionBehaviors[reaccion];
      if (beh) {
        c.behavior = { ...beh };
        c.behaviorTicksLeft = beh.duration;
        this._setPathForBehavior(c, beh.action);
      }
      // Attribute effects
      if (reaccion === 'panico' || reaccion === 'huida') c.happiness = Math.max(5, c.happiness - 15);
      if (reaccion === 'celebracion' || reaccion === 'baile') c.happiness = Math.min(100, c.happiness + 20);
      if (reaccion === 'llanto') c.happiness = Math.max(5, c.happiness - 20);
    }
  }

  // ── Movement — respects buildings ─────────────────────────────────────────
  _moveCitizen(citizen) {
    if (!citizen.path || citizen.pathIndex >= citizen.path.length) return;
    const nextKey = citizen.path[citizen.pathIndex];
    const [nx, ny] = nextKey.split(',').map(Number);
    const tx = nx * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
    const ty = ny * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
    const dx = tx - citizen.pixelX, dy = ty - citizen.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 1.8 * this.speed;
    if (dist <= spd) {
      citizen.pixelX = tx; citizen.pixelY = ty;
      citizen.cellKey = nextKey; citizen.pathIndex++;
    } else {
      citizen.pixelX += (dx / dist) * spd;
      citizen.pixelY += (dy / dist) * spd;
    }
  }

  _setPathForBehavior(citizen, action) {
    let targetKey = null;
    const walkableCells = [CELL.STREET, CELL.PARK, CELL.PLAZA, CELL.AMUSEMENT, CELL.MARKET, CELL.STADIUM, CELL.FARM, CELL.FOREST, CELL.LAKE];

    if (action === 'trabajar') {
      targetKey = findNearest(this.city, citizen.cellKey, CELL.WORK)
        || findNearest(this.city, citizen.cellKey, CELL.FACTORY)
        || findNearest(this.city, citizen.cellKey, CELL.MARKET);
    } else if (['dormir', 'descansar', 'leer'].includes(action)) {
      targetKey = findNearest(this.city, citizen.cellKey, CELL.RESIDENTIAL);
    } else if (['comer', 'comprar'].includes(action)) {
      targetKey = findNearest(this.city, citizen.cellKey, CELL.MARKET)
        || findNearest(this.city, citizen.cellKey, CELL.PARK);
    } else if (['socializar', 'jugar'].includes(action)) {
      targetKey = findNearest(this.city, citizen.cellKey, CELL.PLAZA)
        || findNearest(this.city, citizen.cellKey, CELL.AMUSEMENT)
        || findNearest(this.city, citizen.cellKey, CELL.STADIUM)
        || findNearest(this.city, citizen.cellKey, CELL.PARK);
    } else {
      // Walk to a random street
      const streets = getCellsOfType(this.city, CELL.STREET);
      if (streets.length > 0) {
        const t = randomChoice(this.rng, streets);
        targetKey = `${t.x},${t.y}`;
      }
    }

    if (targetKey && targetKey !== citizen.cellKey) {
      const path = findPath(this.city, citizen.cellKey, targetKey);
      if (path && path.length > 1) {
        citizen.path = path;
        citizen.pathIndex = 1;
        citizen.targetCellKey = targetKey;
      }
    }
  }

  // ── Social interactions ───────────────────────────────────────────────────
  _processSocial() {
    const alive = this.citizens.filter(c => c.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const c1 = alive[i], c2 = alive[j];
        if (c1.cellKey !== c2.cellKey) continue;
        const key = `${Math.min(c1.id, c2.id)}-${Math.max(c1.id, c2.id)}`;
        if (this.tick < (this._socialCooldown.get(key) || 0)) continue;
        if (c1.behavior?.action === 'socializar' || c2.behavior?.action === 'socializar') {
          c1.happiness = Math.min(100, c1.happiness + 5);
          c2.happiness = Math.min(100, c2.happiness + 5);
          c1.relationships[c2.id] = 'amigo';
          c2.relationships[c1.id] = 'amigo';
          this._socialCooldown.set(key, this.tick + 60);
          if (Math.random() < 0.08) this.news.addSocialEvent(c1.name, c2.name);
          this._addFloat((c1.pixelX + c2.pixelX) / 2, Math.min(c1.pixelY, c2.pixelY) - 10, '💬', '#50c878', 22);
        }
      }
    }
  }

  // ── Reproduction ──────────────────────────────────────────────────────────
  _checkReproduction(newCitizens) {
    const adults = this.citizens.filter(c => c.alive && c.stage === STAGE.ADULT);
    const checked = new Set();
    for (let i = 0; i < adults.length; i++) {
      for (let j = i + 1; j < adults.length; j++) {
        const c1 = adults[i], c2 = adults[j];
        const key = `${Math.min(c1.id, c2.id)}-${Math.max(c1.id, c2.id)}`;
        if (checked.has(key)) continue; checked.add(key);
        if (this.tick < (this._reproductionCooldown.get(key) || 0)) continue;
        if (canReproduce(c1, c2) && this.citizens.length + newCitizens.length < CONFIG.POP_MAX) {
          const child = reproduce(this.rng, this.city, c1, c2);
          child.job = randomChoice(this.rng, CONFIG.JOBS);
          child.vehicle = randomChoice(this.rng, CONFIG.VEHICLES);
          newCitizens.push(child);
          this.stats.totalBirths++;
          this._reproductionCooldown.set(key, this.tick + 300);
          this.news.addBirth(child, c1.name, c2.name);
          this._addFloat(c1.pixelX, c1.pixelY - 18, '👶', '#f5c842', 45);
        }
      }
    }
  }

  _addFloat(x, y, text, color, life = 40) {
    this.floatingTexts.push({ id: Date.now() + Math.random(), x, y, text, color, life, maxLife: life });
  }

  // ── God Mode ──────────────────────────────────────────────────────────────
  async sendGodOrder(order, selectedCitizenIds = []) {
    if (!this.running) throw new Error('Simulación no iniciada');
    const alive = this.citizens.filter(c => c.alive);
    const selected = selectedCitizenIds.length > 0 ? alive.filter(c => selectedCitizenIds.includes(c.id)) : alive;
    const cityInfo = `${this.city.size}x${this.city.size} ${alive.length}pob era:${this.worldVars.population_era}`;

    // ── Step 1: Detect if this is a request for a new/unknown feature ────────
    const featureDetect = detectNewFeature(order);
    if (featureDetect?.isNew) {
      this.stats.groqCalls++;
      let cell;
      try {
        cell = await generateFeature(this.apiKey, this.model, featureDetect.cellId, featureDetect.label, order);
      } catch (err) {
        this.stats.groqErrors++;
        throw new Error(`No pude generar "${featureDetect.label}": ${err.message}`);
      }
      const interp = {
        ciudadanos_afectados: [], matar_ids: [], matar_todos: false,
        tipo_de_efecto: 'magia', descripcion_visual: `${cell.emoji} ${cell.label} aparece en la ciudad`,
        duracion_en_ticks: 40, cambios_atributos: {}, reaccion_ciudadanos: 'asombro',
        celdas_masivas: 'ninguna', nuevo_tipo_masivo: null,
        color_override: null, grass_color: null, sky_color: null, nueva_poblacion: null,
        eliminar_tipo: null, construir_tipo: cell.id, construir_cantidad: 3,
        toggle_rain: null, boost_todos: null, modificaciones_celda: [],
        cambios_mundo: cell.worldEffect || {}, noticia: cell.noticia,
        mensaje_confirmacion: cell.confirmacion,
        _isNewFeature: true, _featureLabel: cell.label, _featureEmoji: cell.emoji, _featureCommitted: cell._committed || false,
      };
      if (this.paused) this.pendingGodOrders.push(interp);
      else this._applyGodOrder(interp, selectedCitizenIds);
      this.godHistory.unshift({ id: Date.now(), order, interpretation: interp, tick: this.tick });
      if (this.godHistory.length > CONFIG.GOD_HISTORY_MAX) this.godHistory.pop();
      this.news.addCustom(cell.noticia, 'custom');
      this.onGodResponse?.(interp, order);
      return interp;
    }

    // ── Step 2: Try local fast-path (instant, no API) ─────────────────────
    const local = tryLocalOrder(order, alive);
    if (local) {
      if (this.paused) this.pendingGodOrders.push(local);
      else this._applyGodOrder(local, selectedCitizenIds);
      this.godHistory.unshift({ id: Date.now(), order, interpretation: local, tick: this.tick });
      if (this.godHistory.length > CONFIG.GOD_HISTORY_MAX) this.godHistory.pop();
      this.news.addGodOrder(order, local.mensaje_confirmacion);
      this.onGodResponse?.(local, order);
      return local;
    }

    // ── Step 3: Fall back to Groq for complex/narrative orders ────────────
    try {
      this.stats.groqCalls++;
      const interp = await interpretGodOrder(this.apiKey, this.model, order, selected, alive, cityInfo, this.worldVars);
      if (this.paused) this.pendingGodOrders.push(interp);
      else this._applyGodOrder(interp, selectedCitizenIds);
      this.godHistory.unshift({ id: Date.now(), order, interpretation: interp, tick: this.tick });
      if (this.godHistory.length > CONFIG.GOD_HISTORY_MAX) this.godHistory.pop();
      this.news.addGodOrder(order, interp.mensaje_confirmacion);
      this.onGodResponse?.(interp, order);
      return interp;
    } catch (err) {
      this.stats.groqErrors++;
      console.warn('[GodOrder] Groq interpret failed:', err.message);
      // Fallback 1: if the order looks like a request to create a new feature, try to generate it locally
      try {
        const fd = detectNewFeature(order);
        if (fd?.isNew) {
          const cell = await generateFeature(this.apiKey, this.model, fd.cellId, fd.label, order).catch(e => { throw e; });
          const interp = {
            ciudadanos_afectados: [], matar_ids: [], matar_todos: false,
            tipo_de_efecto: 'magia', descripcion_visual: `${cell.emoji} ${cell.label} aparece en la ciudad`,
            duracion_en_ticks: 40, cambios_atributos: {}, reaccion_ciudadanos: 'asombro',
            celdas_masivas: 'ninguna', nuevo_tipo_masivo: null,
            color_override: null, grass_color: null, sky_color: null, nueva_poblacion: null,
            eliminar_tipo: null, construir_tipo: cell.id, construir_cantidad: 3,
            toggle_rain: null, boost_todos: null, modificaciones_celda: [],
            cambios_mundo: cell.worldEffect || {}, noticia: cell.noticia,
            mensaje_confirmacion: cell.confirmacion,
            _isNewFeature: true, _featureLabel: cell.label, _featureEmoji: cell.emoji, _featureCommitted: cell._committed || false,
          };
          if (this.paused) this.pendingGodOrders.push(interp);
          else this._applyGodOrder(interp, selectedCitizenIds);
          this.godHistory.unshift({ id: Date.now(), order, interpretation: interp, tick: this.tick });
          if (this.godHistory.length > CONFIG.GOD_HISTORY_MAX) this.godHistory.pop();
          this.news.addCustom(cell.noticia, 'custom');
          this.onGodResponse?.(interp, order);
          return interp;
        }
      } catch (genErr) {
        console.warn('[GodOrder] Fallback feature generation failed:', genErr.message);
      }

      // Fallback 2: generic safe interpretation so the order still produces visible feedback
      const fallback = {
        ciudadanos_afectados: [], matar_ids: [], matar_todos: false,
        tipo_de_efecto: 'generico', descripcion_visual: 'Orden ejecutada (fallback)', duracion_en_ticks: 30,
        cambios_atributos: {}, reaccion_ciudadanos: 'ninguna', celdas_masivas: 'ninguna', nuevo_tipo_masivo: null,
        color_override: null, grass_color: null, sky_color: null, nueva_poblacion: null,
        eliminar_tipo: null, construir_tipo: null, construir_cantidad: 0, toggle_rain: null, boost_todos: null,
        modificaciones_celda: [], cambios_mundo: {}, noticia: '', mensaje_confirmacion: '✦ Orden ejecutada (modo fallback).',
      };
      if (this.paused) this.pendingGodOrders.push(fallback);
      else this._applyGodOrder(fallback, selectedCitizenIds);
      this.godHistory.unshift({ id: Date.now(), order, interpretation: fallback, tick: this.tick });
      if (this.godHistory.length > CONFIG.GOD_HISTORY_MAX) this.godHistory.pop();
      this.news.addGodOrder(order, fallback.mensaje_confirmacion);
      this.onGodResponse?.(fallback, order);
      return fallback;
    }
  }

  _applyGodOrder(interp, selectedCitizenIds = []) {
    // ── KILL citizens ──────────────────────────────────────────────────────
    if (interp.matar_todos) {
      // If there are selected citizens, kill only them — not everyone
      const targets = selectedCitizenIds.length > 0
        ? this.citizens.filter(c => c.alive && selectedCitizenIds.includes(c.id))
        : this.citizens.filter(c => c.alive);

      for (const c of targets) {
        c.alive = false;
        this.stats.totalDeaths++;
        this._addFloat(c.pixelX, c.pixelY, '💀', '#e85050', 50);
      }
      if (selectedCitizenIds.length === 0) {
        this._godKilledAll = true;
        this.news.addCustom('💀 EXTINCIÓN: Todos los ciudadanos han muerto', 'death');
      } else {
        this.news.addCustom(`💀 ${targets.map(c=>c.name).join(', ')} han muerto`, 'death');
      }
    } else if (interp.matar_ids && interp.matar_ids.length > 0) {
      for (const id of interp.matar_ids) {
        const c = this.citizens.find(c => c.id === id && c.alive);
        if (c) {
          c.alive = false;
          this.stats.totalDeaths++;
          this._addFloat(c.pixelX, c.pixelY, '💀', '#e85050', 50);
        }
      }
    }

    // ── Set population ─────────────────────────────────────────────────────
    if (interp.nueva_poblacion != null && !isNaN(interp.nueva_poblacion)) {
      const target = Math.max(0, Math.min(2000, interp.nueva_poblacion));
      const alive = this.citizens.filter(c => c.alive);
      if (target > alive.length) {
        // Spawn new citizens
        const toAdd = target - alive.length;
        for (let i = 0; i < toAdd; i++) {
          const c = createCitizen(this.rng, this.city);
          c.job = randomChoice(this.rng, CONFIG.JOBS);
          c.vehicle = randomChoice(this.rng, CONFIG.VEHICLES);
          this.citizens.push(c);
          this.stats.totalBirths++;
        }
        this.news.addCustom(`👥 POBLACIÓN: ${toAdd} nuevos ciudadanos han llegado (total: ${target})`, 'population');
      } else if (target < alive.length) {
        // Kill excess citizens
        let killed = 0;
        for (let i = this.citizens.length - 1; i >= 0 && killed < alive.length - target; i--) {
          if (this.citizens[i].alive) {
            this.citizens[i].alive = false;
            this.stats.totalDeaths++;
            killed++;
          }
        }
        this.news.addCustom(`💀 REDUCCIÓN: La población ha sido reducida a ${target}`, 'death');
      }
      // Override POP_MAX dynamically so the simulation doesn't trim them
      this._dynamicPopMax = Math.max(CONFIG.POP_MAX, target + 50);
    }

    // ── Color overrides ────────────────────────────────────────────────────
    if (interp.color_override === 'RESET') {
      delete this.city.colorOverride;
      delete this.city.grassColor;
      delete this.city.skyColor;
      delete this.city.buildingColor;
    } else {
      if (interp.color_override) this.city.colorOverride = interp.color_override;
      if (interp.building_color) this.city.buildingColor = interp.building_color;
      if (interp.grass_color === 'RESET') delete this.city.grassColor;
      else if (interp.grass_color) this.city.grassColor = interp.grass_color;
      if (interp.sky_color === 'RESET') delete this.city.skyColor;
      else if (interp.sky_color) this.city.skyColor = interp.sky_color;
    }

    // ── Eliminate all cells of a type → ruins ─────────────────────────────
    if (interp.eliminar_tipo) {
      let count = 0;
      for (let y = 0; y < this.city.size; y++) {
        for (let x = 0; x < this.city.size; x++) {
          if (this.city.grid[y][x].type === interp.eliminar_tipo) {
            this.city.grid[y][x] = { ...this.city.grid[y][x], type: CELL.RUINS, modified: true, modifiedAt: this.tick };
            count++;
            if (count % 3 === 0) this._addFloat(x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, '💥', '#ff4040', 25);
          }
        }
      }
    }

    // ── Build N cells of a type (built-in or custom) ──────────────────────
    if (interp.construir_tipo) {
      const qty = Math.min(interp.construir_cantidad || 1, 20);
      // Try streets first, fall back to any non-custom cell if no streets available
      let candidates = getCellsOfType(this.city, CELL.STREET);
      if (candidates.length === 0) {
        // No streets — pick random cells from the grid (avoid placing on same type)
        for (let y = 0; y < this.city.size; y++)
          for (let x = 0; x < this.city.size; x++)
            if (this.city.grid[y][x].type !== interp.construir_tipo)
              candidates.push({ x, y });
      }
      const shuffled = candidates.sort(() => this.rng() - 0.5).slice(0, qty);
      for (const cell of shuffled) {
        this.city.grid[cell.y][cell.x] = {
          ...this.city.grid[cell.y][cell.x],
          type: interp.construir_tipo,
          modified: true,
          modifiedAt: this.tick,
        };
        const emoji = interp._featureEmoji || '🏗';
        this._addFloat(cell.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, cell.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, emoji, '#f5c842', 45);
      }
    }

    // ── Rain toggle ────────────────────────────────────────────────────────
    if (interp.toggle_rain !== null && interp.toggle_rain !== undefined) {
      this.city.showRain = interp.toggle_rain;
    }

    // ── Boost all citizens ─────────────────────────────────────────────────
    if (interp.boost_todos) {
      const { e, f, h } = interp.boost_todos;
      for (const c of this.citizens) {
        if (!c.alive) continue;
        if (e != null) c.energy    = Math.max(0, Math.min(100, c.energy    + e));
        if (f != null) c.happiness = Math.max(0, Math.min(100, c.happiness + f));
        if (h != null) c.hunger    = Math.max(0, Math.min(100, c.hunger    + h));
        const emoji = f > 0 ? '🎉' : f < 0 ? '😭' : e > 0 ? '⚡' : '✨';
        this._addFloat(c.pixelX, c.pixelY - 12, emoji, '#f5c842', 35);
      }
    }

    // ── Attribute changes ──────────────────────────────────────────────────
    for (const [idStr, changes] of Object.entries(interp.cambios_atributos || {})) {
      const c = this.citizens.find(c => c.id === parseInt(idStr));
      if (!c || !c.alive) continue;
      if (changes.e != null) c.energy    = Math.max(0,  Math.min(100, c.energy    + changes.e));
      if (changes.f != null) c.happiness = Math.max(0,  Math.min(100, c.happiness + changes.f));
      if (changes.h != null) c.hunger    = Math.max(0,  Math.min(100, c.hunger    + changes.h));
      // If energy hits 0 from attribute change, citizen dies
      if (c.energy <= 0) {
        c.alive = false;
        this.stats.totalDeaths++;
        this._addFloat(c.pixelX, c.pixelY, '💀', '#e85050', 50);
      }
    }

    // World variable changes
    const keyMap = { economia:'economy', felicidad:'happiness', contaminacion:'pollution', cultura:'culture', tecnologia:'technology', crimen:'crime', naturaleza:'nature' };
    for (const [k, v] of Object.entries(interp.cambios_mundo || {})) {
      const key = keyMap[k] || k;
      if (this.worldVars[key] !== undefined) this.worldVars[key] = Math.max(0, Math.min(100, this.worldVars[key] + v));
    }

    // Mass cell modifications
    if (interp.celdas_masivas && interp.celdas_masivas !== 'ninguna' && interp.nuevo_tipo_masivo) {
      const targetTypeMap = { all_residential: CELL.RESIDENTIAL, all_work: CELL.WORK, all_park: CELL.PARK, all_street: CELL.STREET };
      const targetType = targetTypeMap[interp.celdas_masivas];
      let count = 0;
      for (let y = 0; y < this.city.size; y++) {
        for (let x = 0; x < this.city.size; x++) {
          const cell = this.city.grid[y][x];
          // Never overwrite custom cells — they are sacred
          if (hasCustomCell(cell.type)) continue;
          const matches = interp.celdas_masivas === 'all_cells' || cell.type === targetType;
          if (matches) {
            this.city.grid[y][x] = { ...cell, type: interp.nuevo_tipo_masivo, modified: true, modifiedAt: this.tick };
            count++;
            if (count % 5 === 0) {
              this._addFloat(x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2, y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2, '✨', '#f5c842', 25);
            }
          }
        }
      }
      const cx = (this.city.size * CONFIG.CELL_SIZE) / 2;
      const cy = (this.city.size * CONFIG.CELL_SIZE) / 2;
      this._addCityEffect(interp.tipo_de_efecto, cx, cy, interp.duracion_en_ticks);
    }

    // Specific cell modifications
    this._applyCellMods(interp.modificaciones_celda || []);

    // Citizen reactions
    if (interp.reaccion_ciudadanos && interp.reaccion_ciudadanos !== 'ninguna') {
      const toReact = interp.ciudadanos_afectados.length > 0
        ? this.citizens.filter(c => c.alive && interp.ciudadanos_afectados.includes(c.id))
        : this.citizens.filter(c => c.alive);
      this._applyCitizenReaction(interp.reaccion_ciudadanos, interp.ciudadanos_afectados, toReact);
    }

    // Visual effects — always place one at city center for visibility
    const cx = (this.city.size * CONFIG.CELL_SIZE) / 2;
    const cy = (this.city.size * CONFIG.CELL_SIZE) / 2;
    // City-center effect (always visible)
    this.effects.push({
      id: Date.now() + Math.random(),
      type: interp.tipo_de_efecto,
      x: cx, y: cy,
      ticksLeft: interp.duracion_en_ticks * 2, // double duration for visibility
      totalTicks: interp.duracion_en_ticks * 2,
      description: interp.descripcion_visual,
    });
    // If the effect is 'locura' or reaction indicates locura, mark citizens to start AI calls
    if (interp.tipo_de_efecto === 'locura' || interp.reaccion_ciudadanos === 'locura') {
      const targets = interp.ciudadanos_afectados.length > 0
        ? this.citizens.filter(c => c.alive && interp.ciudadanos_afectados.includes(c.id))
        : this.citizens.filter(c => c.alive);
      for (const c of targets) {
        c.insane = true;
        c.nextAiCallTick = this.tick + CONFIG.AI_CALL_INTERVAL_TICKS;
      }
      this.news.addCustom('✦ La población ha caído en la locura', 'crisis');
    }
    // Floating text on each affected citizen (no extra effects to avoid lag)
    const affected = interp.ciudadanos_afectados.map(id => this.citizens.find(c => c.id === id)).filter(Boolean);
    for (const c of affected) {
      this._addFloat(c.pixelX, c.pixelY - 18, '⚡', '#f5c842', 50);
    }
  }

  // ── State emission ────────────────────────────────────────────────────────
  _emitState() {
    this.onStateUpdate?.({
      tick: this.tick,
      citizens: this.citizens,
      city: this.city,
      worldVars: { ...this.worldVars },
      stats: { ...this.stats },
      effects: [...this.effects],
      floatingTexts: [...this.floatingTexts],
      godHistory: [...this.godHistory],
      news: this.news.getHeadlines(),
      running: this.running,
      paused: this.paused,
      speed: this.speed,
      constructions: [...this._constructionQueue],
    });
  }

  findCitizenByName(name) {
    const lower = name.toLowerCase().trim();
    return this.citizens.find(c => c.alive && (c.name.toLowerCase() === lower || c.name.toLowerCase().startsWith(lower))) || null;
  }

  getSimilarNames(name) {
    const lower = name.toLowerCase().trim();
    return this.citizens.filter(c => c.alive).map(c => c.name).filter(n => n.toLowerCase().startsWith(lower.slice(0, 3))).slice(0, 5);
  }
}