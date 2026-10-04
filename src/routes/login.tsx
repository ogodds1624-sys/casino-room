import { createFileRoute } from "@tanstack/react-router";
import { AccountLanding } from "@/components/account-landing";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return <AccountLanding mode="login" />;
}
