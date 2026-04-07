/**
 * Custom Metro Babel Transformer
 *
 * Transforms import.meta statements for compatibility with Metro bundler
 */
const upstreamTransformer = require('metro-react-native-babel-transformer');

module.exports.transform = function ({ src, filename, options }) {
  // Transform import.meta.url and import.meta.env to polyfilled versions
  if (typeof src === 'string' && (
    filename.includes('node_modules/three') ||
    filename.includes('node_modules/@react-three') ||
    filename.includes('node_modules/troika')
  )) {
    // Replace import.meta with globalThis.__importMeta
    src = src.replace(/import\.meta/g, '(globalThis.__importMeta || { url: "" })');
  }

  // Call the upstream transformer
  return upstreamTransformer.transform({ src, filename, options });
};
