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
          <p className="mt-2 text-2xl font-medium tracking-tight">OCI block</p>
          <p className="mt-2 text-sm text-muted">
            Paravirtualized attachment. 60 IOPS/GB, retained across reboot and re-provision. Home, kernels, canaries.
          </p>
        </Card>
        <Card>
          <p className="font-mono text-xs uppercase tracking-widest text-subtle">Ephemeral tier</p>
          <p className="mt-2 text-2xl font-medium tracking-tight">tmpfs / NVMe</p>
          <p className="mt-2 text-sm text-muted">
            Destroyed on SessionEnding. No host block devices are visible to the guest. TAP released with the domain.
          </p>
        </Card>
      </div>
      <div>
        <h2 className="text-sm font-medium">Attached volumes</h2>
        <div className="mt-3 grid gap-3">
          {spaces === null ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : spaces.length === 0 ? (
            <Card className="text-sm text-muted">No volumes attached. Provision a studio to allocate a block device.</Card>
          ) : (
            spaces.map((ws) => (
              <Card key={ws.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{ws.name}</p>
                    <Badge tone={ws.kind === "persistent" ? "live" : "warn"}>
                      {ws.kind === "persistent" ? "/dev/vda" : "tmpfs"}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {ws.volumeGb} GB · {ws.hostNode} · {ws.ipv4}
                  </p>
                </div>
                <p className="font-mono text-xs tabular-nums text-muted">
                  {ws.kind === "persistent" ? "retained indefinitely" : "destroyed on logout"}
                </p>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
