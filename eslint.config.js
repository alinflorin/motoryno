// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  // Formatting is Prettier's job (`npm run format`); this switches off the
  // ESLint rules that would otherwise argue with it.
  prettierConfig,
  {
    ignores: ['dist/*', 'obd-ble-sim/dist/*'],
  },
]);
