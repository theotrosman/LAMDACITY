import { CONFIG } from '../constants/config.js';
import { createRNG, randomInt } from '../utils/rng.js';

const { CELL } = CONFIG;

// Generate city grid using seeded RNG
export function generateCity(seed, size = CONFIG.GRID_DEFAULT) {
  const rng = createRNG(seed);
  const grid = [];

  // Initialize all as streets
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = { type: CELL.STREET, id: `${x},${y}`, x, y };
    }
  }

  // Place buildings in a grid pattern, leaving street corridors
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      // Every 4 cells create a block
      if (x % 4 !== 0 && y % 4 !== 0) {
        const r = rng();
        if (r < 0.55) {
          grid[y][x] = { type: CELL.RESIDENTIAL, id: `${x},${y}`, x, y, windows: generateWindows(rng) };
        } else if (r < 0.75) {
          grid[y][x] = { type: CELL.WORK, id: `${x},${y}`, x, y };
        } else if (r < 0.85) {
          grid[y][x] = { type: CELL.PARK, id: `${x},${y}`, x, y };
        }
        // else stays street
      }
    }
  }

  // Ensure minimum buildings per 25 cells
  const totalCells = size * size;
  const minPerType = Math.max(1, Math.floor(totalCells / 25));
  ensureMinimum(grid, size, rng, CELL.RESIDENTIAL, minPerType);
  ensureMinimum(grid, size, rng, CELL.WORK, minPerType);
  ensureMinimum(grid, size, rng, CELL.PARK, minPerType);

  // Build adjacency map for pathfinding
  const adjacency = buildAdjacency(grid, size);

  return { grid, size, adjacency, seed };
}

function generateWindows(rng) {
  const count = Math.floor(rng() * 6) + 2;
  const windows = [];
  for (let i = 0; i < count; i++) {
    windows.push({
      x: Math.floor(rng() * 3),
      y: Math.floor(rng() * 4),
      lit: rng() > 0.3,
    });
  }
  return windows;
}

function ensureMinimum(grid, size, rng, type, min) {
  let count = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (grid[y][x].type === type) count++;

  while (count < min) {
    const x = randomInt(rng, 1, size - 2);
    const y = randomInt(rng, 1, size - 2);
    if (grid[y][x].type === CELL.STREET) {
      grid[y][x] = {
        type,
        id: `${x},${y}`,
        x,
        y,
        windows: type === CELL.RESIDENTIAL ? generateWindows(rng) : undefined,
      };
      count++;
    }
  }
}

function buildAdjacency(grid, size) {
  const adj = {};
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const key = `${x},${y}`;
      adj[key] = [];
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          adj[key].push(`${nx},${ny}`);
        }
      }
    }
  }
  return adj;
}

// BFS pathfinding - returns array of cell keys or null
export function findPath(city, fromKey, toKey) {
  if (fromKey === toKey) return [fromKey];
  const { adjacency, grid, size } = city;

  const visited = new Set([fromKey]);
  const queue = [[fromKey, [fromKey]]];

  while (queue.length > 0) {
    const [current, path] = queue.shift();
    const [cx, cy] = current.split(',').map(Number);

    for (const neighbor of (adjacency[current] || [])) {
      if (visited.has(neighbor)) continue;
      const [nx, ny] = neighbor.split(',').map(Number);
      const cell = grid[ny]?.[nx];
      if (!cell) continue;

      // Can walk on streets and enter destination
      if (cell.type === CELL.STREET || neighbor === toKey) {
        const newPath = [...path, neighbor];
        if (neighbor === toKey) return newPath;
        visited.add(neighbor);
        queue.push([neighbor, newPath]);
      }
    }
  }
  return null;
}

// Find nearest cell of a given type from a position
export function findNearest(city, fromKey, cellType) {
  const { adjacency, grid } = city;
  const visited = new Set([fromKey]);
  const queue = [fromKey];

  while (queue.length > 0) {
    const current = queue.shift();
    const [cx, cy] = current.split(',').map(Number);
    const cell = grid[cy]?.[cx];
    if (cell && cell.type === cellType) return current;

    for (const neighbor of (adjacency[current] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return null;
}

// Get all cells of a type
export function getCellsOfType(city, cellType) {
  const cells = [];
  for (let y = 0; y < city.size; y++)
    for (let x = 0; x < city.size; x++)
      if (city.grid[y][x].type === cellType)
        cells.push(city.grid[y][x]);
  return cells;
}
