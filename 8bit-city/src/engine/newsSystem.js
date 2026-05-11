export class NewsSystem {
  constructor() {
    this.headlines = [];
    this.maxHeadlines = 40;
  }

  addBirth(child, p1, p2) {
    const templates = [
      `👶 ${child.name} nace en LAMDACITY, hijo de ${p1} y ${p2}`,
      `🍼 Nueva vida: ${child.name} llega al mundo gracias a ${p1} y ${p2}`,
      `🌟 La familia crece: ${p1} y ${p2} dan la bienvenida a ${child.name}`,
    ];
    this._add(templates[Math.floor(Math.random() * templates.length)], 'birth');
  }

  addDeath(citizen) {
    const templates = [
      `💀 ${citizen.name} (${citizen.stage}) fallece a los ${Math.round(citizen.age)} ticks`,
      `🕯 In memoriam: ${citizen.name}, ${citizen.job || 'ciudadano'} de LAMDACITY`,
      `⚰ La ciudad despide a ${citizen.name} tras ${Math.round(citizen.age)} ticks de vida`,
    ];
    this._add(templates[Math.floor(Math.random() * templates.length)], 'death');
  }

  addGodOrder(order, confirmation) {
    this._add(`⚡ INTERVENCIÓN DIVINA: ${confirmation}`, 'god');
  }

  addSocialEvent(n1, n2) {
    const templates = [
      `💬 ${n1} y ${n2} forjan una amistad en la plaza`,
      `🤝 ${n1} ayuda a ${n2} en tiempos difíciles`,
      `☕ ${n1} y ${n2} comparten un café y secretos`,
    ];
    this._add(templates[Math.floor(Math.random() * templates.length)], 'social');
  }

  addHappiness(citizen) {
    this._add(`😊 ${citizen.name} alcanza la felicidad plena — un ejemplo para la ciudad`, 'happiness');
  }

  addCrisis(citizen) {
    this._add(`🚨 ALERTA: ${citizen.name} (${citizen.job||'?'}) está en estado crítico`, 'crisis');
  }

  addPopulation(count) {
    const milestones = {
      10: '🏘 La ciudad supera los 10 habitantes — una comunidad nace',
      20: '🏙 20 ciudadanos: LAMDACITY crece rápidamente',
      30: '🌆 30 almas habitan LAMDACITY — la ciudad prospera',
      40: '🌇 40 ciudadanos: se necesitan más infraestructuras',
      50: '🏛 50 habitantes: LAMDACITY se convierte en ciudad',
    };
    this._add(milestones[count] || `📊 CENSO: La ciudad alcanza ${count} habitantes`, 'population');
  }

  addCustom(text, type = 'custom') {
    this._add(text, type);
  }

  _add(text, type) {
    this.headlines.unshift({
      id: Date.now() + Math.random(),
      text,
      type,
      timestamp: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
    if (this.headlines.length > this.maxHeadlines) this.headlines = this.headlines.slice(0, this.maxHeadlines);
  }

  getHeadlines() { return [...this.headlines]; }
}
