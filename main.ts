// main.ts — NEON TIDE's entry program. It hands the game in: it copies
// game/ and screenshots/ from this repository into the output directory
// and writes /output/dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output. Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) throw new Error(`main.ts: ${name}/ is missing from the repository`);
  if (existsSync(to)) rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');
const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
// Report what the dossier holds, so the run is self-confirming instead
// of needing a separate inspection: the text must fit the cap, all four
// screenshots must be in, and the cover must be the chase shot.
// buildDossier returns the dossier as bytes, not a string, so decode it
// before parsing; writeFileSync takes either form.
const dossierText = typeof dossier === 'string' ? dossier : new TextDecoder().decode(dossier);
const parsed = JSON.parse(dossierText);
console.log(`NEON TIDE: wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
console.log(`  text ${parsed.text.length} bytes (cap ${caps.text_max_bytes}), ${parsed.images.length} screenshots, cover #${parsed.cover} (${parsed.images[parsed.cover]?.name})`);
