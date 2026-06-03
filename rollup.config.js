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
    external: [ 'yargs', 'chalk', 'boxen', 'figlet', 'fs-extra', 'sharp', 'inquirer', 'inquirer-fuzzy-path', 'path', 'fuzzy', 'ora', 'os', '@master4n/temporal-transformer' ],
    plugins: [
        resolve(),
        terser(),
        typescript({
          tsconfig: 'tsconfig.json'
        }),
        json(),
        copy({
          targets: [
            { src: ["package.json", "README.md", "llms.txt", "LICENSE"], dest: "dist" }
          ]
        })
    ]
  }
];
export default config;