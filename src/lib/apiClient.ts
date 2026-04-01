/**
 * Traced fetch wrapper.
 *
 * Usage:
 *   import { tracedFetch } from '../lib/apiClient';
 *
 *   const res = await tracedFetch('/api/v1/items', {}, {
 *     source: 'inventory.items_list.fetch',
 *     triggeredBy: 'inventory.filter.submit',
 *     action: 'loadItems',
 *   });
 *
 * Every call is logged to the Console tab as [API] so you can correlate a
 * Network tab request with the UI element that triggered it.
 *
 * Note: Supabase SDK uses its own internal fetch.  To trace Supabase queries
 * add logAPI() calls directly in the hooks (see usePools.ts for examples).
 */

import { logAPI } from './devtools';

export interface RequestMeta {
  /** Dot-path of the UI element that initiated the request. */
  source: string;
  /** Dot-path of the element the user interacted with (if different from source). */
  triggeredBy?: string;
  /** Human-readable action name (e.g. "loadPools", "createPool"). */
  action?: string;
}

/**
 * Drop-in replacement for `fetch` that logs request metadata to the console.
 * The Network tab will show the actual HTTP request; this ties it to a source.
 */
export async function tracedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  meta?: RequestMeta,
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

  if (meta) {
    logAPI(url, meta);
  }

  return fetch(input, init);
}
