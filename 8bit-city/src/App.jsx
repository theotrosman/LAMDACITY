import { useState, useRef, useCallback, useEffect } from 'react';
import SimCanvas from './components/SimCanvas.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import GodChat from './components/GodChat.jsx';
import Controls from './components/Controls.jsx';
import { SimulationEngine } from './engine/simulationEngine.js';
import './App.css';

export default function App() {
  const [simState, setSimState] = useState(null);
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showRain, setShowRain] = useState(false);
  const engineRef = useRef(null);

  const handleStateUpdate = useCallback((state) => {
    setSimState(state);
    // Sync rain from god orders
    if (state?.city?.showRain !== undefined) setShowRain(state.city.showRain);
    setSelectedCitizen(prev => {
      if (!prev) return null;
      return state.citizens.find(c => c.id === prev.id && c.alive) || null;
    });
  }, []);

  const handleGodResponse = useCallback((interp, order) => {
    // Handled inside GodChat via onSendOrder return value
  }, []);

  useEffect(() => {
    engineRef.current = new SimulationEngine(handleStateUpdate, handleGodResponse);
    return () => engineRef.current?.stop();
  }, [handleStateUpdate, handleGodResponse]);

  const handleStart   = useCallback((k, m, s) => engineRef.current?.init(k, m, s), []);
  const handlePause   = useCallback(() => engineRef.current?.pause(), []);
  const handleResume  = useCallback(() => engineRef.current?.resume(), []);
  const handleRestart = useCallback((k, m, s) => {
    engineRef.current?.restart(k, m, s);
    setSelectedCitizen(null);
    setSelectedIds([]);
  }, []);
  const handleSpeedChange = useCallback((s) => engineRef.current?.setSpeed(s), []);

  const handleGodOrder = useCallback(async (order, selIds) => {
    if (!engineRef.current) throw new Error('Simulación no iniciada');
    return await engineRef.current.sendGodOrder(order, selIds || []);
  }, []);

  const handleCitizenClick = useCallback((citizen) => {
    setSelectedCitizen(citizen);
  }, []);

  const handleSelectionChange = useCallback((ids) => {
    setSelectedIds(ids);
    if (ids.length === 1) {
      const c = simState?.citizens?.find(c => c.id === ids[0]);
      if (c) setSelectedCitizen(c);
    }
  }, [simState?.citizens]);

  return (
    <div className="app">
      <aside className="sidebar sidebar-left">
        <Controls
          simState={simState}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onRestart={handleRestart}
          onSpeedChange={handleSpeedChange}
          onToggleRain={() => setShowRain(r => !r)}
          showRain={showRain}
        />
        <StatsPanel
          simState={simState}
          selectedCitizen={selectedCitizen}
          onCitizenSelect={(c) => {
            setSelectedCitizen(c);
            setSelectedIds(c ? [c.id] : []);
          }}
        />
      </aside>

      <main className="main-view">
        {simState?.city ? (
          <SimCanvas
            simState={simState}
            onCitizenClick={handleCitizenClick}
            onSelectionChange={handleSelectionChange}
            showRain={showRain}
            selectedIds={selectedIds}
          />
        ) : (
          <div className="splash">
            <div className="splash-art">
              <div className="pixel-city-icon">🏙</div>
              <h1>LAMDACITY</h1>
              <p>Simulación de ciudad lofi con ciudadanos impulsados por IA</p>
              <div className="splash-features">
                <span>🔍 Rueda del mouse: zoom</span>
                <span>🖱 Alt+drag: mover mapa</span>
                <span>🎯 Drag: seleccionar ciudadanos</span>
                <span>⚡ Modo Dios: órdenes en lenguaje natural</span>
                <span>📰 Noticias y eventos narrativos en tiempo real</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <aside className="sidebar sidebar-right">
        <GodChat
          simState={simState}
          onSendOrder={handleGodOrder}
          disabled={!simState?.running}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
        />
      </aside>
    </div>
  );
}
