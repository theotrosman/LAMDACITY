export const CONFIG = {
  // Grid
  GRID_DEFAULT: 28,
  CELL_SIZE: 40,

  // Population
  POP_INITIAL_MIN: 10,
  POP_INITIAL_MAX: 20,
  POP_MIN: 8,
  POP_MAX: 60,

  // Life cycle (ticks). 1 tick = 800ms at 1x. Day = 120 ticks.
  AGE_CHILD_MAX: 300,
  AGE_YOUTH_MAX: 800,
  AGE_ADULT_MAX: 1600,
  AGE_ELDER_MAX: 2200,
  DAY_LENGTH: 120,

  // Attributes
  ENERGY_MAX: 100,
  HUNGER_MAX: 100,
  HAPPINESS_MAX: 100,

  // Simulation
  TICK_INTERVAL_MS: 800,
  MAX_SPEED: 8,

  // ── GROQ: MINIMAL calls ──────────────────────────────────────────────────
  // Citizens: NO Groq calls for routines — 100% local logic
  // World events: 1 call every 600 ticks (~8 minutes at 1x)
  // God orders: on demand only
  GROQ_MODEL_DEFAULT: 'llama-3.1-8b-instant',
  GROQ_CALL_DELAY_MS: 2000,     // 2s between any calls (30 TPM safe)
  GROQ_TIMEOUT_GOD: 15000,
  GROQ_TIMEOUT_EVENT: 12000,
  GROQ_EVENT_INTERVAL: 600,     // ticks between auto world events
  GROQ_MAX_TOKENS_GOD: 450,
  GROQ_MAX_TOKENS_EVENT: 300,

  // Rendering
  RAIN_PARTICLES: 100,

  // AI / citizen introspection
  AI_CALL_INTERVAL_TICKS: 75, // ~1 minute (75 ticks * 0.8s = 60s)
  AI_MAX_CALLS_PER_TICK: 8,   // throttle external calls per tick

  // UI
  BEHAVIOR_LOG_MAX: 20,
  GOD_HISTORY_MAX: 30,

  // Cell types
  CELL: {
    STREET: 'street',
    RESIDENTIAL: 'residential',
    WORK: 'work',
    PARK: 'park',
    AMUSEMENT: 'amusement',
    MARKET: 'market',
    HOSPITAL: 'hospital',
    SCHOOL: 'school',
    FACTORY: 'factory',
    FOREST: 'forest',
    LAKE: 'lake',
    RUINS: 'ruins',
    FARM: 'farm',
    TEMPLE: 'temple',
    STADIUM: 'stadium',
    PLAZA: 'plaza',
  },

  // Life stages
  STAGE: {
    CHILD: 'infancia',
    YOUTH: 'juventud',
    ADULT: 'adultez',
    ELDER: 'vejez',
  },

  // Jobs
  JOBS: [
    'médico','maestro','ingeniero','artista','comerciante','agricultor',
    'constructor','cocinero','músico','científico','policía','bombero',
    'periodista','abogado','arquitecto','mecánico','jardinero','chef',
    'programador','diseñador','enfermero','piloto','marinero','escritor',
    'fotógrafo','actor','deportista','filósofo','historiador','explorador',
  ],

  VEHICLES: ['bicicleta','moto','auto','camión','patineta','caballo'],

  WORLD_VARS: {
    economy: 50,
    happiness: 60,
    pollution: 20,
    culture: 40,
    technology: 30,
    crime: 10,
    nature: 60,
  },
};
