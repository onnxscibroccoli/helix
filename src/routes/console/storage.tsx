import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listWorkspaces } from "@/lib/workspaces";
import type { Workspace } from "@/lib/workspace-types";

export const Route = createFileRoute("/console/storage")({ component: StoragePage });

function StoragePage() {
  const [spaces, setSpaces] = useState<Workspace[] | null>(null);

  useEffect(() => {
    listWorkspaces()
      .then(setSpaces)
      .catch(() => setSpaces([]));
  }, []);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-subtle">Persistent tier</p>
          <p className="mt-2 text-2xl font-medium tracking-tight">qcow2 on node</p>
          <p className="mt-2 text-sm text-muted">
            8G IDE disk kept across reconnect and reboot of the guest. TinyCore can format and install to it from the
            live desktop.
          </p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-subtle">Ephemeral tier</p>
          <p className="mt-2 text-2xl font-medium tracking-tight">unlinked on stop</p>
          <p className="mt-2 text-sm text-muted">
            2G scratch qcow2. The daemon deletes the file when the domain exits. No leftover disk.
          </p>
        </Card>
      </div>
      <div>
        <h2 className="text-sm font-medium">Attached volumes</h2>
        <div className="mt-3 grid gap-3">
          {spaces === null ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : spaces.length === 0 ? (
            <Card className="text-sm text-muted">No volumes attached. Provision a studio to allocate a qcow2.</Card>
          ) : (
            spaces.map((ws) => (
              <Card key={ws.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{ws.name}</p>
                    <Badge tone={ws.kind === "persistent" ? "live" : "warn"}>
                      {ws.kind === "persistent" ? "retained" : "scratch"}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {ws.volumeGb} GB qcow2 · {ws.hostNode} · {ws.ipv4 ?? "10.0.2.15"}
                  </p>
                </div>
                <p className="font-mono text-xs tabular-nums text-muted">
                  {ws.kind === "persistent" ? "kept on disk" : "destroyed on logout"}
                </p>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
