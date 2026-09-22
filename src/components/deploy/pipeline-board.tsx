import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HardDrive, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getHypervisorStatus, startDomain, type HypervisorCapabilities } from "@/lib/hypervisor";
import { createWorkspace } from "@/lib/workspaces";
import type { WorkspaceKind } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "kvm", label: "Nested KVM" },
  { id: "oidc", label: "OIDC session" },
  { id: "volume", label: "qcow2 volume" },
  { id: "qemu", label: "Boot TinyCore" },
  { id: "kasm", label: "WebSocket RFB" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type StepState = "idle" | "run" | "ok" | "fail";

export function PipelineBoard({
  caps,
  onCaps,
}: {
  caps: (HypervisorCapabilities & { error?: string }) | null;
  onCaps: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<WorkspaceKind>("persistent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [states, setStates] = useState<Record<StepId, StepState>>({
    kvm: "idle",
    oidc: "idle",
    volume: "idle",
    qemu: "idle",
    kasm: "idle",
  });

  function setStep(id: StepId, state: StepState) {
    setStates((s) => ({ ...s, [id]: state }));
  }

  function line(msg: string) {
    setLogs((prev) => [...prev, msg]);
  }

  async function provision() {
    setBusy(true);
    setError(null);
    setLogs([]);
    setStates({ kvm: "run", oidc: "idle", volume: "idle", qemu: "idle", kasm: "idle" });
    try {
      line("Probing /dev/kvm and nested paging");
      const live = await getHypervisorStatus();
      await onCaps();
      if (!live.kvm || !live.qemu) {
        setStep("kvm", "fail");
        throw new Error(live.kvm ? "QEMU is not available on this node." : "/dev/kvm is missing.");
      }
      line(`${live.node} nested=${live.nested} ${live.qemuVersion ?? ""}`);
      line(`guest ${live.guestOs} · ${live.nic} ${live.guestNet}`);
      setStep("kvm", "ok");
      setStep("oidc", "run");
      line("Mapping verified identity to an isolated volume namespace");
      setStep("oidc", "ok");
      setStep("volume", "run");
      line(`Creating ${kind} workspace metadata`);
      const ws = await createWorkspace({ data: { kind } });
      line(`Allocated ${ws.name} · ${ws.hostNode} · qcow2 ${ws.volumeGb}G · NAT ${ws.ipv4}`);
      setStep("volume", "ok");
      setStep("qemu", "run");
      line("Spawning qemu-system-x86_64 -enable-kvm -kernel vmlinuz64 (skip isolinux)");
      const domain = await startDomain({ data: { id: ws.id, kind } });
      for (const l of domain.logs.slice(-10)) line(l);
      setStep("qemu", "ok");
      setStep("kasm", "run");
      line(`RFB ${domain.vncPort} · ticket issued`);
      line(`WebSocket ${domain.streamPath}?ticket=…`);
      setStep("kasm", "ok");
      await navigate({
        to: "/desktop/$workspaceId",
        params: { workspaceId: ws.id },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Provisioning failed";
      setError(msg);
      line(msg);
      setStates((s) => {
        const next = { ...s };
        (Object.keys(next) as StepId[]).forEach((k) => {
          if (next[k] === "run") next[k] = "fail";
        });
        return next;
      });
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="grid gap-3">
        <Card className={cn(kind === "persistent" && "shadow-[var(--shadow-border-hover)]")}>
          <button type="button" className="w-full text-left" onClick={() => setKind("persistent")}>
            <div className="flex items-center gap-2">
              <HardDrive className="size-4 text-primary" />
              <h3 className="text-sm font-medium">Persistent studio</h3>
              {kind === "persistent" ? <Badge tone="live">selected</Badge> : null}
            </div>
            <p className="mt-3 text-sm text-muted">
              Nested KVM guest on an 8G qcow2. TinyCore GUI stream survives reconnect. Disk is kept.
            </p>
          </button>
        </Card>
        <Card className={cn(kind === "ephemeral" && "shadow-[var(--shadow-border-hover)]")}>
          <button type="button" className="w-full text-left" onClick={() => setKind("ephemeral")}>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <h3 className="text-sm font-medium">Ephemeral guest</h3>
              {kind === "ephemeral" ? <Badge tone="warn">selected</Badge> : null}
            </div>
            <p className="mt-3 text-sm text-muted">
              Scratch domain. qcow2 unlinked on disconnect. Same KVM path, same NAT, no leftover disk.
            </p>
          </button>
        </Card>
        <Button size="lg" disabled={busy || !caps?.kvm} onClick={() => void provision()}>
          {busy ? "Provisioning nested KVM…" : "Provision and attach stream"}
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
      <Card className="flex min-h-72 flex-col p-0 sm:min-h-80">
        <ol className="flex flex-wrap gap-2 border-b border-border p-4">
          {STEPS.map((s) => (
            <li key={s.id}>
              <Badge
                tone={
                  states[s.id] === "ok" ? "ok" : states[s.id] === "fail" ? "danger" : states[s.id] === "run" ? "live" : "default"
                }
              >
                {s.label}
              </Badge>
            </li>
          ))}
        </ol>
        <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-muted">
          {logs.length
            ? logs.join("\n")
            : "Idle. Provisioning probes KVM, allocates a qcow2, boots TinyCore over nested KVM, and opens the RFB WebSocket."}
        </pre>
      </Card>
    </div>
  );
}
