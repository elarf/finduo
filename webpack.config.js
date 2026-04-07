const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Customize the config to support Three.js and ES modules

  // Add support for .mjs and .cjs extensions
  config.resolve.extensions.push('.mjs', '.cjs');

  // Configure module rules to properly handle ES modules
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false, // Allow importing without extensions
    },
    include: [
      /node_modules\/three/,
      /node_modules\/@react-three/,
      /node_modules\/troika/,
    ],
  });

  // Add fallback for Node.js built-ins (required for some Three.js dependencies)
  config.resolve.fallback = {
    ...config.resolve.fallback,
    path: false,
    fs: false,
    crypto: false,
    stream: false,
    buffer: false,
  };

  // Enable experimental features for ESM support
  config.experiments = {
    ...config.experiments,
    topLevelAwait: true,
  };

  return config;
};
