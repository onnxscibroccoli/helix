import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getHypervisorStatus,
  listDomains,
  type HypervisorCapabilities,
  type HypervisorDomain,
} from "@/lib/hypervisor";
import { NETWORK } from "@/lib/fleet";

export const Route = createFileRoute("/console/fleet")({ component: FleetPage });

function FleetPage() {
  const [caps, setCaps] = useState<(HypervisorCapabilities & { error?: string }) | null>(null);
  const [domains, setDomains] = useState<HypervisorDomain[] | null>(null);

  useEffect(() => {
    getHypervisorStatus()
      .then(setCaps)
      .catch(() => setCaps(null));
    listDomains()
      .then(setDomains)
      .catch(() => setDomains([]));
  }, []);

  return (
    <div className="grid gap-6">
      {caps ? (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{caps.node}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {caps.hostname} · {caps.region}
              </p>
            </div>
            <Badge tone={caps.kvm && caps.qemu ? "ok" : "danger"}>
              {caps.kvm && caps.qemu ? "RUNNING" : "DEGRADED"}
            </Badge>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Stat k="KVM" v={caps.kvm ? "/dev/kvm" : "missing"} />
            <Stat k="Nested" v={caps.nested} />
            <Stat k="QEMU" v={caps.qemuVersion ?? "offline"} />
            <Stat k="Guests" v={String(caps.guests)} />
            <Stat k="ISO / kernel" v={caps.iso && caps.kernel ? "ready" : "extract"} />
            <Stat k="Guest OS" v={caps.guestOs} />
          </dl>
          {caps.error ? <p className="mt-4 text-sm text-danger">{caps.error}</p> : null}
        </Card>
      ) : (
        <Skeleton className="h-48 w-full rounded-xl" />
      )}
      <Card className="p-6">
        <h2 className="text-sm font-medium">Guest network</h2>
        <p className="mt-2 text-sm text-muted">
          Each domain gets an e1000 NIC on QEMU user-mode NAT. Outbound internet is independent. Inbound is the
          authenticated RFB WebSocket only — no tunnel, no extra relay.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Stat k="Mode" v={NETWORK.mode} />
          <Stat k="NIC" v={NETWORK.nic} />
          <Stat k="CIDR" v={NETWORK.guestCidr} />
          <Stat k="DHCP" v={NETWORK.guestIp} />
          <Stat k="Gateway" v={NETWORK.gateway} />
          <Stat k="DNS" v={NETWORK.dns} />
        </dl>
      </Card>
      <div>
        <h2 className="text-sm font-medium">Live domains</h2>
        <div className="mt-3 grid gap-3">
          {domains === null ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : domains.length === 0 ? (
            <Card className="text-sm text-muted">No QEMU domains running on this node.</Card>
          ) : (
            domains.map((d) => (
              <Card key={d.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm">{d.id.slice(0, 8)}</p>
                    <Badge tone={d.status === "running" ? "ok" : "default"}>{d.status}</Badge>
                    <Badge tone={d.kind === "persistent" ? "live" : "warn"}>{d.kind}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {d.guestIp} · vnc :{d.vncPort} · {d.memoryMb} MiB · {d.streamPath}
                  </p>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-xs uppercase tracking-widest text-subtle">{k}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{v}</dd>
    </div>
  );
}
