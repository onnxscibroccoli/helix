import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineBoard } from "@/components/deploy/pipeline-board";
import { getHypervisorStatus, type HypervisorCapabilities } from "@/lib/hypervisor";
import { listWorkspaces, teardownWorkspace } from "@/lib/workspaces";
import { stopDomain } from "@/lib/hypervisor";
import type { Workspace } from "@/lib/workspace-types";

export const Route = createFileRoute("/console/")({ component: WorkspacesPage });

function WorkspacesPage() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<Workspace[] | null>(null);
  const [caps, setCaps] = useState<(HypervisorCapabilities & { error?: string }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadCaps = useCallback(async () => {
    const live = await getHypervisorStatus();
    setCaps(live);
  }, []);

  const reload = useCallback(async () => {
    try {
      const rows = await listWorkspaces();
      setSpaces(rows);
    } catch {
      setError("Unable to load workspaces.");
    }
  }, []);

  useEffect(() => {
    void reload();
    void reloadCaps();
  }, [reload, reloadCaps]);

  async function destroy(id: string) {
    setBusy(id);
    try {
      await stopDomain({ data: { id } });
      await teardownWorkspace({ data: { id } });
      await reload();
    } catch {
      setError("Could not destroy the domain.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Deploy</p>
        <h2 className="mt-1 text-xl font-medium tracking-tight">Nested KVM pipeline</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Probe this node, allocate a qcow2, boot TinyCore with KVM acceleration, then attach an RFB stream over
          WebSocket. Sign-in already bound the volume namespace to your identity.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {caps ? (
            <>
              <Badge tone={caps.kvm ? "ok" : "danger"}>/dev/kvm {caps.kvm ? "live" : "missing"}</Badge>
              <Badge tone={caps.nested === "Y" || caps.nested === "1" ? "ok" : "warn"}>nested={caps.nested}</Badge>
              <Badge tone={caps.qemu ? "ok" : "danger"}>{caps.qemuVersion ?? "qemu offline"}</Badge>
              <Badge tone={caps.kernel ? "ok" : "warn"}>{caps.guestOs}</Badge>
              <Badge tone="default">
                {caps.guests} guest{caps.guests === 1 ? "" : "s"}
              </Badge>
            </>
          ) : (
            <Skeleton className="h-6 w-48 rounded-full" />
          )}
        </div>
      </div>

      <PipelineBoard caps={caps} onCaps={reloadCaps} />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div>
        <h2 className="text-sm font-medium">Your domains</h2>
        <div className="mt-3 grid gap-3">
          {spaces === null ? (
            <>
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </>
          ) : spaces.length === 0 ? (
            <Card className="text-sm text-muted">No domains yet. Run the pipeline to boot a guest.</Card>
          ) : (
            spaces.map((ws) => (
              <Card key={ws.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{ws.name}</p>
                    <Badge tone={ws.kind === "persistent" ? "live" : "warn"}>{ws.kind}</Badge>
                    <Badge tone={ws.status === "running" ? "ok" : "default"}>{ws.status}</Badge>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-muted">
                    {ws.kernel} · {ws.hostNode} · {ws.ipv4}
                    {ws.vncPort ? ` · vnc :${ws.vncPort}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void navigate({
                        to: "/desktop/$workspaceId",
                        params: { workspaceId: ws.id },
                      })
                    }
                  >
                    <Play className="size-3.5" />
                    Attach stream
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === ws.id} onClick={() => void destroy(ws.id)}>
                    <Trash2 className="size-3.5" />
                    Destroy
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
