import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// The worker imports maplibre-gl-shared.mjs at runtime (relative to its own
// location), so both files need to live next to each other in public/.
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(`${root}/node_modules/maplibre-gl/dist/${file}`, `${root}/public/${file}`);
}
