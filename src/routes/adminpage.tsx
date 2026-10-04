import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/adminpage")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
});
