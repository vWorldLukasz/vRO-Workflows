// eslint.config.js  – custom ESLint 9 flat config (no base presets)

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      /* ----------  Style rules  ---------- */
      indent: ['error', 4, { SwitchCase: 1 }], // 4 spaces, no tabs
      'linebreak-style': ['error', 'unix'],  // CRLF line endings
      quotes: ['error', 'double', { avoidEscape: true }], // always double quotes
      semi: ['error', 'always', { omitLastInOneLineBlock: true }], // semicolon at end
      'no-trailing-spaces': 'error',            // no spaces at end of line
      'no-multiple-empty-lines': [
        'error',
        { max: 1, maxBOF: 0, maxEOF: 0 },      // max one consecutive empty line
      ],
      'keyword-spacing': ['error', { before: true, after: true }], // space after keywords (e.g., return)
      'space-unary-ops': [
        'error',
        { words: true, nonwords: false },       // space after unary word operators
      ],

      /* ----------  Best‑practice rules  ---------- */
      eqeqeq: ['error', 'always'],              // require strict equality ===
      'no-use-before-define': 'error',          // variables must be declared before use
      'no-caller': 'error',                     // disallow arguments.caller / callee
      curly: ['error', 'all'],                  // require braces around blocks
    },
  },
];
