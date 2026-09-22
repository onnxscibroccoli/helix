import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/console/console-shell";

export const Route = createFileRoute("/console")({
  component: ConsoleShell,
});
