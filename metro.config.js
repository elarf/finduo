/**
 * Metro configuration for React Native
 * https://facebook.github.io/metro/docs/configuration
 *
 * Enhanced to support Three.js ES modules
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for Three.js and other ES modules
config.resolver.sourceExts.push('cjs', 'mjs');

// Configure transformer
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
