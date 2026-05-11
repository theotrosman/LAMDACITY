(async function runGodOrders2(){
  const sim = window.simEngine;
  if (!sim) return console.error('No simEngine found on window. Run app in dev and ensure window.simEngine is set.');

  const orders = [
    { text: 'dales una crisis existencial [→ Alejandro]', delay: 1500 },
    { text: 'volve a carlos presidente y que todos lo alaben', delay: 1500 },
    { text: 'hace que la ia genere efectos en 8bit segun las solicitudes importando de otras webs, mejora la web un 500%', delay: 1500 },
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
