import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* How much source there is. The credit on the about page says it, and a number typed into
   the page would be wrong by the end of the week — so it is counted here, at the moment the
   app is built, from the files it is built from. Counted the way `wc -l` counts, so it can
   be checked against it. */
function countLines(dir: string): number {
  return readdirSync(dir).reduce((n, entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return n + countLines(path);
    if (!/\.(ts|tsx|css)$/.test(entry)) return n;
    const text = readFileSync(path, 'utf8');
    if (!text) return n;
    return n + text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  }, 0);
}

export default defineConfig({
  plugins: [react()],
  define: { __SOURCE_LINES__: countLines('src') },
  server: { port: 5173 },
});
