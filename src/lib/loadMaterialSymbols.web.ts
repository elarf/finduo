/**
 * Injects the Material Symbols Outlined font and its CSS class into the
 * document <head> at runtime. This covers the Expo dev-server (expo start --web)
 * where patch-web.js has not run. Safe to call multiple times.
 */
export default function loadMaterialSymbols(): void {
  if (typeof document === 'undefined') return;

  const fontId = 'material-symbols-font';
  if (!document.getElementById(fontId)) {
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    document.head.appendChild(link);
  }

  const styleId = 'material-symbols-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.material-symbols-outlined {',
      '  font-family: "Material Symbols Outlined";',
      '  font-weight: normal;',
      '  font-style: normal;',
      '  line-height: 1;',
      '  letter-spacing: normal;',
      '  text-transform: none;',
      '  display: inline-block;',
      '  white-space: nowrap;',
      '  word-wrap: normal;',
      '  direction: ltr;',
      '  -webkit-font-smoothing: antialiased;',
      "  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;",
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }
}
