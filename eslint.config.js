import js from '@eslint/js';
import globals from 'globals';
export default [
  {
    ignores: [
      'dist/**',
      '**/vendor/**',
      'node_modules/**',
      'test-results/**',
      '.site-release/**',
      'artifacts/**',
    ],
  },
  js.configs.recommended,
  {
    files: [
      'src/**/*.js',
      'tests/browser/**/*.js',
      'scripts/visual-check.mjs',
      'scripts/asset-check.mjs',
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
