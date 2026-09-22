import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHypervisorStatus, type HypervisorCapabilities } from "@/lib/hypervisor";
import { NETWORK } from "@/lib/fleet";

export const Route = createFileRoute("/console/fleet")({ component: FleetPage });

function FleetPage() {
  const [caps, setCaps] = useState<(HypervisorCapabilities & { error?: string }) | null>(null);

  useEffect(() => {
    getHypervisorStatus()
      .then(setCaps)
      .catch(() => setCaps(null));
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
            <Stat k="ISO" v={caps.iso ? "present" : "download"} />
            <Stat k="Engine" v="qemu-system-x86_64" />
          </dl>
          {caps.error ? <p className="mt-4 text-sm text-danger">{caps.error}</p> : null}
        </Card>
      ) : (
        <Skeleton className="h-48 w-full rounded-xl" />
      )}
      <Card className="p-6">
        <h2 className="text-sm font-medium">Tenancy (Terraform)</h2>
        <p className="mt-2 text-sm text-muted">
          OCI hypervisor nodes are declared in infra/terraform — VM.Standard3.Flex, nested virt, 200 GB volumes.
          This control plane is bound to the local nested-KVM node until those instances are applied.
        </p>
        <pre className="mt-5 overflow-x-auto font-mono text-xs leading-relaxed text-muted">
          {`resource "oci_core_instance" "hypervisor_node" {
  shape = "VM.Standard3.Flex"
  shape_config { ocpus = 8  memory_in_gbs = 64 }
}`}
        </pre>
      </Card>
      <Card className="p-6">
        <h2 className="text-sm font-medium">Network isolation</h2>
        <p className="mt-2 text-sm text-muted">
          Public ingress is confined to {NETWORK.publicCidr}. Hypervisors sit on {NETWORK.computeCidr}. Guests land on{" "}
          {NETWORK.bridgeCidr} behind user-net NAT for the local node, virbr0 on OCI.
        </p>
        <pre className="mt-5 overflow-x-auto font-mono text-xs leading-relaxed text-muted">
          {`ebtables -A FORWARD -p IPv4 -i tap+ -o tap+ -j DROP
iptables -A FORWARD -i virbr0 -o virbr0 -m physdev --physdev-is-bridged -j DROP
gateway ${NETWORK.gateway}`}
        </pre>
      </Card>
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
