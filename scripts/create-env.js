/**
 * scripts/create-env.js
 *
 * Pre-build script for Vercel: writes all EXPO_PUBLIC_* system environment
 * variables to .env.production so @expo/env loads them before Metro starts.
 *
 * Why: The Babel plugin that inlines EXPO_PUBLIC_* vars accesses process.env
 * inside Metro worker threads. @expo/env loads .env files into process.env
 * before bundling begins. Writing the vars to a file guarantees they are
 * available to every Metro worker regardless of spawn timing.
 */

const fs = require('fs');
const path = require('path');

const lines = Object.entries(process.env)
  .filter(([key]) => key.startsWith('EXPO_PUBLIC_'))
  .map(([key, value]) => `${key}=${value}`);

if (lines.length === 0) {
  console.warn('create-env: No EXPO_PUBLIC_* variables found in the environment.');
  process.exit(0);
}

const dest = path.join(__dirname, '..', '.env.production');
fs.writeFileSync(dest, lines.join('\n') + '\n');
console.log(`create-env: Wrote ${lines.length} variable(s) to .env.production`);
lines.forEach((line) => console.log(' ', line.replace(/=.*/, '=***')));
