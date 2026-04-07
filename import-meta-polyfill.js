/**
 * Polyfill for import.meta to support Three.js on Expo Web
 */

// Initialize import.meta polyfill
if (typeof globalThis !== 'undefined') {
  globalThis.__importMeta = {
    url: typeof window !== 'undefined' ? window.location.href : '',
    env: {},
  };
}
