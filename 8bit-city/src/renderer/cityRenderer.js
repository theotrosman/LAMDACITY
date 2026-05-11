import { PALETTE, EFFECT_COLORS } from '../constants/palette.js';
import { CONFIG } from '../constants/config.js';
import { getCitizenSprite, drawCitizenSprite } from './spriteSystem.js';
import { drawCustomCell, hasCustomCell } from '../engine/customCellRegistry.js';

const CS = CONFIG.CELL_SIZE;
const { CELL } = CONFIG;

export class CityRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.animFrame = 0;
    this.showRain = false;
    this.rainParticles = Array.from({ length: CONFIG.RAIN_PARTICLES }, () => ({
      x: Math.random() * 3000, y: Math.random() * 3000,
      speed: 3 + Math.random() * 4, length: 6 + Math.random() * 8,
    }));

    // Zoom & pan
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = 0.3;
    this.maxZoom = 4;

    // Interaction state
    this.hoveredCitizen = null;
    this.mouseCanvasX = 0;
    this.mouseCanvasY = 0;
    this.selectedIds = new Set();

    // Selection box (drag)
    this.selectionBox = null; // { x1, y1, x2, y2 } in world coords
  }

  // ── Zoom & Pan ────────────────────────────────────────────────────────────

  applyZoom(delta, centerX, centerY, citySize) {
    const factor = delta > 0 ? 1.15 : 0.87;
    // Min zoom = city fills the canvas exactly (can't zoom out beyond city bounds)
    const worldSize = (citySize || 22) * CS;
    const fitZoom = Math.min(this.canvas.width / worldSize, this.canvas.height / worldSize);
    const minZoom = Math.max(fitZoom, 0.1);

    const newZoom = Math.max(minZoom, Math.min(this.maxZoom, this.zoom * factor));
    this.panX = centerX - (centerX - this.panX) * (newZoom / this.zoom);
    this.panY = centerY - (centerY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;
  }

  pan(dx, dy) {
    this.panX += dx;
    this.panY += dy;
  }

  resetView(citySize) {
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const worldSize = citySize * CS;
    this.zoom = Math.min(canvasW / worldSize, canvasH / worldSize) * 0.95;
    this.panX = (canvasW - worldSize * this.zoom) / 2;
    this.panY = (canvasH - worldSize * this.zoom) / 2;
  }

  // Convert canvas pixel → world pixel
  canvasToWorld(cx, cy) {
    return { x: (cx - this.panX) / this.zoom, y: (cy - this.panY) / this.zoom };
  }

  // ── Hover & Selection ─────────────────────────────────────────────────────

  setHover(citizen, canvasX, canvasY) {
    this.hoveredCitizen = citizen;
    this.mouseCanvasX = canvasX;
    this.mouseCanvasY = canvasY;
  }

  setSelectedIds(ids) {
    this.selectedIds = new Set(ids);
  }

  setSelectionBox(box) {
    this.selectionBox = box;
  }

  getCitizenAtCanvas(citizens, cx, cy, radius = 12) {
    const { x: wx, y: wy } = this.canvasToWorld(cx, cy);
    const r = radius / this.zoom;
    for (const c of citizens) {
      if (!c.alive) continue;
      const dx = c.pixelX - wx, dy = c.pixelY - wy;
      if (Math.sqrt(dx*dx + dy*dy) <= r) return c;
    }
    return null;
  }

  getCitizensInBox(citizens, box) {
    const x1 = Math.min(box.x1, box.x2), x2 = Math.max(box.x1, box.x2);
    const y1 = Math.min(box.y1, box.y2), y2 = Math.max(box.y1, box.y2);
    return citizens.filter(c => c.alive &&
      c.pixelX >= x1 && c.pixelX <= x2 &&
      c.pixelY >= y1 && c.pixelY <= y2
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  render(state) {
    if (!state?.city) return;
    const { city, citizens, effects, floatingTexts = [], tick } = state;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    this.animFrame++;

    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Apply zoom/pan transform
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    const worldW = city.size * CS, worldH = city.size * CS;
    const dayPhase = (tick % CONFIG.DAY_LENGTH) / CONFIG.DAY_LENGTH;

    // Sky
    ctx.fillStyle = state.city.skyColor || this._getSkyColor(dayPhase);
    ctx.fillRect(0, 0, worldW, worldH);

    // Cells
    for (let y = 0; y < city.size; y++)
      for (let x = 0; x < city.size; x++)
        this._drawCell(ctx, city.grid[y][x], x, y, dayPhase, tick, city.grassColor, city.buildingColor);

    // Always reset shadow after cells (some cells use shadowBlur)
    ctx.shadowBlur = 0;

    // Color tint overlay (god order: "toda la ciudad sea rosa", etc.)
    // Use a proper tint instead of a flat overlay so buildings still look like buildings
    if (city.colorOverride) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = city.colorOverride;
      ctx.fillRect(0, 0, worldW, worldH);
      ctx.restore();
    }

    // Citizens
    for (const c of citizens)
      if (c.alive) this._drawCitizen(ctx, c, tick, state.selectedIds || []);

    // Effects
    for (const e of effects) this._drawEffect(ctx, e, tick);

    // Floating texts
    for (const t of floatingTexts) this._drawFloatingText(ctx, t);

    // Rain
    if (this.showRain) this._drawRain(ctx, worldW, worldH);

    // Selection box (in world coords)
    if (this.selectionBox) {
      const { x1, y1, x2, y2 } = this.selectionBox;
      ctx.strokeStyle = '#f5c842';
      ctx.lineWidth = 1 / this.zoom;
      ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
      ctx.strokeRect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
      ctx.fillStyle = 'rgba(245,200,66,0.08)';
      ctx.fillRect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Tooltip drawn as HTML overlay — skip canvas tooltip
    // if (this.hoveredCitizen) this._drawTooltip(...)

    // Selection count badge
    if (this.selectedIds.size > 0) {
      this._drawSelectionBadge(ctx, W, H);
    }
  }

  // ── Sky ───────────────────────────────────────────────────────────────────

  _getSkyColor(phase) {
    const stops = [
      [0,'#0d0d1e'],[0.2,'#1a1a2e'],[0.28,'#2d1b4e'],[0.35,'#4a2040'],
      [0.45,'#2e1a30'],[0.55,'#1e1a30'],[0.7,'#2d1b4e'],[0.78,'#4a2040'],
      [0.85,'#2e1a30'],[1.0,'#0d0d1e'],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0,c0] = stops[i], [t1,c1] = stops[i+1];
      if (phase >= t0 && phase <= t1)
        return this._lerpColor(c0, c1, (phase-t0)/(t1-t0));
    }
    return '#0d0d1e';
  }

  _lerpColor(c1, c2, t) {
    const p = (c) => [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
    const [r1,g1,b1] = p(c1), [r2,g2,b2] = p(c2);
    const r = Math.round(r1+(r2-r1)*t), g = Math.round(g1+(g2-g1)*t), b = Math.round(b1+(b2-b1)*t);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  // Darken a hex color by factor (0=black, 1=original)
  _darkenColor(hex, factor) {
    try {
      const r = Math.round(parseInt(hex.slice(1,3),16) * factor);
      const g = Math.round(parseInt(hex.slice(3,5),16) * factor);
      const b = Math.round(parseInt(hex.slice(5,7),16) * factor);
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    } catch { return hex; }
  }

  // ── Cells ─────────────────────────────────────────────────────────────────

  _drawCell(ctx, cell, x, y, phase, tick, grassColor, buildingColor) {
    const px = x*CS, py = y*CS;
    const isNight = phase < 0.3 || phase > 0.72;
    switch (cell.type) {
      case CELL.STREET:      this._drawStreet(ctx, px, py, x, y); break;
      case CELL.RESIDENTIAL: this._drawResidential(ctx, cell, px, py, isNight, tick, buildingColor); break;
      case CELL.WORK:        this._drawWork(ctx, cell, px, py, isNight, tick, buildingColor); break;
      case CELL.PARK:        this._drawPark(ctx, cell, px, py, tick, grassColor); break;
      case CELL.AMUSEMENT:   this._drawAmusement(ctx, px, py, tick); break;
      case CELL.MARKET:      this._drawMarket(ctx, px, py, isNight, tick, buildingColor); break;
      case CELL.HOSPITAL:    this._drawHospital(ctx, px, py, isNight, buildingColor); break;
      case CELL.SCHOOL:      this._drawSchool(ctx, px, py, isNight, buildingColor); break;
      case CELL.FACTORY:     this._drawFactory(ctx, px, py, tick, buildingColor); break;
      case CELL.FOREST:      this._drawForest(ctx, px, py, tick, grassColor); break;
      case CELL.LAKE:        this._drawLake(ctx, px, py, tick); break;
      case CELL.RUINS:       this._drawRuins(ctx, px, py); break;
      case CELL.FARM:        this._drawFarm(ctx, px, py, tick, grassColor); break;
      case CELL.TEMPLE:      this._drawTemple(ctx, px, py, isNight, tick, buildingColor); break;
      case CELL.STADIUM:     this._drawStadium(ctx, px, py, tick, buildingColor); break;
      case CELL.PLAZA:       this._drawPlaza(ctx, px, py, tick); break;
      default:
        if (hasCustomCell(cell.type)) {
          drawCustomCell(cell.type, ctx, px, py, CS, tick, isNight);
        } else {
          ctx.fillStyle = '#252535'; ctx.fillRect(px, py, CS, CS);
        }
    }
    // Modified cell glow
    if (cell.modified) {
      ctx.strokeStyle = 'rgba(245,200,66,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px+1, py+1, CS-2, CS-2);
    }
    // Building color tint — applied after drawing for non-nature cells
    const BUILDING_TYPES = new Set([
      CELL.RESIDENTIAL, CELL.WORK, CELL.MARKET, CELL.HOSPITAL,
      CELL.SCHOOL, CELL.FACTORY, CELL.TEMPLE, CELL.STADIUM, CELL.AMUSEMENT,
    ]);
    if (buildingColor && BUILDING_TYPES.has(cell.type)) {
      this._applyBuildingTint(ctx, px, py, buildingColor);
    }
  }

  // Tint a cell with a color while preserving detail (multiply blend)
  _applyBuildingTint(ctx, px, py, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, CS, CS);
    ctx.restore();
  }

  _drawStreet(ctx, px, py, gx, gy) {
    ctx.fillStyle = '#252535'; ctx.fillRect(px, py, CS, CS);
    if ((gx+gy)%8===0) { ctx.fillStyle='#3a3a50'; ctx.fillRect(px+CS/2-1,py+4,2,CS/2-8); }
    ctx.fillStyle='#2e2e42';
    ctx.fillRect(px,py,CS,3); ctx.fillRect(px,py+CS-3,CS,3);
    ctx.fillRect(px,py,3,CS); ctx.fillRect(px+CS-3,py,3,CS);
  }

  _drawResidential(ctx, cell, px, py, isNight, tick, buildingColor) {
    const h = cell.id ? (parseInt(cell.id.replace(',',''),10)%3) : 0;
    const top = h*4;
    ctx.fillStyle = ['#1e2030','#252840','#2a2e50'][h];
    ctx.fillRect(px, py+top, CS, CS-top);
    ctx.fillStyle='#161825'; ctx.fillRect(px,py+top,CS,5);
    ctx.fillStyle='#1a1c28'; ctx.fillRect(px+CS-8,py+top-5,4,6);
    const cols=3,rows=4,ww=5,wh=4;
    const xPad=Math.floor((CS-cols*(ww+3))/2);
    for (let wy=0;wy<rows;wy++) for (let wx=0;wx<cols;wx++) {
      const wpx=px+xPad+wx*(ww+3), wpy=py+top+8+wy*(wh+4);
      if (wpy+wh>py+CS-4) continue;
      const seed=(cell.x*7+cell.y*13+wx*3+wy*5)%10;
      const lit=seed>3;
      const flicker=isNight&&lit&&Math.sin(tick*0.07+seed)>0.92;
      ctx.shadowBlur=0;
      if (isNight&&lit) { ctx.fillStyle=flicker?'#ffdd60':'#f5c842'; ctx.shadowColor='#f5c842'; ctx.shadowBlur=4; }
      else if (!isNight&&lit) ctx.fillStyle='#6ab0d4';
      else ctx.fillStyle='#12121e';
      ctx.fillRect(wpx,wpy,ww,wh); ctx.shadowBlur=0;
    }
    ctx.fillStyle='#0e0e1a'; ctx.fillRect(px+CS/2-3,py+CS-9,6,9);
    ctx.fillStyle='#3a3a5a'; ctx.fillRect(px+CS/2-2,py+CS-8,2,3);
  }

  _drawWork(ctx, cell, px, py, isNight, tick, buildingColor) {
    ctx.fillStyle='#151e2a'; ctx.fillRect(px,py,CS,CS);
    ctx.fillStyle='#1a2535'; ctx.fillRect(px+3,py+6,CS-6,CS-10);
    ctx.fillStyle='#0e1520'; ctx.fillRect(px,py,CS,6);
    ctx.fillStyle='#2a3545'; ctx.fillRect(px+CS/2-1,py-6,2,8);
    const blink=Math.floor(tick/15)%2===0;
    ctx.fillStyle=blink?'#ff4040':'#800000'; ctx.fillRect(px+CS/2-1,py-7,2,2);
    for (let wy=0;wy<4;wy++) for (let wx=0;wx<3;wx++) {
      const wpx=px+5+wx*10, wpy=py+9+wy*7;
      if (wpy+4>py+CS-4) continue;
      const seed=(cell.x*11+cell.y*7+wx+wy*3)%10;
      ctx.fillStyle=(isNight?seed>4:seed>2)?(isNight?'#4a8af8':'#6ab0d4'):'#0a1020';
      ctx.fillRect(wpx,wpy,7,4);
    }
    if (buildingColor) this._applyBuildingTint(ctx, px, py, buildingColor);
  }

  _drawPark(ctx, cell, px, py, tick, grassColor) {
    ctx.fillStyle = grassColor ? this._darkenColor(grassColor, 0.6) : '#1a2e1a'; ctx.fillRect(px,py,CS,CS);
    ctx.fillStyle = grassColor ? this._darkenColor(grassColor, 0.7) : '#1e3520'; ctx.fillRect(px+2,py+2,CS-4,CS-4);
    ctx.fillStyle='#2a2a3a';
    ctx.fillRect(px+CS/2-2,py,4,CS); ctx.fillRect(px,py+CS/2-2,CS,4);
    for (const [tx,ty] of [[4,4],[CS-12,4],[4,CS-14],[CS-12,CS-14]]) {
      const sway=Math.sin(tick*0.04+tx*0.3)>0.9?1:0;
      ctx.fillStyle='#5a3a1a'; ctx.fillRect(px+tx+3,py+ty+6,2,5);
      ctx.fillStyle='#224028'; ctx.fillRect(px+tx+sway,py+ty+2,8,5);
      ctx.fillStyle='#1e3820'; ctx.fillRect(px+tx+1+sway,py+ty,6,4);
      ctx.fillStyle='#2a4a28'; ctx.fillRect(px+tx+2,py+ty-1,4,3);
    }
    ctx.fillStyle='#4a3a2a';
    ctx.fillRect(px+CS/2-5,py+CS/2+2,10,2);
    ctx.fillRect(px+CS/2-4,py+CS/2+4,2,3);
    ctx.fillRect(px+CS/2+2,py+CS/2+4,2,3);
  }

  // ── Special cells ─────────────────────────────────────────────────────────

  _drawAmusement(ctx, px, py, tick) {
    // Colorful amusement park
    ctx.fillStyle = '#2a1a3a'; ctx.fillRect(px, py, CS, CS);
    // Ferris wheel
    const cx = px + CS/2, cy = py + CS/2;
    const r = CS/3 - 2;
    ctx.strokeStyle = '#c060ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    // Rotating spokes
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2 + tick*0.03;
      ctx.strokeStyle = ['#ff60c0','#c060ff','#60c0ff','#f5c842','#50c878','#ff9060'][i];
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r); ctx.stroke();
    }
    // Lights
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2 + tick*0.05;
      ctx.fillStyle = Math.floor(tick/5+i)%2===0 ? '#f5c842' : '#ff60c0';
      ctx.fillRect(Math.round(cx+Math.cos(a)*r)-1, Math.round(cy+Math.sin(a)*r)-1, 2, 2);
    }
    ctx.lineWidth = 1;
  }

  _drawMarket(ctx, px, py, isNight, tick) {
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(px, py, CS, CS);
    // Awning stripes
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i%2===0 ? '#c04020' : '#e06030';
      ctx.fillRect(px + i*(CS/4), py, CS/4, 8);
    }
    // Stalls
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(px+3, py+10, CS-6, CS-14);
    // Items on display
    const items = ['#ff6030','#f5c842','#50c878','#4a8af8'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = items[i]; ctx.fillRect(px+4+i*8, py+14, 5, 5);
    }
    // Sign light
    if (isNight) { ctx.fillStyle='#f5c842'; ctx.shadowColor='#f5c842'; ctx.shadowBlur=6; }
    else ctx.fillStyle='#c04020';
    ctx.fillRect(px+CS/2-8, py+1, 16, 5); ctx.shadowBlur=0;
  }

  _drawHospital(ctx, px, py, isNight) {
    ctx.fillStyle = '#1a2a2a'; ctx.fillRect(px, py, CS, CS);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(px+CS/2-2, py+4, 4, 12);
    ctx.fillRect(px+CS/2-6, py+8, 12, 4);
    // Windows
    for (let r=0;r<3;r++) for (let c=0;c<3;c++) {
      ctx.fillStyle = isNight ? '#60c0ff' : '#a0d0e0';
      ctx.fillRect(px+4+c*10, py+20+r*7, 6, 4);
    }
    if (isNight) { ctx.fillStyle='#60c0ff'; ctx.shadowColor='#60c0ff'; ctx.shadowBlur=8; ctx.fillRect(px+CS/2-2,py+4,4,12); ctx.fillRect(px+CS/2-6,py+8,12,4); ctx.shadowBlur=0; }
  }

  _drawSchool(ctx, px, py, isNight) {
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(px, py, CS, CS);
    ctx.fillStyle = '#c08030'; ctx.fillRect(px+2, py+8, CS-4, CS-10);
    ctx.fillStyle = '#8a5020'; ctx.fillRect(px, py+4, CS, 6);
    // Bell tower
    ctx.fillStyle = '#c08030'; ctx.fillRect(px+CS/2-3, py, 6, 6);
    ctx.fillStyle = '#f5c842'; ctx.fillRect(px+CS/2-1, py+1, 2, 3);
    // Windows
    for (let c=0;c<3;c++) {
      ctx.fillStyle = isNight ? '#f5c842' : '#6ab0d4';
      ctx.fillRect(px+4+c*11, py+14, 7, 6);
    }
  }

  _drawFactory(ctx, px, py, tick) {
    ctx.fillStyle = '#1a1a20'; ctx.fillRect(px, py, CS, CS);
    ctx.fillStyle = '#2a2a35'; ctx.fillRect(px+2, py+12, CS-4, CS-14);
    // Chimneys
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#1a1a28'; ctx.fillRect(px+4+i*12, py+2, 6, 12);
      // Smoke
      if (Math.floor(tick/8+i)%3 !== 0) {
        ctx.fillStyle = 'rgba(100,100,120,0.5)';
        ctx.fillRect(px+5+i*12, py-2+Math.sin(tick*0.1+i)*2, 4, 4);
      }
    }
    // Windows
    for (let c=0;c<4;c++) {
      ctx.fillStyle = Math.floor(tick/20+c)%2===0 ? '#f5c842' : '#2a3545';
      ctx.fillRect(px+3+c*9, py+16, 6, 4);
    }
  }

  _drawForest(ctx, px, py, tick, grassColor) {
    ctx.fillStyle = grassColor ? this._darkenColor(grassColor, 0.5) : '#0d1a0d'; ctx.fillRect(px, py, CS, CS);
    // Dense trees
    const positions = [[4,4],[14,2],[24,5],[2,16],[12,14],[22,12],[6,26],[18,24],[28,20]];
    for (const [tx,ty] of positions) {
      if (tx+8>CS || ty+10>CS) continue;
      const sway = Math.sin(tick*0.03+tx*0.5)*0.8;
      ctx.fillStyle='#3a2010'; ctx.fillRect(px+tx+3,py+ty+7,2,4);
      ctx.fillStyle='#1a3a18'; ctx.fillRect(px+tx+sway,py+ty+3,8,5);
      ctx.fillStyle='#0d2a0d'; ctx.fillRect(px+tx+1+sway,py+ty,6,4);
      ctx.fillStyle='#224a20'; ctx.fillRect(px+tx+2,py+ty-1,4,3);
    }
  }

  _drawLake(ctx, px, py, tick) {
    ctx.fillStyle = '#0a1a2a'; ctx.fillRect(px, py, CS, CS);
    // Water shimmer
    for (let i = 0; i < 5; i++) {
      const wave = Math.sin(tick*0.08+i*1.2)*2;
      ctx.fillStyle = `rgba(74,138,200,${0.3+i*0.05})`;
      ctx.fillRect(px+2, py+4+i*6+wave, CS-4, 3);
    }
    // Reflection sparkles
    if (Math.floor(tick/4)%3===0) {
      ctx.fillStyle='rgba(200,220,255,0.6)';
      ctx.fillRect(px+CS/2-1, py+CS/2-1, 2, 2);
    }
    // Shore
    ctx.fillStyle='#2a3a1a'; ctx.fillRect(px,py,CS,3); ctx.fillRect(px,py+CS-3,CS,3);
    ctx.fillRect(px,py,3,CS); ctx.fillRect(px+CS-3,py,3,CS);
  }

  _drawRuins(ctx, px, py) {
    ctx.fillStyle = '#1a1a18'; ctx.fillRect(px, py, CS, CS);
    // Broken walls
    ctx.fillStyle='#3a3530'; ctx.fillRect(px+2,py+8,8,CS-10); ctx.fillRect(px+CS-10,py+12,8,CS-14);
    ctx.fillRect(px+2,py+8,CS-4,6);
    // Rubble
    ctx.fillStyle='#2a2520';
    for (let i=0;i<6;i++) ctx.fillRect(px+4+i*5, py+CS-8, 4, 4+(i%3));
    // Cracks
    ctx.fillStyle='#0a0a08';
    ctx.fillRect(px+CS/2,py+10,1,12); ctx.fillRect(px+8,py+CS-12,1,8);
  }

  _drawFarm(ctx, px, py, tick, grassColor) {
    ctx.fillStyle = grassColor ? this._darkenColor(grassColor, 0.6) : '#1a2a10'; ctx.fillRect(px, py, CS, CS);
    // Crop rows
    for (let r=0;r<4;r++) {
      ctx.fillStyle = r%2===0 ? '#2a4a18' : '#1e3a12';
      ctx.fillRect(px+2, py+4+r*8, CS-4, 6);
      // Crops
      for (let c=0;c<5;c++) {
        const grow = Math.sin(tick*0.05+c+r)*0.5+0.5;
        ctx.fillStyle='#50c830';
        ctx.fillRect(px+4+c*7, py+4+r*8, 2, Math.round(2+grow*3));
      }
    }
    // Barn
    ctx.fillStyle='#8a3020'; ctx.fillRect(px+CS-12,py+2,10,12);
    ctx.fillStyle='#6a2010'; ctx.fillRect(px+CS-12,py+2,10,4);
  }

  _drawTemple(ctx, px, py, isNight, tick) {
    ctx.fillStyle = '#1a1520'; ctx.fillRect(px, py, CS, CS);
    // Columns
    for (let i=0;i<4;i++) { ctx.fillStyle='#3a3550'; ctx.fillRect(px+3+i*9,py+8,5,CS-10); }
    // Roof
    ctx.fillStyle='#2a2540'; ctx.fillRect(px,py+4,CS,6);
    // Glow
    if (isNight) {
      ctx.fillStyle='rgba(180,120,255,0.3)'; ctx.fillRect(px+2,py+8,CS-4,CS-10);
      ctx.fillStyle='#c060ff'; ctx.shadowColor='#c060ff'; ctx.shadowBlur=8;
      ctx.fillRect(px+CS/2-2,py+10,4,CS-14); ctx.shadowBlur=0;
    }
    // Stars above
    if (Math.floor(tick/10)%2===0) { ctx.fillStyle='#f5c842'; ctx.fillRect(px+CS/2-1,py+1,2,2); }
  }

  _drawStadium(ctx, px, py, tick) {
    // Much better stadium — oval with proper stands
    ctx.fillStyle = '#0a1020'; ctx.fillRect(px, py, CS, CS);
    // Outer structure
    ctx.fillStyle = '#1a2040'; ctx.fillRect(px+1, py+1, CS-2, CS-2);
    // Green field
    ctx.fillStyle = '#1a4a18'; ctx.fillRect(px+6, py+10, CS-12, CS-20);
    ctx.fillStyle = '#224a20'; ctx.fillRect(px+8, py+12, CS-16, CS-24);
    // Field lines
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(px+CS/2-1, py+12, 2, CS-24);
    ctx.fillRect(px+8, py+CS/2-1, CS-16, 2);
    // Center circle
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px+CS/2, py+CS/2, 6, 0, Math.PI*2); ctx.stroke();
    // Stands — colorful crowd
    const standColors = ['#c04020','#4a8af8','#f5c842','#50c878','#c060ff'];
    for (let i = 0; i < CS-2; i += 3) {
      ctx.fillStyle = standColors[Math.floor((i + Math.floor(tick/10)) / 3) % standColors.length];
      ctx.fillRect(px+1+i, py+1, 2, 7);       // top stand
      ctx.fillRect(px+1+i, py+CS-8, 2, 7);    // bottom stand
    }
    for (let i = 0; i < CS-18; i += 3) {
      ctx.fillStyle = standColors[Math.floor((i + Math.floor(tick/10)) / 3) % standColors.length];
      ctx.fillRect(px+1, py+10+i, 4, 2);      // left stand
      ctx.fillRect(px+CS-5, py+10+i, 4, 2);   // right stand
    }
    // Floodlights
    ctx.fillStyle = '#f0f0a0';
    ctx.fillRect(px+2, py+2, 3, 3); ctx.fillRect(px+CS-5, py+2, 3, 3);
    ctx.fillRect(px+2, py+CS-5, 3, 3); ctx.fillRect(px+CS-5, py+CS-5, 3, 3);
    if (Math.floor(tick/4)%2===0) {
      ctx.fillStyle='rgba(255,255,200,0.3)';
      ctx.fillRect(px+2,py+2,CS-4,8);
    }
    ctx.lineWidth=1;
  }

  _drawPlaza(ctx, px, py, tick) {
    ctx.fillStyle = '#252535'; ctx.fillRect(px, py, CS, CS);
    // Tiles
    for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
      ctx.fillStyle = (r+c)%2===0 ? '#2e2e42' : '#252535';
      ctx.fillRect(px+c*(CS/4), py+r*(CS/4), CS/4, CS/4);
    }
    // Fountain
    ctx.fillStyle='#1a3a5a'; ctx.fillRect(px+CS/2-5,py+CS/2-5,10,10);
    const splash = Math.sin(tick*0.15)*2;
    ctx.fillStyle='#4a8af8'; ctx.fillRect(px+CS/2-1,py+CS/2-5-splash,2,4+splash);
    // Benches
    ctx.fillStyle='#4a3a2a';
    ctx.fillRect(px+4,py+CS/2-2,6,2); ctx.fillRect(px+CS-10,py+CS/2-2,6,2);
  }

  // ── Citizens ──────────────────────────────────────────────────────────────

  _drawCitizen(ctx, citizen, tick, selectedIds) {
    const { pixelX, pixelY, stage, behavior, energy } = citizen;
    const isMoving = citizen.path && citizen.pathIndex < citizen.path.length;
    const isSelected = this.selectedIds.has(citizen.id);
    const isHovered = this.hoveredCitizen?.id === citizen.id;
    const bx = Math.round(pixelX) - 5;
    const by = Math.round(pixelY) - 7;

    // Get or cache sprite config
    if (!citizen._sprite || citizen._spriteDirty) {
      citizen._sprite = getCitizenSprite(citizen);
      citizen._spriteDirty = false;
    }

    drawCitizenSprite(ctx, bx, by, citizen._sprite, isMoving, tick, isSelected, isHovered, energy, citizen.isRequestingRoutine);

    // Stage dot above head
    const stageDot = { infancia:'#ffcc00', juventud:'#50c878', adultez:'#7a5af8', vejez:'#aaaaaa' };
    ctx.fillStyle = stageDot[stage] || '#fff';
    ctx.fillRect(bx + 4, by - 5, 2, 2);

    // Action dot (tiny colored square)
    const actionColors = { trabajar:'#f5c842', comer:'#ff9060', dormir:'#6090ff', socializar:'#50c878',
      caminar:'#888899', explorar:'#c060ff', descansar:'#6090ff', jugar:'#ff60c0', leer:'#60c0ff', comprar:'#ffcc00' };
    if (behavior?.action && actionColors[behavior.action]) {
      ctx.fillStyle = actionColors[behavior.action];
      ctx.fillRect(bx + 9, by - 5, 3, 3);
    }
  }

  // ── Floating texts ────────────────────────────────────────────────────────

  _drawFloatingText(ctx, t) {
    ctx.save();
    ctx.globalAlpha = t.life / t.maxLife;
    ctx.font = `${Math.round(12 / this.zoom * 1.5)}px serif`;
    ctx.fillText(t.text, t.x - 6, t.y);
    ctx.restore();
  }

  // ── Tooltip (canvas space) ────────────────────────────────────────────────

  _drawTooltip(ctx, citizen, W, H) {
    const { name, stage, energy, hunger, happiness, behavior, personality, age, job, vehicle, relationships } = citizen;
    const relCount = Object.keys(relationships || {}).length;
    const lines = [
      { text: `${name}`, color: '#f5c842', size: 16 },
      { text: `${stage}  ·  edad ${Math.round(age)}  ·  ${job || '?'}`, color: '#a0a0c0', size: 13 },
      personality ? { text: `"${personality.slice(0,48)}"`, color: '#8888bb', size: 12 } : null,
      { text: `⚡ ${Math.round(energy)}   🍔 ${Math.round(hunger)}   😊 ${Math.round(happiness)}`, color: '#e0e0ff', size: 14 },
      behavior ? { text: `→ ${behavior.action}: ${(behavior.description||'').slice(0,44)}`, color: '#7a5af8', size: 13 } : null,
      vehicle ? { text: `🚗 ${vehicle}  ·  👥 ${relCount} relaciones`, color: '#606080', size: 12 } : null,
    ].filter(Boolean);

    const pad = 12;
    const bw = 270;
    let bh = pad;
    for (const l of lines) bh += (l.size + 5);
    bh += pad;

    let tx = this.mouseCanvasX + 18, ty = this.mouseCanvasY - bh / 2;
    if (tx + bw > W) tx = this.mouseCanvasX - bw - 18;
    if (ty < 6) ty = 6;
    if (ty + bh > H - 6) ty = H - bh - 6;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(tx + 3, ty + 3, bw, bh);

    // Box
    ctx.fillStyle = 'rgba(8,8,22,0.97)';
    ctx.fillRect(tx, ty, bw, bh);
    ctx.strokeStyle = '#f5c842';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx, ty, bw, bh);

    // Left accent bar
    ctx.fillStyle = '#7a5af8';
    ctx.fillRect(tx, ty, 3, bh);

    // Text
    let curY = ty + pad;
    for (const l of lines) {
      ctx.font = `${l.size}px "VT323", monospace`;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, tx + pad + 2, curY + l.size);
      curY += l.size + 5;
    }
  }

  // ── Selection badge ───────────────────────────────────────────────────────

  _drawSelectionBadge(ctx, W, H) {
    const text = `${this.selectedIds.size} seleccionado${this.selectedIds.size>1?'s':''}  ·  Envía orden al chatbot`;
    ctx.fillStyle='rgba(245,200,66,0.9)';
    ctx.font='bold 12px "VT323",monospace';
    const tw = ctx.measureText(text).width;
    const bx=(W-tw)/2-8, by=H-36, bw=tw+16, bh=22;
    ctx.fillStyle='rgba(10,10,20,0.9)'; ctx.fillRect(bx,by,bw,bh);
    ctx.strokeStyle='#f5c842'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle='#f5c842'; ctx.fillText(text, bx+8, by+15);
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  _drawEffect(ctx, effect, tick) {
    const { x, y, type, ticksLeft, totalTicks } = effect;
    if (!ticksLeft || !totalTicks) return;
    const p = 1 - ticksLeft / totalTicks;
    const alpha = ticksLeft < 15 ? ticksLeft / 15 : 1;
    // Always fall back to generic colors if type not found
    const colors = (EFFECT_COLORS[type] && EFFECT_COLORS[type].length > 0)
      ? EFFECT_COLORS[type]
      : EFFECT_COLORS.generico;
    ctx.save(); ctx.globalAlpha = alpha;
    switch(type) {
      case 'explosion':      this._fxExplosion(ctx,x,y,p,colors); break;
      case 'magia':          this._fxMagic(ctx,x,y,p,tick,colors); break;
      case 'curacion':       this._fxHeal(ctx,x,y,p,tick,colors); break;
      case 'rayo':           this._fxShock(ctx,x,y,p,colors); break;
      case 'lluvia_objetos': this._fxRainObjects(ctx,x,y,p,tick,colors); break;
      case 'onda':           this._fxWave(ctx,x,y,p,colors); break;
      case 'destello':       this._fxFlash(ctx,x,y,p,colors); break;
      case 'fuego':          this._fxFire(ctx,x,y,p,tick,colors); break;
      case 'nieve':          this._fxSnow(ctx,x,y,p,tick,colors); break;
      case 'arcoiris':       this._fxRainbow(ctx,x,y,p,colors); break;
      default:               this._fxGeneric(ctx,x,y,p,tick,colors);
    }
    ctx.restore();
  }

  _fxExplosion(ctx,x,y,p,colors) {
    // Big shockwave + particles
    const r = p * 120;
    // Shockwave ring
    ctx.strokeStyle = colors[0]; ctx.lineWidth = 4 * (1-p);
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI*2); ctx.stroke();
    // Particles
    for(let i=0;i<28;i++){
      const a=(i/28)*Math.PI*2;
      const pr = p * 100 + Math.sin(i)*20;
      ctx.fillStyle=colors[i%colors.length];
      const s=Math.max(2, 8-p*7);
      ctx.fillRect(Math.round(x+Math.cos(a)*pr), Math.round(y+Math.sin(a)*pr), s, s);
    }
    // Core flash
    if(p<0.3){
      ctx.fillStyle='#ffffff';
      const cs=(0.3-p)*80;
      ctx.fillRect(Math.round(x-cs/2),Math.round(y-cs/2),cs,cs);
    }
    ctx.lineWidth=1;
  }
  _fxMagic(ctx,x,y,p,tick,colors) {
    // Large rotating star burst
    for(let i=0;i<16;i++){
      const a=(i/16)*Math.PI*2+tick*0.08;
      const r=20+Math.sin(p*Math.PI)*60;
      ctx.fillStyle=colors[i%colors.length];
      const s = 4;
      ctx.fillRect(Math.round(x+Math.cos(a)*r), Math.round(y+Math.sin(a)*r), s, s);
    }
    // Inner cross
    ctx.fillStyle=colors[0];
    ctx.fillRect(Math.round(x)-2,Math.round(y)-12,4,24);
    ctx.fillRect(Math.round(x)-12,Math.round(y)-2,24,4);
  }
  _fxHeal(ctx,x,y,p,tick,colors) {
    for(let i=0;i<7;i++){const py=y-p*40-(i/7)*22;const px=x+Math.sin(tick*0.1+i*1.2)*12;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(Math.round(px)-1,Math.round(py)-3,2,6);ctx.fillRect(Math.round(px)-3,Math.round(py)-1,6,2);}
  }
  _fxShock(ctx,x,y,p,colors) {
    const r=p*60;for(let i=0;i<40;i++){const a=(i/40)*Math.PI*2;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(Math.round(x+Math.cos(a)*r),Math.round(y+Math.sin(a)*r),2,2);}
  }
  _fxRainObjects(ctx,x,y,p,tick,colors) {
    for(let i=0;i<15;i++){const ox=x+Math.sin(i*2.1)*50;const oy=y-70+p*90+(i%3)*18;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(Math.round(ox),Math.round(oy),5,5);}
  }
  _fxWave(ctx,x,y,p,colors) {
    for (let ring = 0; ring < 3; ring++) {
      const r = (p * 100) + ring * 25;
      const ringAlpha = Math.max(0, 1 - p - ring * 0.2);
      ctx.save();
      ctx.globalAlpha *= ringAlpha;
      for(let i=0;i<64;i++){
        const a=(i/64)*Math.PI*2;
        ctx.fillStyle=colors[i%colors.length];
        ctx.fillRect(Math.round(x+Math.cos(a)*r),Math.round(y+Math.sin(a)*r),4,4);
      }
      ctx.restore();
    }
  }
  _fxFlash(ctx,x,y,p,colors) {
    const s=(1-p)*25;ctx.fillStyle=colors[0];ctx.fillRect(Math.round(x-s/2),Math.round(y-s/2),s,s);
  }
  _fxGeneric(ctx,x,y,p,tick,colors) {
    const s=7+Math.sin(tick*0.4)*5;ctx.fillStyle=colors[0];ctx.fillRect(Math.round(x-s/2),Math.round(y-s/2),s,s);
  }
  _fxFire(ctx,x,y,p,tick,colors) {
    for(let i=0;i<20;i++){
      const ox=x+(Math.random()-0.5)*30;
      const oy=y-p*40+Math.random()*20;
      const s=Math.max(1,4-p*3);
      ctx.fillStyle=colors[Math.floor(Math.random()*colors.length)];
      ctx.fillRect(Math.round(ox),Math.round(oy),s,s*2);
    }
  }
  _fxSnow(ctx,x,y,p,tick,colors) {
    for(let i=0;i<25;i++){
      const ox=x+(Math.sin(i*2.3+tick*0.05))*50;
      const oy=y-60+p*80+(i%5)*15;
      ctx.fillStyle=colors[i%colors.length];
      ctx.fillRect(Math.round(ox),Math.round(oy),2,2);
    }
  }
  _fxRainbow(ctx,x,y,p,colors) {
    for(let i=0;i<colors.length;i++){
      const r=(p*80)+(i*8);
      ctx.strokeStyle=colors[i]; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(x,y+20,r,Math.PI,0); ctx.stroke();
    }
    ctx.lineWidth=1;
  }

  // ── Rain ──────────────────────────────────────────────────────────────────

  _drawRain(ctx, w, h) {
    ctx.globalAlpha=0.35; ctx.strokeStyle='#4a6a8a'; ctx.lineWidth=1;
    for(const p of this.rainParticles){
      p.y+=p.speed; p.x-=p.speed*0.25;
      if(p.y>h){p.y=-p.length;p.x=Math.random()*w;}
      if(p.x<0)p.x=w;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-p.length*0.25,p.y+p.length); ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  toggleRain(show) { this.showRain = show; }
}
