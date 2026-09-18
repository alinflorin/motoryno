module.exports = {
  globDirectory: 'dist/',
  globPatterns: ['**/*.{js,html,ttf,ico,json,png}'],
  swDest: 'dist/sw.js',
  // The main entry bundle is a few MB uncompressed; Workbox's 2MB default would skip precaching
  // it, leaving the app unusable offline.
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
};
