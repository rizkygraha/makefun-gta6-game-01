// NEON TIDE — main.ts
// The entry's program: copies game/ and screenshots/ from this repository
// into the output directory and writes dossier.json with buildDossier from
// vendor/makefun-game.ts. Runs on Node 22, standard library only. Outside
// the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { buildDossier } from './vendor/makefun-game.ts';
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(src: string, dest: string): void {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to);
    } else if (entry.isFile()) {
      copyFileSync(from, to);
    }
  }
}

// Start from a clean output directory: a re-run after re-capturing shots
// must never leave a stale file (for example a removed screenshot) in the
// output the dossier is built from.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const doc = JSON.parse(new TextDecoder().decode(dossier));
console.log(
  'NEON TIDE dossier: ' + Buffer.byteLength(doc.text, 'utf8') + ' text bytes, '
  + doc.images.length + ' screenshots, cover ' + doc.images[doc.cover].name
  + ', dossier ' + dossier.length + ' bytes'
);
