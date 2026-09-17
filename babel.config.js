// Expo's default Babel setup, made explicit so Jest can transform the app's
// TypeScript with the same preset Metro uses (see `jest.config.js`).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
