'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'coverage/', 'infra/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { 'no-unused-expressions': 'off' },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
];
