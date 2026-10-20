const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  { ignores: ['dist/**', 'artifacts/**', 'test-results/**', 'playwright-report/**', '.expo/**'] },
];
