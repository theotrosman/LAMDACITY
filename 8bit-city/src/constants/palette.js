// Lofi pixel art color palette - warm, desaturated, max 32 colors
export const PALETTE = {
  // Sky colors
  SKY_NIGHT: '#1a1a2e',
  SKY_DUSK: '#2d1b4e',
  SKY_SUNSET: '#4a2040',
  SKY_DAWN: '#3d2b1f',

  // Ground / streets
  STREET: '#2a2a3a',
  STREET_LIGHT: '#3a3a4a',
  SIDEWALK: '#3d3d4d',

  // Buildings
  BUILDING_DARK: '#1e2030',
  BUILDING_MID: '#252840',
  BUILDING_LIGHT: '#2e3250',
  BUILDING_WORK: '#1a2535',
  BUILDING_WORK_LIGHT: '#1e2d40',

  // Windows
  WINDOW_OFF: '#1a1a2a',
  WINDOW_WARM: '#f5c842',
  WINDOW_WARM2: '#e8a020',
  WINDOW_COOL: '#6ab0d4',
  WINDOW_DIM: '#8a6020',

  // Park / nature
  PARK_DARK: '#1a2e1a',
  PARK_MID: '#1e3a1e',
  PARK_LIGHT: '#2a4a2a',
  TREE_DARK: '#1a3020',
  TREE_MID: '#224028',

  // Citizens
  CITIZEN_SKIN: '#d4a574',
  CITIZEN_DARK: '#8b5e3c',
  CITIZEN_CLOTHES1: '#4a6fa5',
  CITIZEN_CLOTHES2: '#8b4a6f',
  CITIZEN_CLOTHES3: '#4a8b6f',
  CITIZEN_CLOTHES4: '#8b7a4a',

  // UI
  UI_BG: '#0d0d1a',
  UI_PANEL: '#12121f',
  UI_BORDER: '#2a2a4a',
  UI_TEXT: '#c8c8e8',
  UI_TEXT_DIM: '#6a6a8a',
  UI_ACCENT: '#7a5af8',
  UI_ACCENT2: '#f5c842',
  UI_ERROR: '#e85050',
  UI_SUCCESS: '#50c878',

  // Effects
  EFFECT_FIRE: '#ff6030',
  EFFECT_SPARK: '#ffcc00',
  EFFECT_RAIN: '#4a6a8a',
  EFFECT_MAGIC: '#c060ff',
  EFFECT_HEAL: '#60ff90',
  EFFECT_SHOCK: '#60c0ff',
};

export const CITIZEN_COLORS = [
  PALETTE.CITIZEN_CLOTHES1,
  PALETTE.CITIZEN_CLOTHES2,
  PALETTE.CITIZEN_CLOTHES3,
  PALETTE.CITIZEN_CLOTHES4,
];

export const EFFECT_COLORS = {
  explosion:     ['#ff6030', '#ffcc00', '#ff9040'],
  rain:          ['#4a6a8a', '#6a8aaa', '#3a5a7a'],
  magia:         ['#c060ff', '#8040ff', '#ff60c0'],
  curacion:      ['#60ff90', '#40ff70', '#a0ffb0'],
  rayo:          ['#60c0ff', '#40a0ff', '#ffffff'],
  lluvia_objetos:['#f5c842', '#ff9060', '#50c878'],
  onda:          ['#7a5af8', '#4a8af8', '#c060ff'],
  destello:      ['#ffffff', '#f5c842', '#ffcc00'],
  fuego:         ['#ff4010', '#ff8020', '#ffcc00'],
  nieve:         ['#c0d8ff', '#e0f0ff', '#ffffff'],
  locura:        ['#ff99cc', '#ff66aa', '#ff4088'],
  arcoiris:      ['#ff4040', '#ff9040', '#f5c842', '#50c878', '#4a8af8', '#c060ff'],
  generico:      ['#7a5af8', '#f5c842', '#c8c8e8'],
};
