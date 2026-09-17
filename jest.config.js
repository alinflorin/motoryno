// Unit tests cover the pure logic under `src/obd` (response parsing, byte
// decoding, the learn matcher) - nothing here touches React Native or BLE,
// so a plain Node environment with Expo's Babel preset is all that's needed.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // babel-preset-expo rewrites `process.env.EXPO_PUBLIC_*` reads into an
  // import of expo's ESM `virtual/env` shim - let Babel transform that one
  // package path instead of the default "never transform node_modules".
  transformIgnorePatterns: ['/node_modules/(?!expo/virtual/)'],
};
