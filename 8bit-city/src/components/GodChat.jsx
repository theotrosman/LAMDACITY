import { useState, useRef, useEffect } from 'react';

const TYPE_NEWS_COLOR = { birth:'#50c878', death:'#e85050', god:'#f5c842', social:'#7a5af8',
  happiness:'#f5c842', crisis:'#ff4040', population:'#4a8af8', custom:'#c8c8e8' };

export default function GodChat({ simState, onSendOrder, disabled, selectedIds = [], onClearSelection }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { type: 'system', text: '✦ Modo Dios activado. Escribe una orden para influir en la ciudad.\nSelecciona ciudadanos en el mapa para dirigirles órdenes específicas.' }
  ]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('chat'); // 'chat' | 'news'
  const messagesEndRef = useRef(null);
  const mightBeNewRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedCitizens = simState?.citizens?.filter(c => selectedIds.includes(c.id) && c.alive) || [];

  const handleSend = async () => {
    if (!input.trim() || loading || disabled) return;
    const order = input.trim();
    setInput('');

    // Build display text with selection context
    const selectionNote = selectedCitizens.length > 0
      ? ` [→ ${selectedCitizens.map(c => c.name).join(', ')}]`
      : '';

    setMessages(prev => [...prev, { type: 'user', text: order + selectionNote }]);
    setLoading(true);
    // Show "generating feature" message if it looks like a new feature request
    const mightBeNew = /(?:crea?|construye?|añade?|agrega?|genera?|quiero|necesito|haz(?:me)?)\s+(?:una?\s+)?\w/.test(input.trim().toLowerCase());
    let loadingMsg = '✦ Interpretando orden divina';
    if (mightBeNew) loadingMsg = '⚙ Generando nueva feature... esto puede tardar unos segundos';
    mightBeNewRef.current = mightBeNew;

    // Validate @mentions
    const mentions = [...order.matchAll(/@(\w+)/g)].map(m => m[1]);
    const notFound = [];
    if (simState?.citizens && mentions.length > 0) {
      for (const name of mentions) {
        const lower = name.toLowerCase();
        const found = simState.citizens.find(c => c.alive && (
          c.name.toLowerCase() === lower ||
          c.name.toLowerCase().startsWith(lower) ||
          lower.startsWith(c.name.toLowerCase().slice(0, 3))
        ));
        if (!found) {
          const similar = simState.citizens.filter(c => c.alive).map(c => c.name)
            .filter(n => n.toLowerCase().startsWith(lower.slice(0, 3))).slice(0, 4);
          notFound.push({ name, similar });
        }
      }
    }

    if (notFound.length > 0) {
      for (const { name, similar } of notFound) {
        setMessages(prev => [...prev, {
          type: 'error',
          text: `⚠ @${name} no encontrado. ${similar.length > 0 ? `¿Quisiste decir: ${similar.join(', ')}?` : 'No existe ese ciudadano.'}`
        }]);
      }
      setLoading(false);
      return;
    }

    try {
      const result = await onSendOrder(order, selectedIds);
      if (result) {
        const affectedNames = result.ciudadanos_afectados
          .map(id => simState?.citizens?.find(c => c.id === id)?.name)
          .filter(Boolean);

        const isNewFeature = result._isNewFeature;
        setMessages(prev => [...prev, {
          type: 'response',
          text: `✦ ${result.mensaje_confirmacion}`,
          detail: result.descripcion_visual,
          affected: affectedNames,
          effect: result.tipo_de_efecto,
          isNewFeature,
          featureLabel: result._featureLabel,
          featureCommitted: result._featureCommitted,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        type: 'error',
        text: `⚠ Error: ${err.message?.slice(0, 120) || 'Sin respuesta de Groq'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Dynamic suggestions using real citizen names
  const alive = simState?.citizens?.filter(c => c.alive) || [];
  const names = alive.map(c => c.name);
  const n0 = names[0] || 'alguien', n1 = names[1] || names[0] || 'alguien';
  const suggestions = selectedCitizens.length > 0 ? [
    `dale mucha energía`,
    `hazlos bailar toda la noche`,
    `conviértelos en superhéroes`,
    `dales una crisis existencial`,
    `que se hagan mejores amigos`,
  ] : [
    `aspecto medieval`,
    `ciudad rosa sakura`,
    `matan todos`,
    `genera 50 aldeanos`,
    `elimina todos los estadios`,
    `todos sean felices`,
    `ciudad futurista`,
    `todo sea ruinas`,
    `cielo morado`,
    `crea un volcán`,
  ];

  const news = simState?.news || [];

  return (
    <div className="god-chat">
      <div className="god-chat-tabs">
        <button className={`god-tab ${tab==='chat'?'active':''}`} onClick={() => setTab('chat')}>
          ⚡ Modo Dios
        </button>
        <button className={`god-tab ${tab==='news'?'active':''}`} onClick={() => setTab('news')}>
          📰 Noticias {news.length > 0 && <span className="news-badge">{Math.min(news.length,9)}</span>}
        </button>
      </div>

      {tab === 'chat' && (
        <>
          {/* Selection context bar */}
          {selectedCitizens.length > 0 && (
            <div className="selection-context">
              <span className="sel-label">🎯 Objetivo:</span>
              <span className="sel-names">{selectedCitizens.map(c => c.name).join(', ')}</span>
              <button className="sel-clear" onClick={onClearSelection}>✕</button>
            </div>
          )}

          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.type}`}>
                <div className="msg-text">{msg.text}</div>
                {msg.isNewFeature && (
                  <div className="msg-new-feature">
                    ⚙ Nueva feature generada: <strong>{msg.featureLabel}</strong>
                    {msg.featureCommitted
                      ? ' — ✅ commiteado al repo'
                      : ' — código escrito y guardado'}
                  </div>
                )}
                {msg.detail && <div className="msg-detail">🎬 {msg.detail}</div>}
                {msg.affected?.length > 0 && (
                  <div className="msg-affected">👥 {msg.affected.join(', ')}</div>
                )}
                {msg.effect && <div className="msg-effect">✨ efecto: {msg.effect}</div>}
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg-loading">
                <span className="loading-dots">{mightBeNewRef.current ? '⚙ Generando nueva feature...' : '✦ Interpretando orden divina'}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!disabled && (
            <div className="chat-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="suggestion-btn" onClick={() => setInput(s)}>{s}</button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <input
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                disabled ? 'Inicia la simulación primero...' :
                selectedCitizens.length > 0 ? `Orden para ${selectedCitizens[0].name}...` :
                'Ej: "ciudad rosa", "matan todos", "genera 100 aldeanos"...'
              }
              disabled={disabled || loading}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={disabled || loading || !input.trim()}>
              ⚡
            </button>
          </div>
        </>
      )}

      {tab === 'news' && (
        <div className="news-feed">
          <div className="news-header">📰 DIARIO DE LA CIUDAD</div>
          {news.length === 0 && (
            <div className="news-empty">Sin noticias aún. La ciudad está despertando...</div>
          )}
          {news.map(item => (
            <div key={item.id} className="news-item" style={{ borderLeftColor: TYPE_NEWS_COLOR[item.type] || '#666' }}>
              <div className="news-time">{item.timestamp}</div>
              <div className="news-text">{item.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
