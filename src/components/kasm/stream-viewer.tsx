import { useEffect, useRef, useState } from "react";
import RFB from "@novnc/novnc";
import { HelixMark } from "@/components/helix-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/workspace-types";
import type { HypervisorDomain } from "@/lib/hypervisor";
import { cn } from "@/lib/utils";

export function StreamViewer({
  workspace,
  domain,
  onDisconnect,
}: {
  workspace: Workspace;
  domain: HypervisorDomain;
  onDisconnect: () => void;
}) {
  const screenRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "lost">("connecting");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/kasm/ws/${domain.id}?ticket=${encodeURIComponent(domain.ticket)}`;
    const rfb = new RFB(el, url);
    rfb.scaleViewport = true;
    rfb.clipViewport = true;
    rfb.background = "#09090b";
    rfb.focusOnClick = true;
    const onConnect = () => setStatus("live");
    const onDisconnect = (ev: { detail?: { clean?: boolean } }) => {
      setStatus(ev.detail?.clean ? "lost" : "lost");
    };
    rfb.addEventListener("connect", onConnect);
    rfb.addEventListener("disconnect", onDisconnect);
    rfbRef.current = rfb;
    return () => {
      rfb.removeEventListener("connect", onConnect);
      rfb.removeEventListener("disconnect", onDisconnect);
      try {
        rfb.disconnect();
      } catch {
        /* already gone */
      }
      rfbRef.current = null;
    };
  }, [domain.id, domain.ticket]);

  return (
    <div className="relative flex h-dvh flex-col bg-background text-foreground">
      <header className="z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-2 sm:h-14 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <HelixMark className="size-5 shrink-0" />
          <p className="truncate text-sm font-medium">{workspace.name}</p>
          <Badge tone={workspace.kind === "persistent" ? "live" : "warn"}>{workspace.kind}</Badge>
          <Badge tone={status === "live" ? "ok" : status === "connecting" ? "live" : "danger"}>
            {status === "live" ? "101 wss" : status === "connecting" ? "rfb" : "lost"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden font-mono text-xs tabular-nums text-muted sm:inline">
            :{domain.vncPort} · {domain.vcpus} vCPU · {domain.memoryMb} MiB
          </span>
          <span className="hidden font-mono text-xs tabular-nums text-muted sm:inline">{clock}</span>
          <Button
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={() => rfbRef.current?.sendCtrlAltDel()}
          >
            Ctrl-Alt-Del
          </Button>
          <Button size="sm" variant="outline" onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
      </header>
      <div
        ref={screenRef}
        className={cn("helix-stream relative min-h-0 flex-1 overflow-hidden bg-background")}
        onClick={() => rfbRef.current?.focus()}
      />
      {status !== "live" ? (
        <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
          <p className="rounded-sm bg-elevated px-3 py-2 font-mono text-xs text-muted">
            {status === "connecting" ? "Upgrading WebSocket · attaching RFB canvas" : "Stream closed"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
