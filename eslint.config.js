// eslint.config.js  – flat config for ESLint 9+
import js from '@eslint/js';

/** @type { import('eslint').Linter.FlatConfig[] } */
export default [

  js.configs.recommended,


  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // 'no-console': 'warn',
    },
  },
];
