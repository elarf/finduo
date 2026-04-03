/** Current app version — bump this alongside package.json when releasing. */
export const APP_VERSION = '1.0.6';

const REMOTE_PACKAGE_URL =
  'https://raw.githubusercontent.com/elarf/finduo/main/package.json';

/** Fetches the version field from the main-branch package.json. Returns null on failure. */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${REMOTE_PACKAGE_URL}?_=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json() as { version?: string };
    return json.version ?? null;
  } catch {
    return null;
  }
}

/** Compares two semver strings. Returns true if b > a. */
export function isNewerVersion(current: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [ca, cb, cc] = parse(current);
  const [ra, rb, rc] = parse(remote);
  if (ra !== ca) return ra > ca;
  if (rb !== cb) return rb > cb;
  return rc > cc;
}
