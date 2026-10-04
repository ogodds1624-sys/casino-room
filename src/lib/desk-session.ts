export const PREDICTOR_URL = "https://baker-king-acre-ivory.grok.me";
const KEY = "aviator-session";

export function minutesFor(amount: number) {
  if (amount === 1700) return 20;
  if (amount === 800) return 10;
  if (amount === 500 || amount === 75000) return 7;
  if (amount === 400 || amount === 55000) return 5;
  return 3;
}

export function startSession(amount: number) {
  const mins = minutesFor(amount);
  const endsAt = Date.now() + mins * 60 * 1000;
  window.localStorage.setItem(KEY, JSON.stringify({ endsAt, mins }));
}

export function readSession() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { endsAt?: number; mins?: number };
    if (!Number.isFinite(data.endsAt)) return null;
    return { endsAt: data.endsAt as number, mins: Number(data.mins) || 0 };
  } catch {
    return null;
  }
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}

export function sessionLeft() {
  const session = readSession();
  if (!session) return 0;
  return Math.max(0, session.endsAt - Date.now());
}
