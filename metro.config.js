const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.catalog` (renamed Delphi-OBD PID/DTC catalogs, see src/obd/catalogs) must be
// treated as an opaque binary asset rather than parsed as source - it's multi-MB
// and only ever read lazily via expo-asset + expo-file-system, never `import`ed
// as JS/JSON.
config.resolver.assetExts.push('catalog');

module.exports = config;
