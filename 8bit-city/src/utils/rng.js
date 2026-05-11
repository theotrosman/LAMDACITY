// Seeded pseudo-random number generator (mulberry32)
export function createRNG(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomChoice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function randomName(rng) {
  const first = [
    'Carlos', 'María', 'Juan', 'Ana', 'Pedro', 'Laura', 'Luis', 'Sofia',
    'Miguel', 'Elena', 'Diego', 'Carmen', 'Andrés', 'Isabel', 'Roberto',
    'Valentina', 'Sergio', 'Natalia', 'Fernando', 'Claudia', 'Tomás',
    'Lucía', 'Marcos', 'Paula', 'Nicolás', 'Camila', 'Javier', 'Daniela',
    'Alejandro', 'Gabriela', 'Emilio', 'Rosa', 'Héctor', 'Pilar', 'Raúl',
  ];
  return randomChoice(rng, first);
}
