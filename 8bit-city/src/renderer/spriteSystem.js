// ── Procedural 8-bit sprite system ───────────────────────────────────────────
// Generates unique visual variants for citizens based on their attributes
// 1000+ combinations from: body color × hair × outfit × accessory × stage modifier

const SKIN_TONES = ['#d4a574','#c8956a','#b87850','#8b5e3c','#f0c090','#e8b080','#a06840','#7a4a28'];

const HAIR_STYLES = [
  // [color, pattern] — pattern: 0=flat, 1=spiky, 2=long, 3=bald, 4=curly, 5=mohawk
  ['#1a1a1a',0],['#3a2010',0],['#c8a040',0],['#8b4a20',0],['#6a3a6a',0],['#2a4a6a',0],
  ['#c0c0c0',0],['#8b2020',0],['#1a1a1a',1],['#c8a040',1],['#ff4060',1],['#4060ff',1],
  ['#1a1a1a',2],['#3a2010',2],['#c8a040',2],['#8b4a20',2],['#6a3a6a',2],['#c0c0c0',2],
  ['#1a1a1a',3],['#8b5e3c',3],['#d4a574',3],['#c0c0c0',3],
  ['#1a1a1a',4],['#c8a040',4],['#8b2020',4],['#6a3a6a',4],
  ['#ff4060',5],['#4060ff',5],['#40c060',5],['#c040c0',5],
];

const OUTFIT_COLORS = [
  '#4a6fa5','#8b4a6f','#4a8b6f','#8b7a4a','#6f4a8b','#4a7a8b','#8b5a4a','#5a8b4a',
  '#c04020','#20a060','#2060c0','#c0a020','#8020c0','#20c0a0','#c06020','#6020c0',
  '#404040','#808080','#c0c0c0','#202020','#ff6060','#60ff60','#6060ff','#ffff60',
  '#ff60ff','#60ffff','#ff8020','#20ff80','#8020ff','#ff2080',
];

const ACCESSORIES = [
  null, // none
  'hat_cap',    // baseball cap
  'hat_top',    // top hat
  'glasses',    // glasses
  'scarf',      // scarf
  'backpack',   // backpack
  'crown',      // crown (for special citizens)
  'halo',       // halo
  'horns',      // devil horns
  'flower',     // flower in hair
  'headband',   // headband
  'earrings',   // earrings
];

const JOB_OUTFITS = {
  médico:       { color: '#ffffff', accessory: 'glasses' },
  maestro:      { color: '#8b7a4a', accessory: 'glasses' },
  ingeniero:    { color: '#4a6fa5', accessory: 'hat_cap' },
  artista:      { color: '#c04080', accessory: 'scarf' },
  comerciante:  { color: '#8b5a4a', accessory: 'backpack' },
  agricultor:   { color: '#4a8b4a', accessory: 'hat_cap' },
  constructor:  { color: '#c08020', accessory: 'hat_cap' },
  cocinero:     { color: '#ffffff', accessory: null },
  músico:       { color: '#6f4a8b', accessory: 'scarf' },
  científico:   { color: '#4a7a8b', accessory: 'glasses' },
  policía:      { color: '#2a3a6a', accessory: null },
  bombero:      { color: '#c04020', accessory: null },
  periodista:   { color: '#4a4a6a', accessory: null },
  abogado:      { color: '#2a2a3a', accessory: 'glasses' },
  arquitecto:   { color: '#6a5a4a', accessory: 'glasses' },
  mecánico:     { color: '#3a3a3a', accessory: null },
  jardinero:    { color: '#2a5a2a', accessory: 'hat_cap' },
  chef:         { color: '#f0f0f0', accessory: null },
  programador:  { color: '#1a2a4a', accessory: 'glasses' },
  diseñador:    { color: '#8a4a8a', accessory: null },
  enfermero:    { color: '#e0f0f0', accessory: null },
  piloto:       { color: '#2a4a6a', accessory: null },
  marinero:     { color: '#2a4a8a', accessory: 'hat_cap' },
  escritor:     { color: '#4a3a5a', accessory: 'glasses' },
  fotógrafo:    { color: '#3a3a4a', accessory: null },
  actor:        { color: '#8a2a4a', accessory: null },
  deportista:   { color: '#c04a20', accessory: null },
  filósofo:     { color: '#4a4a2a', accessory: 'glasses' },
  historiador:  { color: '#5a4a3a', accessory: 'glasses' },
  explorador:   { color: '#4a6a3a', accessory: 'hat_cap' },
};

// Get sprite config for a citizen — deterministic based on id
export function getCitizenSprite(citizen) {
  const id = citizen.id || 0;
  const skinIdx = (id * 7 + (citizen.colorIndex || 0)) % SKIN_TONES.length;
  const hairIdx = (id * 13 + (citizen.colorIndex || 0) * 3) % HAIR_STYLES.length;
  const outfitIdx = (id * 17) % OUTFIT_COLORS.length;

  const jobOutfit = JOB_OUTFITS[citizen.job] || null;
  const outfitColor = jobOutfit?.color || OUTFIT_COLORS[outfitIdx];

  // Accessory: job-based or random
  let accessory = jobOutfit?.accessory || null;
  if (!accessory) {
    const accIdx = (id * 11) % ACCESSORIES.length;
    accessory = ACCESSORIES[accIdx];
  }

  // Stage modifiers
  const stageModifier = {
    infancia: { scale: 0.7, accessory: null },
    juventud: { scale: 0.85, accessory },
    adultez:  { scale: 1.0, accessory },
    vejez:    { scale: 0.9, accessory: 'hat_top' },
  }[citizen.stage] || { scale: 1.0, accessory };

  return {
    skin: SKIN_TONES[skinIdx],
    hair: HAIR_STYLES[hairIdx][0],
    hairStyle: HAIR_STYLES[hairIdx][1],
    outfit: outfitColor,
    accessory: stageModifier.accessory,
    scale: stageModifier.scale,
  };
}

// Draw a citizen sprite at (bx, by) with the given sprite config
export function drawCitizenSprite(ctx, bx, by, sprite, isMoving, tick, isSelected, isHovered, energy, isRequesting) {
  const { skin, hair, hairStyle, outfit, accessory, scale } = sprite;
  const s = scale;

  // Scale around center
  const cx = bx + 5, cy = by + 7;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-5, -7);

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#f5c842'; ctx.lineWidth = 1.5 / s;
    ctx.strokeRect(-3, -3, 16, 21);
    ctx.fillStyle = 'rgba(245,200,66,0.12)'; ctx.fillRect(-3, -3, 16, 21);
  }
  if (isHovered && !isSelected) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 / s;
    ctx.strokeRect(-2, -2, 14, 19);
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(1, 14, 8, 2);

  // Body / outfit
  ctx.fillStyle = outfit; ctx.fillRect(2, 5, 6, 7);

  // Head
  ctx.fillStyle = skin; ctx.fillRect(2, 1, 6, 5);

  // Hair
  _drawHair(ctx, hairStyle, hair, 2, 1);

  // Eyes
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(3, 3, 1, 1); ctx.fillRect(6, 3, 1, 1);

  // Legs (animated)
  const walkPhase = isMoving ? Math.floor(tick * 0.6) % 2 : 0;
  ctx.fillStyle = '#1a1a2a';
  if (walkPhase === 0) { ctx.fillRect(3, 12, 2, 3); ctx.fillRect(6, 12, 2, 3); }
  else { ctx.fillRect(3, 13, 2, 2); ctx.fillRect(6, 11, 2, 4); }

  // Accessory
  if (accessory) _drawAccessory(ctx, accessory, tick);

  // Low energy pulse
  if (energy < 20 && Math.sin(tick * 0.4) > 0) {
    ctx.fillStyle = 'rgba(232,80,80,0.45)'; ctx.fillRect(0, 0, 10, 15);
  }

  // Requesting routine (purple shimmer)
  if (isRequesting) {
    ctx.fillStyle = 'rgba(122,90,248,0.5)'; ctx.fillRect(0, 0, 10, 15);
  }

  ctx.restore();
}

function _drawHair(ctx, style, color, bx, by) {
  ctx.fillStyle = color;
  switch (style) {
    case 0: // flat
      ctx.fillRect(bx, by, 6, 2);
      break;
    case 1: // spiky
      ctx.fillRect(bx, by, 6, 2);
      ctx.fillRect(bx+1, by-2, 1, 2); ctx.fillRect(bx+3, by-3, 1, 3); ctx.fillRect(bx+5, by-2, 1, 2);
      break;
    case 2: // long
      ctx.fillRect(bx, by, 6, 2);
      ctx.fillRect(bx, by+2, 1, 4); ctx.fillRect(bx+5, by+2, 1, 4);
      break;
    case 3: // bald — no hair
      break;
    case 4: // curly
      ctx.fillRect(bx, by, 6, 3);
      ctx.fillRect(bx-1, by+1, 1, 2); ctx.fillRect(bx+6, by+1, 1, 2);
      break;
    case 5: // mohawk
      ctx.fillRect(bx+2, by-3, 2, 5);
      break;
  }
}

function _drawAccessory(ctx, accessory, tick) {
  switch (accessory) {
    case 'hat_cap':
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(1, -1, 8, 2); ctx.fillRect(2, -3, 6, 2);
      break;
    case 'hat_top':
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(2, -5, 6, 5); ctx.fillRect(1, -1, 8, 1);
      break;
    case 'glasses':
      ctx.fillStyle = '#888888';
      ctx.fillRect(2, 3, 2, 1); ctx.fillRect(6, 3, 2, 1); ctx.fillRect(4, 3, 2, 1);
      break;
    case 'scarf':
      ctx.fillStyle = '#c04040'; ctx.fillRect(2, 5, 6, 2);
      break;
    case 'backpack':
      ctx.fillStyle = '#8b5a4a'; ctx.fillRect(8, 5, 3, 5);
      break;
    case 'crown':
      ctx.fillStyle = '#f5c842';
      ctx.fillRect(2, -3, 6, 2); ctx.fillRect(2, -5, 1, 2); ctx.fillRect(5, -6, 1, 3); ctx.fillRect(7, -5, 1, 2);
      break;
    case 'halo':
      ctx.fillStyle = 'rgba(255,220,50,0.8)';
      ctx.fillRect(1, -4, 8, 1); ctx.fillRect(0, -3, 1, 1); ctx.fillRect(9, -3, 1, 1);
      break;
    case 'horns':
      ctx.fillStyle = '#c04020';
      ctx.fillRect(2, -4, 1, 3); ctx.fillRect(7, -4, 1, 3);
      break;
    case 'flower':
      ctx.fillStyle = '#ff60c0'; ctx.fillRect(7, -1, 3, 3);
      ctx.fillStyle = '#f5c842'; ctx.fillRect(8, 0, 1, 1);
      break;
    case 'headband':
      ctx.fillStyle = '#c04040'; ctx.fillRect(2, 1, 6, 1);
      break;
    case 'earrings':
      ctx.fillStyle = '#f5c842'; ctx.fillRect(1, 4, 1, 2); ctx.fillRect(8, 4, 1, 2);
      break;
  }
}
