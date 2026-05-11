import { useState, useEffect } from 'react';
import { CONFIG } from '../constants/config.js';

const MODELS = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen/qwen3-32b',
];

export default function Controls({
  simState,
  onStart,
  onPause,
  onResume,
  onRestart,
  onSpeedChange,
  onToggleRain,
  showRain,
}) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY || '';
  const [model, setModel] = useState(CONFIG.GROQ_MODEL_DEFAULT);
  const [seed, setSeed] = useState('');

  const isRunning = simState?.running;
  const isPaused = simState?.paused;

  // Auto-start if API key is available from env
  useEffect(() => {
    if (apiKey && !isRunning) {
      // Small delay to let the engine initialize
      const t = setTimeout(() => {
        onStart(apiKey, model, undefined);
      }, 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestart = () => {
    onRestart(apiKey, model, seed ? parseInt(seed) : undefined);
  };

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <span className="city-title">🏙 CIUDAD 8-BIT</span>
        {isRunning && (
          <span className={`sim-status ${isPaused ? 'paused' : 'running'}`}>
            {isPaused ? '⏸ PAUSADO' : '● LIVE'}
          </span>
        )}
      </div>

      {!isRunning && !apiKey && (
        <div className="no-key-warning">
          ⚠ Falta VITE_GROQ_API_KEY en el .env
        </div>
      )}

      {isRunning && (
        <div className="sim-controls">
          <div className="btn-row">
            {isPaused ? (
              <button className="btn btn-primary" onClick={onResume}>▶ Reanudar</button>
            ) : (
              <button className="btn btn-secondary" onClick={onPause}>⏸ Pausar</button>
            )}
            <button className="btn btn-danger" onClick={handleRestart}>↺ Reiniciar</button>
          </div>

          <div className="speed-control">
            <div className="speed-label">
              <span className="input-label">Velocidad</span>
              <span className="speed-value">{simState.speed}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={CONFIG.MAX_SPEED}
              value={simState.speed}
              onChange={e => onSpeedChange(parseInt(e.target.value))}
              className="speed-slider"
            />
          </div>

          <div className="model-row">
            <label className="input-label">Modelo IA</label>
            <select
              className="select-input"
              value={model}
              onChange={e => {
                setModel(e.target.value);
                // Will take effect on next restart
              }}
            >
              {MODELS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="seed-row">
            <label className="input-label">Semilla ciudad</label>
            <div className="seed-input-row">
              <input
                type="number"
                className="text-input text-input-sm"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder={simState?.city?.seed ?? 'aleatoria'}
              />
              <button className="btn btn-secondary btn-sm" onClick={handleRestart}>
                ↺
              </button>
            </div>
          </div>

          <div className="toggle-row">
            <button
              className={`btn btn-toggle ${showRain ? 'active' : ''}`}
              onClick={onToggleRain}
            >
              🌧 Lluvia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
