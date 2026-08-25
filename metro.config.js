const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `.catalog` (renamed Delphi-OBD PID/DTC catalogs, see src/obd/catalogs) and `.gz`
// (the gzipped vPIC VIN database, see src/obd/vin) must be treated as opaque binary
// assets rather than parsed as source - they're multi-MB and only ever read lazily
// via expo-asset + expo-file-system, never `import`ed as JS/JSON.
config.resolver.assetExts.push('catalog', 'gz');

module.exports = config;
