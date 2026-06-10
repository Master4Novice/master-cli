import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';

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
        copy({
          targets: [
            { src: ["README.md", "llms.txt", "LICENSE", "SECURITY.md"], dest: "dist" },
            {
              src: "package.json",
              dest: "dist",
              transform: (contents) => {
                const pkg = JSON.parse(contents.toString());
                // The package is published from dist/, so paths are relative to
                // dist (no leading "./", which npm strips/warns about). Strip
                // dev-only fields so the published tarball stays lean and clean.
                pkg.main = "bin/index.js";
                pkg.types = "bin/index.d.ts";
                pkg.bin = { mfn: "bin/index.js" };
                delete pkg.scripts;
                delete pkg.devDependencies;
                delete pkg.publishConfig; // pnpm-only; we publish ./dist directly
                return JSON.stringify(pkg, null, 2);
              }
            }
          ]
        })
    ]
  }
];
export default config;