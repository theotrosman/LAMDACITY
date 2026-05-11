/**
 * commit-custom-cells.mjs
 * 
 * Reads pending custom cell commits from a JSON file (written by the browser via
 * a Vite dev server endpoint), writes the code to src/engine/customCells.js,
 * and commits it to git.
 * 
 * Run: node scripts/commit-custom-cells.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PENDING_FILE = join(ROOT, '.pending-custom-cells.json');
const OUTPUT_FILE = join(ROOT, 'src', 'engine', 'customCells.js');

if (!existsSync(PENDING_FILE)) {
  console.log('No pending custom cells to commit.');
  process.exit(0);
}

let pending;
try {
  pending = JSON.parse(readFileSync(PENDING_FILE, 'utf8'));
} catch (e) {
  console.error('Failed to read pending file:', e.message);
  process.exit(1);
}

if (!pending || pending.length === 0) {
  console.log('No pending custom cells.');
  process.exit(0);
}

// Write the latest code (last entry has the most complete set)
const latest = pending[pending.length - 1];
writeFileSync(OUTPUT_FILE, latest.code, 'utf8');

// Git commit
try {
  execSync(`git -C "${ROOT}" add src/engine/customCells.js`, { stdio: 'inherit' });
  const labels = pending.map(p => p.label).join(', ');
  const msg = `feat(8bit): add custom cells — ${labels}`;
  execSync(`git -C "${ROOT}" commit -m "${msg}"`, { stdio: 'inherit' });
  console.log(`✅ Committed: ${msg}`);
  
  // Clear pending file
  writeFileSync(PENDING_FILE, '[]', 'utf8');
} catch (e) {
  console.error('Git commit failed:', e.message);
  process.exit(1);
}
