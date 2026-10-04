import { saveReferral } from "@/lib/admin-snapshot";

export function storedReferral() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("aviator-ref")?.trim() ?? "";
}

export async function rememberReferral() {
  const referredBy = storedReferral();
  if (!referredBy) return;
  await saveReferral({ data: { referredBy } });
}
