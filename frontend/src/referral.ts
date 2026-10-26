const KEY = 'pbingu_referral';
const MAX_AGE = 30 * 86400000;
let memory: { code: string; expiresAt: number } | null = null;
export function getReferral(): string | undefined {
  try { memory = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { /* Use in-memory attribution when storage is unavailable. */ }
  if (!memory || memory.expiresAt <= Date.now()) { clearReferral(); return undefined; }
  return /^[a-z0-9-]{4,32}$/.test(memory.code) ? memory.code : undefined;
}
export function captureReferral(search: string, authenticated: boolean) {
  if (authenticated || getReferral()) return;
  const code = new URLSearchParams(search).get('ref')?.trim().toLowerCase();
  if (!code || !/^[a-z0-9-]{4,32}$/.test(code)) return;
  memory = { code, expiresAt: Date.now() + MAX_AGE };
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Attribution remains available in this page session. */ }
}
export function clearReferral() {
  memory = null;
  try { localStorage.removeItem(KEY); } catch { /* No persistent storage. */ }
}
