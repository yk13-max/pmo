import { execSync } from 'node:child_process';
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

/* The version, which is the number of commits behind it. Nothing has to be remembered or
   bumped: every commit is a change to the tracker, so counting them is the version, and it
   goes up on its own. Read at build time like the line count. A checkout without history —
   a tarball, a shallow clone — has nothing to count, and says so rather than lying. */
function commitCount(): number {
  try {
    return Number(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim()) || 0;
  } catch {
    return 0;
  }
}

export default defineConfig({
  plugins: [react()],
  define: { __SOURCE_LINES__: countLines('src'), __BUILD_MK__: commitCount() },
  server: { port: 5173 },
});
