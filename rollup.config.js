import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Inline replacement for rollup-plugin-copy (unmaintained; pulled deprecated
// glob@7 + inflight transitively). Copies static assets into dist/ and writes a
// publish-ready package.json after the bundle is written.
function copyDistAssets() {
  return {
    name: 'copy-dist-assets',
    closeBundle() {
      mkdirSync('dist', { recursive: true });
      for (const file of ['README.md', 'llms.txt', 'LICENSE', 'SECURITY.md']) {
        copyFileSync(file, `dist/${file}`);
      }
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
      // The package is published from dist/, so paths are relative to dist (no
      // leading "./", which npm strips/warns about). Strip dev-only fields so
      // the published tarball stays lean and clean.
      pkg.main = 'bin/index.js';
      pkg.types = 'bin/index.d.ts';
      pkg.bin = { mfn: 'bin/index.js' };
      delete pkg.scripts;
      delete pkg.devDependencies;
      delete pkg.publishConfig; // pnpm-only; we publish ./dist directly
      writeFileSync('dist/package.json', JSON.stringify(pkg, null, 2));
    },
  };
}

const config = [
  {
    input: 'src/index.ts',
    output: [
        {
            file: 'dist/bin/index.js',
            format: 'esm',
            sourcemap: true,
            banner: '#!/usr/bin/env node'
         }
    ],
    external: [ 'yargs', 'chalk', 'boxen', 'figlet', 'fs-extra', 'sharp', 'inquirer', 'path', 'fuzzy', 'ora', 'os', '@master4n/temporal-transformer' ],
    plugins: [
        resolve(),
        terser(),
        typescript({
          tsconfig: 'tsconfig.json'
        }),
        json(),
        copyDistAssets()
    ]
  }
];
export default config;