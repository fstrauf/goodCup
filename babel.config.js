module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Support for import aliases
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
            '~': '.',
          },
        },
      ],
      // Support for environment variables
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: true,
          allowUndefined: true,
        },
      ],
    ],
  };
}; 