import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Build the CLI once before the suite runs. The contract tests exercise the real
 * emitted binary (dist/bin/index.js) as a subprocess — which is exactly what an
 * AI agent or shell user invokes — rather than importing handlers (whose
 * fail()/process.exit would kill the test runner).
 */
export default function setup() {
  if (!existsSync('dist/bin/index.js') || process.env.MFN_TEST_REBUILD) {
    execSync('npm run build', { stdio: 'inherit' });
  }
}
