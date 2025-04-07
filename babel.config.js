module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Expo Router uses React Navigation under the hood
      'react-native-reanimated/plugin',
    ],
  };
}; 