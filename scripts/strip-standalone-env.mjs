/**
 * Next.js copies `.env` / `.env.production` into `.next/standalone` on purpose
 * so `server.js` has fallback values. Those files can contain real secrets
 * when the output is deployed directly (the Docker build avoids this through
 * `.dockerignore`). Production runtime variables belong in the process
 * environment, so remove the copies after `next build`.
 *
 * This runs as the `postbuild` lifecycle script.
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const standaloneDir = join(process.cwd(), '.next', 'standalone');

for (const filename of ['.env', '.env.production']) {
  const filePath = join(standaloneDir, filename);
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
    console.log(`Removed ${filename} from the standalone output.`);
  }
}
