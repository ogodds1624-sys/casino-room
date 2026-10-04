import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/partners")({
  beforeLoad: () => {
    throw redirect({ to: "/partner" });
  },
});
