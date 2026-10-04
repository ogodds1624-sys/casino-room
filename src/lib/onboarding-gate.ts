export type OnboardingCountry = "Ghana" | "Nigeria";

export type OnboardingRejection = { ok: false; message: string };

export type OnboardingAcceptance = {
  ok: true;
  completionStatus: true;
  name: string;
  email: string;
  country: OnboardingCountry;
  sportyNumber: string;
  authBody: { name: string; email: string; password: string; rememberMe: true };
};

export type OnboardingGate = OnboardingRejection | OnboardingAcceptance;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function sportyNumberMatches(country: OnboardingCountry, number: string) {
  const digits = number.replace(/\D/g, "");
  if (country === "Nigeria") return digits.length === 10 || digits.length === 11;
  return digits.length === 9 || digits.length === 10;
}

/**
 * Rejects an unfinished registration before any account insert.
 * `completionStatus` must be the boolean true, and the registration form,
 * country, and SportyBet number must all be present.
 */
export function validateOnboardingBody(body: unknown): OnboardingGate {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Finish registration before creating an account." };
  }
  const record = body as Record<string, unknown>;
  if (record.completionStatus !== true) {
    return { ok: false, message: "Finish registration before creating an account." };
  }
  const name = text(record.name);
  const email = text(record.email).toLowerCase();
  const password = typeof record.password === "string" ? record.password : "";
  const country = record.country === "Nigeria" ? "Nigeria" : record.country === "Ghana" ? "Ghana" : "";
  const sportyNumber = String(record.sportyNumber ?? "").replace(/\D/g, "");
  if (name.length < 2) return { ok: false, message: "Enter your name." };
  if (!email.includes("@") || !email.includes(".")) return { ok: false, message: "Enter a valid email." };
  if (password.length < 8) return { ok: false, message: "Use at least 8 characters." };
  if (!country) return { ok: false, message: "Choose Ghana or Nigeria." };
  if (!sportyNumberMatches(country, sportyNumber)) {
    return {
      ok: false,
      message:
        country === "Nigeria"
          ? "Enter a 10 or 11 digit SportyBet number."
          : "Enter a 9 or 10 digit SportyBet number.",
    };
  }
  return {
    ok: true,
    completionStatus: true,
    name,
    email,
    country,
    sportyNumber,
    authBody: { name, email, password, rememberMe: true },
  };
}
