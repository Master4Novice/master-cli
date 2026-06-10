import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      // yargs argv/builder are intentionally untyped at the boundary; the
      // CliCommand interface types the registration instead.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Keep every module small and single-purpose: 150 lines of actual code
      // (blank lines and comments don't count). Split the file when you hit it.
      'max-lines': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },
);
