import { useEffect, useRef, useCallback, useState } from 'react';
import { CityRenderer } from '../renderer/cityRenderer.js';
import { CONFIG } from '../constants/config.js';

export default function SimCanvas({ simState, onCitizenClick, onSelectionChange, showRain, selectedIds = [] }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const rendererRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(simState);
  const selectedIdsRef = useRef(selectedIds);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, isPan: false, isSelect: false });

  const [tooltip, setTooltip] = useState(null); // { citizen, x, y } in CSS px

  useEffect(() => { stateRef.current = simState; }, [simState]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    rendererRef.current?.setSelectedIds(selectedIds);
  }, [selectedIds]);

  // Init renderer + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = new CityRenderer(canvas);

    function loop() {
      const state = stateRef.current;
      if (state?.city) rendererRef.current.render({ ...state, selectedIds: selectedIdsRef.current });
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => { rendererRef.current?.toggleRain(showRain); }, [showRain]);

  // Set canvas logical size when city changes
  useEffect(() => {
    if (!simState?.city || !canvasRef.current) return;
    const size = simState.city.size * CONFIG.CELL_SIZE;
    canvasRef.current.width = size;
    canvasRef.current.height = size;
  }, [simState?.city?.size]);

  // Fill wrapper with CSS
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = wrapper.getBoundingClientRect();
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Reset view when city first loads
  useEffect(() => {
    if (simState?.city && rendererRef.current && canvasRef.current) {
      const { width } = canvasRef.current.getBoundingClientRect();
      if (width > 0) rendererRef.current.resetView(simState.city.size);
    }
  }, [simState?.city?.seed]);

  // Convert CSS mouse position → canvas logical coordinates
  const toCanvasCoords = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      cx: (e.clientX - rect.left) * scaleX,
      cy: (e.clientY - rect.top) * scaleY,
      // CSS coords for HTML overlay
      cssX: e.clientX - rect.left,
      cssY: e.clientY - rect.top,
    };
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!rendererRef.current) return;
    const { cx, cy } = toCanvasCoords(e);
    const citySize = stateRef.current?.city?.size;
    rendererRef.current.applyZoom(e.deltaY < 0 ? 1 : -1, cx, cy, citySize);
  }, [toCanvasCoords]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e) => {
    if (!rendererRef.current) return;
    const { cx, cy } = toCanvasCoords(e);
    const world = rendererRef.current.canvasToWorld(cx, cy);

    if (e.button === 1 || e.altKey) {
      dragRef.current = { active: true, lastX: cx, lastY: cy, isPan: true, isSelect: false };
      canvasRef.current.style.cursor = 'grabbing';
    } else if (e.button === 0) {
      const citizen = rendererRef.current.getCitizenAtCanvas(stateRef.current?.citizens || [], cx, cy, 14);
      if (citizen) {
        const newIds = e.shiftKey
          ? (selectedIdsRef.current.includes(citizen.id)
            ? selectedIdsRef.current.filter(id => id !== citizen.id)
            : [...selectedIdsRef.current, citizen.id])
          : [citizen.id];
        onSelectionChange?.(newIds);
        onCitizenClick?.(citizen);
      } else {
        dragRef.current = { active: true, worldX: world.x, worldY: world.y, isPan: false, isSelect: true };
        if (!e.shiftKey) onSelectionChange?.([]);
      }
    }
  }, [toCanvasCoords, onCitizenClick, onSelectionChange]);

  const handleMouseMove = useCallback((e) => {
    if (!rendererRef.current || !stateRef.current?.citizens) return;
    const { cx, cy, cssX, cssY } = toCanvasCoords(e);

    if (dragRef.current.active) {
      if (dragRef.current.isPan) {
        const dx = cx - dragRef.current.lastX;
        const dy = cy - dragRef.current.lastY;
        rendererRef.current.pan(dx, dy);
        dragRef.current.lastX = cx;
        dragRef.current.lastY = cy;
      } else if (dragRef.current.isSelect) {
        const world = rendererRef.current.canvasToWorld(cx, cy);
        rendererRef.current.setSelectionBox({
          x1: dragRef.current.worldX, y1: dragRef.current.worldY,
          x2: world.x, y2: world.y,
        });
      }
      setTooltip(null);
    } else {
      const citizen = rendererRef.current.getCitizenAtCanvas(stateRef.current.citizens, cx, cy, 14);
      rendererRef.current.setHover(citizen || null, cx, cy);
      canvasRef.current.style.cursor = citizen ? 'pointer' : 'crosshair';
      if (citizen) {
        setTooltip({ citizen, x: cssX, y: cssY });
      } else {
        setTooltip(null);
      }
    }
  }, [toCanvasCoords]);

  const handleMouseUp = useCallback((e) => {
    if (!rendererRef.current) return;
    const { cx, cy } = toCanvasCoords(e);

    if (dragRef.current.isSelect && dragRef.current.active) {
      const box = rendererRef.current.selectionBox;
      if (box) {
        const boxW = Math.abs(box.x2 - box.x1), boxH = Math.abs(box.y2 - box.y1);
        if (boxW > 5 || boxH > 5) {
          const inBox = rendererRef.current.getCitizensInBox(stateRef.current?.citizens || [], box);
          const newIds = e.shiftKey
            ? [...new Set([...selectedIdsRef.current, ...inBox.map(c => c.id)])]
            : inBox.map(c => c.id);
          onSelectionChange?.(newIds);
        }
        rendererRef.current.setSelectionBox(null);
      }
    }
    dragRef.current = { active: false, isPan: false, isSelect: false };
    canvasRef.current.style.cursor = 'crosshair';
  }, [toCanvasCoords, onSelectionChange]);

  const handleMouseLeave = useCallback(() => {
    rendererRef.current?.setHover(null, 0, 0);
    if (dragRef.current.isSelect) rendererRef.current?.setSelectionBox(null);
    dragRef.current = { active: false, isPan: false, isSelect: false };
    setTooltip(null);
  }, []);

  const handleDblClick = useCallback(() => {
    if (rendererRef.current && simState?.city) rendererRef.current.resetView(simState.city.size);
  }, [simState?.city]);

  const citySize = simState?.city ? simState.city.size * CONFIG.CELL_SIZE : 880;

  return (
    <div className="canvas-wrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        width={citySize}
        height={citySize}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDblClick}
        style={{ imageRendering: 'pixelated', cursor: 'crosshair', display: 'block' }}
      />

      {/* HTML tooltip — always readable regardless of zoom */}
      {tooltip && <CitizenTooltip citizen={tooltip.citizen} x={tooltip.x} y={tooltip.y} />}

      {simState?.city && (
        <div className="canvas-hints">
          <span>🖱 Rueda: zoom</span>
          <span>Alt+drag: mover</span>
          <span>Drag: seleccionar</span>
          <span>Doble click: reset</span>
        </div>
      )}
    </div>
  );
}

const STAGE_COLORS = { infancia:'#f5c842', juventud:'#50c878', adultez:'#7a5af8', vejez:'#aaaaaa' };
const ACTION_LABELS = { trabajar:'💼 trabajar', comer:'🍔 comer', dormir:'😴 dormir', socializar:'💬 socializar',
  caminar:'🚶 caminar', explorar:'🔍 explorar', descansar:'🛋 descansar', jugar:'🎮 jugar', leer:'📖 leer', comprar:'🛒 comprar' };

function CitizenTooltip({ citizen, x, y }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x + 16, top: y - 10 });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const parent = el.parentElement;
    if (!parent) return;

    const pw = parent.clientWidth;
    const ph = parent.clientHeight;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;

    let left = x + 16;
    let top  = y - 10;

    // Flip horizontally if overflows right
    if (left + tw > pw - 8) left = x - tw - 16;
    // Clamp left
    if (left < 8) left = 8;

    // Flip vertically if overflows bottom
    if (top + th > ph - 8) top = y - th - 10;
    // Clamp top
    if (top < 8) top = 8;

    setPos({ left, top });
  }, [x, y, citizen]);

  const { name, stage, energy, hunger, happiness, behavior, personality, age, job, vehicle, relationships } = citizen;
  const relCount = Object.keys(relationships || {}).length;

  return (
    <div ref={ref} className="citizen-tooltip" style={{ position: 'absolute', left: pos.left, top: pos.top, pointerEvents: 'none', zIndex: 1000 }}>
      <div className="ct-name">{name} <span className="ct-id">#{citizen.id}</span></div>
      <div className="ct-stage" style={{ color: STAGE_COLORS[stage] }}>
        {stage} · {Math.round(age)} ticks
      </div>
      {job && <div className="ct-job">💼 {job} · 🚗 {vehicle || '?'}</div>}
      {personality && <div className="ct-personality">"{personality.slice(0, 55)}"</div>}
      <div className="ct-stats">
        <span className="ct-stat energy">⚡ {Math.round(energy)}</span>
        <span className="ct-stat hunger">🍔 {Math.round(hunger)}</span>
        <span className="ct-stat happy">😊 {Math.round(happiness)}</span>
      </div>
      {behavior && (
        <div className="ct-action">
          {ACTION_LABELS[behavior.action] || behavior.action}
          {behavior.description && <span className="ct-action-desc"> — {behavior.description.slice(0, 50)}</span>}
        </div>
      )}
      {relCount > 0 && <div className="ct-relations">👥 {relCount} relación{relCount !== 1 ? 'es' : ''}</div>}
    </div>
  );
}

// ── end of file ──