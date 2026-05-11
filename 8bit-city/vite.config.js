import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const CUSTOM_CELLS_FILE = join(ROOT, 'src', 'engine', 'customCells.js');

// Ensure src/engine exists
if (!existsSync(join(ROOT, 'src', 'engine'))) {
  mkdirSync(join(ROOT, 'src', 'engine'), { recursive: true });
}

// ── Vite plugin: /api/commit-cell endpoint ────────────────────────────────────
function customCellsPlugin() {
  return {
    name: 'custom-cells-api',
    configureServer(server) {
      server.middlewares.use('/api/commit-cell', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { cell, code } = JSON.parse(body);

            // 1. Write customCells.js
            writeFileSync(CUSTOM_CELLS_FILE, code, 'utf8');
            console.log(`\n📝 [LAMDACITY] Written: src/engine/customCells.js`);

            // 2. Git: stage + commit (from repo root, one level up from 8bit-city/)
            const repoRoot = join(ROOT, '..');
            const relPath = '8bit-city/src/engine/customCells.js';
            try {
              execSync(`git -C "${repoRoot}" add "${relPath}"`, { stdio: 'pipe' });
              const msg = `feat(8bit): add custom cell — ${cell.label} (${cell.id})`;
              execSync(`git -C "${repoRoot}" commit -m "${msg}"`, { stdio: 'pipe' });
              console.log(`✅ [LAMDACITY] Committed: ${msg}`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, committed: true, message: msg }));
            } catch (gitErr) {
              const errMsg = gitErr.stderr?.toString() || gitErr.message || '';
              // "nothing to commit" is not an error
              if (errMsg.includes('nothing to commit') || errMsg.includes('nothing added')) {
                console.log(`ℹ [LAMDACITY] Nothing new to commit for ${cell.label}`);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: true, committed: false, message: 'already up to date' }));
              } else {
                console.warn(`⚠ [LAMDACITY] Git error: ${errMsg.slice(0, 120)}`);
                res.setHeader('Content-Type', 'application/json');
                // Still OK — file was written, just not committed
                res.end(JSON.stringify({ ok: true, committed: false, message: errMsg.slice(0, 80) }));
              }
            }
          } catch (e) {
            console.error(`❌ [LAMDACITY] commit-cell error:`, e.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), customCellsPlugin()],
});
