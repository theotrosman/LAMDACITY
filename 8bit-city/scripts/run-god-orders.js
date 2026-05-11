(async function runGodOrders(){
  const sim = window.simEngine;
  if (!sim) return console.error('No simEngine found on window. Run app in dev and ensure window.simEngine is set.');

  const orders = [
    { text: 'multipliquense [→ Claudia, Alejandro, Ana, Sofia, Rosa, Héctor, Diego, Fernando]', delay: 2000 },
    { text: '✦ El gran meteorito ha destruido la civilización antigua, y nada queda excepto ruinas.\n🎬 Un gigantesco meteorito cae del cielo, destruyendo todo en su camino.\n✨ efecto: explosion', delay: 2500 },
    { text: 'Bruh', delay: 1000 },
    { text: 'genera 50 aldeanos', delay: 2000 },
    { text: '✦ ✦ La ciudad se convierte en un pueblo rural\n🎬 Granjas y campos reemplazan los edificios\n✨ efecto: magia', delay: 1500 },
  ];

  for (const o of orders) {
    console.log('Sending order:', o.text);
    try {
      const res = await sim.sendGodOrder(o.text, []);
      console.log('Result:', res?.mensaje_confirmacion || res);
    } catch (e) {
      console.error('Order failed:', e.message || e);
    }
    await new Promise(r => setTimeout(r, o.delay || 1000));
  }
  console.log('All orders sent.');
})();
