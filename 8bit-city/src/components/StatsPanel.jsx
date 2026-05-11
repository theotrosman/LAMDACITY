import { useState } from 'react';
import { CONFIG } from '../constants/config.js';

const STAGE_EMOJI = {
  infancia: '👶',
  juventud: '🧒',
  adultez: '🧑',
  vejez: '👴',
};

const STAGE_COLOR = {
  infancia: '#f5c842',
  juventud: '#50c878',
  adultez: '#7a5af8',
  vejez: '#aaaaaa',
};

const ERA_NAMES = { ancient:'Antigua', medieval:'Medieval', industrial:'Industrial', modern:'Moderna', future:'Futura' };

const ACTION_EMOJI = {
  trabajar: '💼',
  comer: '🍔',
  dormir: '😴',
  socializar: '💬',
  caminar: '🚶',
  explorar: '🔍',
  descansar: '🛋',
};

function Bar({ value, max = 100, color }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mini-bar-bg">
      <div className="mini-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function CitizenCard({ citizen, onClick, selected }) {
  return (
    <div
      className={`citizen-card ${selected ? 'selected' : ''}`}
      onClick={() => onClick(citizen)}
    >
      <div className="cc-header">
        <span className="cc-name">{citizen.name}</span>
        <span className="cc-stage" style={{ color: STAGE_COLOR[citizen.stage] }}>
          {STAGE_EMOJI[citizen.stage]} {citizen.stage}
        </span>
      </div>
      <div className="cc-bars">
        <div className="cc-bar-row">
          <span>⚡</span>
          <Bar value={citizen.energy} color="#50c878" />
          <span className="cc-val">{Math.round(citizen.energy)}</span>
        </div>
        <div className="cc-bar-row">
          <span>🍔</span>
          <Bar value={citizen.hunger} color="#e85050" />
          <span className="cc-val">{Math.round(citizen.hunger)}</span>
        </div>
        <div className="cc-bar-row">
          <span>😊</span>
          <Bar value={citizen.happiness} color="#f5c842" />
          <span className="cc-val">{Math.round(citizen.happiness)}</span>
        </div>
      </div>
      <div className="cc-action">
        {ACTION_EMOJI[citizen.behavior?.action] || '❓'} {citizen.behavior?.action || '—'}
      </div>
    </div>
  );
}

function CitizenDetail({ citizen, onClose }) {
  if (!citizen) return null;
  return (
    <div className="citizen-detail-panel">
      <div className="cdp-header">
        <div>
          <span className="cdp-name">{citizen.name}</span>
          <span className="cdp-id"> #{citizen.id}</span>
        </div>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="cdp-stage" style={{ borderColor: STAGE_COLOR[citizen.stage] }}>
        {STAGE_EMOJI[citizen.stage]} {citizen.stage.toUpperCase()} · {Math.round(citizen.age)} ticks
      </div>

      <div className="cdp-attrs">
        <div className="cdp-attr">
          <span className="cdp-attr-label">⚡ Energía</span>
          <Bar value={citizen.energy} color="#50c878" />
          <span className="cdp-attr-val">{Math.round(citizen.energy)}/100</span>
        </div>
        <div className="cdp-attr">
          <span className="cdp-attr-label">🍔 Hambre</span>
          <Bar value={citizen.hunger} color="#e85050" />
          <span className="cdp-attr-val">{Math.round(citizen.hunger)}/100</span>
        </div>
        <div className="cdp-attr">
          <span className="cdp-attr-label">😊 Felicidad</span>
          <Bar value={citizen.happiness} color="#f5c842" />
          <span className="cdp-attr-val">{Math.round(citizen.happiness)}/100</span>
        </div>
      </div>

      {citizen.behavior && (
        <div className="cdp-behavior">
          <div className="cdp-behavior-title">Acción actual</div>
          <div className="cdp-behavior-action">
            {ACTION_EMOJI[citizen.behavior.action] || '❓'} {citizen.behavior.action}
          </div>
          <div className="cdp-behavior-desc">{citizen.behavior.description}</div>
          <div className="cdp-behavior-ticks">⏱ {citizen.behaviorTicksLeft} ticks restantes</div>
        </div>
      )}

      {citizen.lastBehavior && (
        <div className="cdp-last">
          <span className="cdp-last-label">Anterior: </span>
          {citizen.lastBehavior.action} — {citizen.lastBehavior.description}
        </div>
      )}

      {Object.keys(citizen.relationships || {}).length > 0 && (
        <div className="cdp-relations">
          <div className="cdp-behavior-title">Relaciones</div>
          {Object.entries(citizen.relationships).map(([id, rel]) => (
            <div key={id} className="cdp-rel-item">#{id}: {rel}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatsPanel({ simState, selectedCitizen, onCitizenSelect }) {
  const [tab, setTab] = useState('stats'); // 'stats' | 'citizens' | 'log'

  if (!simState) return null;

  const { stats, citizens, tick } = simState;
  const alive = citizens.filter(c => c.alive);

  const stageCounts = {};
  for (const s of Object.values(CONFIG.STAGE)) stageCounts[s] = 0;
  for (const c of alive) stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;

  const behaviorFreq = {};
  for (const log of (stats.behaviorLog || [])) {
    behaviorFreq[log.action] = (behaviorFreq[log.action] || 0) + 1;
  }
  const topBehaviors = Object.entries(behaviorFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const avgEnergy = alive.length ? Math.round(alive.reduce((s, c) => s + c.energy, 0) / alive.length) : 0;
  const avgHappiness = alive.length ? Math.round(alive.reduce((s, c) => s + c.happiness, 0) / alive.length) : 0;

  return (
    <div className="stats-panel">
      {/* Tab bar */}
      <div className="tab-bar">
        {['stats', 'citizens', 'log'].map(t => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'stats' ? '📊' : t === 'citizens' ? '👥' : '📋'}
            <span>{t === 'stats' ? 'Stats' : t === 'citizens' ? 'Ciudadanos' : 'Log'}</span>
          </button>
        ))}
      </div>

      {/* STATS TAB */}
      {tab === 'stats' && (
        <div className="tab-content">
          <div className="stat-grid-2">
            <div className="sg-item">
              <div className="sg-val">{tick}</div>
              <div className="sg-label">Tick</div>
            </div>
            <div className="sg-item">
              <div className="sg-val accent-yellow">{alive.length}</div>
              <div className="sg-label">Población</div>
            </div>
            <div className="sg-item">
              <div className="sg-val accent-green">{stats.totalBirths}</div>
              <div className="sg-label">Nacimientos</div>
            </div>
            <div className="sg-item">
              <div className="sg-val accent-red">{stats.totalDeaths}</div>
              <div className="sg-label">Muertes</div>
            </div>
            <div className="sg-item">
              <div className="sg-val accent-purple">{stats.groqCalls}</div>
              <div className="sg-label">Calls IA</div>
            </div>
            <div className="sg-item">
              <div className="sg-val accent-red">{stats.groqErrors}</div>
              <div className="sg-label">Errores</div>
            </div>
          </div>

          {/* World variables */}
          {simState.worldVars && (
            <>
              <div className="section-title">
                🌍 LAMDACITY — Era {ERA_NAMES[simState.worldVars.population_era] || simState.worldVars.population_era}
                {simState.worldVars.at_war && <span className="war-badge"> ⚔ EN GUERRA</span>}
              </div>
              <div className="world-vars">
                {Object.entries(simState.worldVars)
                  .filter(([k]) => ['economy','happiness','pollution','culture','technology','crime','nature'].includes(k))
                  .map(([key, val]) => {
                    const labels = { economy:'💰 Economía', happiness:'😊 Felicidad', pollution:'☁ Contaminación', culture:'🎨 Cultura', technology:'⚙ Tecnología', crime:'🔪 Crimen', nature:'🌿 Naturaleza' };
                    const colors = { economy:'#f5c842', happiness:'#50c878', pollution:'#888888', culture:'#c060ff', technology:'#4a8af8', crime:'#e85050', nature:'#50c878' };
                    return (
                      <div key={key} className="world-var-row">
                        <span className="wv-label">{labels[key] || key}</span>
                        <div className="wv-bar-bg">
                          <div className="wv-bar-fill" style={{ width:`${val}%`, background: colors[key]||'#7a5af8' }} />
                        </div>
                        <span className="wv-val">{Math.round(val)}</span>
                      </div>
                    );
                  })}
              </div>
              {/* Era progress */}
              <div className="era-progress-row">
                <span className="wv-label">🏛 Progreso era</span>
                <div className="wv-bar-bg">
                  <div className="wv-bar-fill" style={{ width:`${(simState.worldVars.era_progress||0)%20*5}%`, background:'#f5c842' }} />
                </div>
                <span className="wv-val">{Math.round(simState.worldVars.era_progress||0)}%</span>
              </div>
            </>
          )}

          {/* Active constructions */}
          {simState.constructions?.length > 0 && (
            <>
              <div className="section-title">🏗 En construcción</div>
              <div className="constructions-list">
                {simState.constructions.map((c, i) => (
                  <div key={i} className="construction-item">
                    <span>🏗 {c.message?.replace(' en construcción','')}</span>
                    <span className="construction-ticks">{c.ticksLeft}t</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Promedios */}
          <div className="avg-section">
            <div className="avg-row">
              <span>⚡ Energía media</span>
              <Bar value={avgEnergy} color="#50c878" />
              <span className="avg-val">{avgEnergy}</span>
            </div>
            <div className="avg-row">
              <span>😊 Felicidad media</span>
              <Bar value={avgHappiness} color="#f5c842" />
              <span className="avg-val">{avgHappiness}</span>
            </div>
          </div>

          {/* Distribución por etapa */}
          <div className="section-title">Distribución por etapa</div>
          <div className="stage-bars">
            {Object.entries(stageCounts).map(([stage, count]) => (
              <div key={stage} className="stage-bar-row">
                <span className="stage-bar-label" style={{ color: STAGE_COLOR[stage] }}>
                  {STAGE_EMOJI[stage]} {stage}
                </span>
                <div className="stage-bar-bg">
                  <div className="stage-bar-fill" style={{ width: alive.length ? `${(count/alive.length)*100}%` : '0%', background: STAGE_COLOR[stage] }} />
                </div>
                <span className="stage-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CITIZENS TAB */}
      {tab === 'citizens' && (
        <div className="tab-content citizens-tab">
          {selectedCitizen && (
            <CitizenDetail
              citizen={selectedCitizen}
              onClose={() => onCitizenSelect(null)}
            />
          )}
          <div className="citizens-list">
            {alive
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(c => (
                <CitizenCard
                  key={c.id}
                  citizen={c}
                  onClick={onCitizenSelect}
                  selected={selectedCitizen?.id === c.id}
                />
              ))}
          </div>
        </div>
      )}

      {/* LOG TAB */}
      {tab === 'log' && (
        <div className="tab-content log-tab">
          <div className="log-list">
            {(stats.behaviorLog || []).map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-tick">t{entry.tick}</span>
                <span className="log-name">{entry.citizenName}</span>
                <span className="log-action">{ACTION_EMOJI[entry.action] || '❓'} {entry.action}</span>
                <span className="log-desc">{entry.description}</span>
              </div>
            ))}
            {!(stats.behaviorLog?.length) && (
              <div className="log-empty">Sin actividad aún...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
