import type { OnboardingCountry } from "@/lib/onboarding-gate";

const STORAGE_KEY = "aviator-pending-registration";

export type PendingRegistration = {
  name: string;
  email: string;
  password: string;
  country: OnboardingCountry | null;
  completionStatus: false;
};

let connectHandoff = false;

export function armConnectHandoff() {
  connectHandoff = true;
}

export function connectHandoffActive() {
  return connectHandoff;
}

export function clearPending() {
  connectHandoff = false;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem("aviator-register-connect");
  } catch {
    // Storage can be blocked. The in-memory handoff is already cleared.
  }
}

export function savePending(pending: PendingRegistration) {
  if (pending.completionStatus !== false) return false;
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function readPending(): PendingRegistration | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingRegistration>;
    if (parsed.completionStatus !== false) return null;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const email = typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : "";
    const password = typeof parsed.password === "string" ? parsed.password : "";
    const country = parsed.country === "Nigeria" ? "Nigeria" : parsed.country === "Ghana" ? "Ghana" : null;
    if (name.length < 2 || !email.includes("@") || password.length < 8) return null;
    return { name, email, password, country, completionStatus: false };
  } catch {
    return null;
  }
}
