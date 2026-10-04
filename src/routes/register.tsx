import { createFileRoute } from "@tanstack/react-router";
import { AccountLanding } from "@/components/account-landing";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  return <AccountLanding mode="register" />;
}
