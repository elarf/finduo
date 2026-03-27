/**
 * scripts/patch-web.js
 *
 * Post-build script that injects PWA-required tags into dist/index.html:
 *  - Web app manifest link
 *  - Apple mobile web-app meta tags (for iOS "Add to Home Screen")
 *  - Apple touch icon
 *  - Service worker registration
 *  - Dark background color to prevent flash of white
 */

const fs = require('fs');
const path = require('path');

const distHtml = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(distHtml)) {
  console.error('dist/index.html not found. Run `npm run build:web` first.');
  process.exit(1);
}

let html = fs.readFileSync(distHtml, 'utf8');

// --- HEAD TAGS ---
const headTags = [
  '<link rel="manifest" href="/manifest.json">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Finduo">',
  '<link rel="apple-touch-icon" href="/icon.png">',
  // Ensure background color is dark to avoid flash of white
  '<style>html,body{background-color:#060a14;}</style>',
].join('\n  ');

html = html.replace('</head>', `  ${headTags}\n</head>`);

// --- SERVICE WORKER REGISTRATION ---
const swScript = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function (err) {
          console.warn('SW registration failed:', err);
        });
      });
    }
  </script>`;

html = html.replace('</body>', `${swScript}\n</body>`);

fs.writeFileSync(distHtml, html);
console.log('PWA: patched dist/index.html with manifest link, Apple meta tags, and service worker.');
