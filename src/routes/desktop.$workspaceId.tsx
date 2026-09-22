import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { StreamViewer } from "@/components/kasm/stream-viewer";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDomain, startDomain, stopDomain, type HypervisorDomain } from "@/lib/hypervisor";
import { getWorkspace, teardownWorkspace } from "@/lib/workspaces";
import type { Workspace } from "@/lib/workspace-types";
import { Skeleton } from "@/components/ui/skeleton";
import { TeardownSequence } from "@/components/desktop/teardown-sequence";

export const Route = createFileRoute("/desktop/$workspaceId")({
  component: DesktopPage,
});

function DesktopPage() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [workspace, setWorkspace] = useState<Workspace | null | undefined>(undefined);
  const [domain, setDomain] = useState<HypervisorDomain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"boot" | "stream" | "teardown">("boot");
  const [logs, setLogs] = useState<string[]>(["Probing nested KVM…"]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const ws = await getWorkspace({ data: { id: workspaceId } });
        if (cancelled) return;
        setWorkspace(ws);
        if (!ws) return;
        setLogs((l) => [...l, `Domain ${ws.name}`, "Starting qemu-system-x86_64 -enable-kvm"]);
        let live = await getDomain({ data: { id: workspaceId } });
        if (!live || live.status !== "running") {
          live = await startDomain({ data: { id: workspaceId, kind: ws.kind } });
        }
        if (cancelled) return;
        setDomain(live);
        setLogs(live.logs.length ? live.logs : ["RFB ready"]);
        setPhase("stream");
      } catch (e) {
        if (cancelled) return;
        setWorkspace((prev) => prev ?? null);
        setError(e instanceof Error ? e.message : "Failed to attach KVM stream");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, workspaceId]);

  async function disconnect() {
    if (!workspace) return;
    if (workspace.kind === "ephemeral") {
      setPhase("teardown");
      return;
    }
    await stopDomain({ data: { id: workspace.id } });
    await navigate({ to: "/console" });
  }

  async function finishTeardown() {
    if (workspace) {
      await stopDomain({ data: { id: workspace.id } });
      await teardownWorkspace({ data: { id: workspace.id } });
    }
    await navigate({ to: "/console" });
  }

  if (isPending || workspace === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!workspace) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
        Domain not found.
      </div>
    );
  }
  if (phase === "teardown") {
    return <TeardownSequence onDone={() => void finishTeardown()} />;
  }
  if (phase === "boot" || !domain) {
    return (
      <div className="flex min-h-dvh flex-col bg-background px-4 py-8 font-mono text-sm text-primary sm:px-10">
        <p className="text-xs uppercase tracking-widest text-muted">Nested KVM boot</p>
        <pre className="mt-6 whitespace-pre-wrap leading-relaxed">
          {error ?? logs.join("\n")}
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
        </pre>
      </div>
    );
  }

  return <StreamViewer workspace={workspace} domain={domain} onDisconnect={() => void disconnect()} />;
}
