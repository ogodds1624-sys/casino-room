import { abandonUnlinkedAccount } from "@/lib/admin-snapshot";
import { signOut } from "@/lib/auth/client";
import { clearPending } from "@/lib/pending-registration";

export async function leaveUnlinked() {
  try {
    await abandonUnlinkedAccount();
  } catch {
    // Still leave the preview even if the account row is already gone.
  }
  try {
    window.localStorage.removeItem("aviator-hack-email");
    window.localStorage.removeItem("aviator-country");
    window.localStorage.removeItem("aviator-hack-sportybet");
    clearPending();
  } catch {
    // Storage can be blocked in the preview iframe.
  }
  try {
    await signOut("/");
  } catch {
    if (window.location.pathname !== "/") window.location.href = "/";
  }
}
