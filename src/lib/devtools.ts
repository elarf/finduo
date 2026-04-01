/**
 * DevTools tracing utilities — single source of truth for all UI/API identifiers.
 *
 * ─── Naming convention ───────────────────────────────────────────────────────
 *
 *   <screen>.<component>.<element>[#<id>]
 *
 *   screen    – the top-level route/modal this element lives in
 *                e.g. "login", "dashboard", "pool", "pool_list",
 *                     "entry_modal", "quick_nav", "lending", "settlements"
 *   component – the logical widget within that screen
 *                e.g. "header", "bottom_actions", "overview_card", "tx_row"
 *   element   – the specific node type
 *                e.g. "container", "avatar", "label", "button", "input"
 *   #id       – stable row/item id; use entity UUID when available,
 *                fall back to array index (e.g. #0, #1)
 *
 * Examples:
 *   pool.member_chips.avatar#abc123
 *   pool_list.pool_card.name#def456
 *   dashboard.header.avatar_button
 *   entry_modal.numpad.key#7
 *   quick_nav.account_row.container#uuid
 *
 * ─── DEBUG_UI mode ───────────────────────────────────────────────────────────
 *
 *   Set DEBUG_UI=true in your .env (EXPO_PUBLIC_DEBUG_UI=true) to enable
 *   a visible overlay border on every instrumented element in the web DOM.
 *   This is purely for verification — no visual changes in production.
 *
 *   CSS injected once on first `uiProps()` call on web:
 *     [data-ui] { outline: 1px dashed rgba(83,227,166,0.5) !important; }
 *     [data-ui]:hover::after { content: attr(data-ui); position: fixed; ... }
 */

import { Alert, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Cross-platform alert
// ---------------------------------------------------------------------------

/**
 * Shows an alert dialog that actually works on both web and native.
 * React Native Web's Alert.alert is a complete no-op — use this instead.
 *
 * @example
 * webAlert('Error', 'Failed to close pool')
 */
export function webAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// ---------------------------------------------------------------------------
// DEBUG_UI mode (web only)
// ---------------------------------------------------------------------------

let _debugCssInjected = false;

function injectDebugCss(): void {
  if (_debugCssInjected || typeof document === 'undefined') return;
  _debugCssInjected = true;
  const style = document.createElement('style');
  style.id = 'devtools-debug-ui';
  style.textContent = `
    [data-ui] { outline: 1px dashed rgba(83,227,166,0.45) !important; position: relative; }
    [data-ui]:hover { outline-color: rgba(83,227,166,0.9) !important; }
    [data-ui]:hover::after {
      content: attr(data-ui);
      position: fixed;
      bottom: 4px;
      left: 4px;
      z-index: 99999;
      background: rgba(10,20,35,0.92);
      color: #53E3A6;
      font: 11px/1.4 monospace;
      padding: 2px 6px;
      border-radius: 4px;
      pointer-events: none;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

const DEBUG_UI =
  typeof process !== 'undefined' &&
  process.env.EXPO_PUBLIC_DEBUG_UI === 'true';

// ---------------------------------------------------------------------------
// Path builder
// ---------------------------------------------------------------------------

/**
 * Build a stable, human-readable UI path identifier.
 * Use this everywhere — never hardcode path strings.
 *
 * @example
 * uiPath('pool', 'member_chips', 'avatar', member.id)
 * // → "pool.member_chips.avatar#abc-123"
 */
export function uiPath(
  screen: string,
  component: string,
  element: string,
  id?: string | number | null,
): string {
  const base = `${screen}.${component}.${element}`;
  return id != null ? `${base}#${id}` : base;
}

// ---------------------------------------------------------------------------
// Element props helper
// ---------------------------------------------------------------------------

/**
 * Returns RN props to spread onto any React Native element.
 *
 * On web  → sets both `testID` and `data-ui` (visible in Chrome → Elements).
 * Native  → sets `testID` only (visible in Accessibility Inspector / Appium).
 *
 * The return type is narrowed to `{ testID: string }` so TypeScript accepts
 * the spread on all RN components. React Native Web forwards unknown `data-*`
 * attributes to the DOM even though the TS types don't declare them.
 *
 * @example
 * <View {...uiProps(uiPath('dashboard', 'header', 'container'))} />
 */
export function uiProps(path: string): { testID: string } {
  const props: Record<string, string> = { testID: path };
  if (Platform.OS === 'web') {
    props['data-ui'] = path;
    if (DEBUG_UI) injectDebugCss();
  }
  return props as { testID: string };
}

// ---------------------------------------------------------------------------
// Console loggers  (no-ops in production)
// ---------------------------------------------------------------------------

/**
 * Log a UI lifecycle event.
 * Appears in Console tab as: [UI] <path> <event>
 *
 * @example
 * logUI(uiPath('pool', 'member_chips', 'avatar', id), 'mounted')
 * // → [UI] pool.member_chips.avatar#abc123 mounted
 */
export function logUI(path: string, event = 'rendered'): void {
  if (__DEV__) {
    console.debug(`[UI] ${path} ${event}`);
  }
}

/**
 * Log an outbound API / data-fetch call.
 * Appears in Console tab as: [API] { source, action } <url>
 *
 * Pair each log with the Network tab entry — timestamps will align.
 *
 * @example
 * logAPI('supabase://pools', { source: 'pool_list.scroll_view.root', action: 'getUserPools' })
 */
export function logAPI(
  url: string,
  meta: { source: string; triggeredBy?: string; action?: string },
): void {
  if (__DEV__) {
    console.debug('[API]', meta, url);
  }
}
