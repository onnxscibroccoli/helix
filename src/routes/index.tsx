import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, Globe, Shield, Monitor } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="helix-wash min-h-dvh">
      <SiteNav />
      <main>
        <Hero />
        <Architecture />
        <Persistence />
        <Proof />
        <Footer />
      </main>
    </div>
  );
}

function Hero() {
  const { user, isPending } = useCurrentUserState();
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Persistent cloud desktop</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-medium leading-tight tracking-tight sm:text-6xl">
        A Linux machine that streams into the browser.
      </h1>
      <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
        Nested KVM. TinyCore graphical session. Google or X sign-in. RFB over a direct WebSocket — a real QEMU guest,
        not a painted window manager.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {isPending ? (
          <Skeleton className="h-12 w-40 rounded-md" />
        ) : (
          <Link to={user ? "/console" : "/login"}>
            <Button size="lg">
              {user ? "Open console" : "Sign in and deploy"}
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        )}
        <a href="#architecture" className="inline-flex h-12 items-center px-4 text-sm text-muted hover:text-foreground">
          Read the topology
        </a>
      </div>
      <dl className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          ["Nested", "KVM / QEMU"],
          ["Guest", "TinyCore 15 GUI"],
          ["Stream", "RFB / WSS"],
          ["IdP", "Google · X"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-xs uppercase tracking-widest text-subtle">{k}</dt>
            <dd className="mt-1 text-sm">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Architecture() {
  return (
    <section id="architecture" className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Topology</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl">
          Browser to hypervisor, without leaking the host.
        </h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-4">
          {[
            { t: "Ingress", d: "TLS terminator. Authenticated WebSocket to the control plane." },
            { t: "Identity", d: "Google or X OIDC. Volume namespace bound to the verified user." },
            { t: "Hypervisor", d: "This node: nested=Y, qemu-system-x86_64, host CPU passthrough." },
            { t: "Guest", d: "TinyCore GUI. e1000 on user NAT. Persistent qcow2 or unlinked scratch." },
          ].map((item) => (
            <article key={item.t} className="rounded-lg bg-card p-5 shadow-[var(--shadow-border)]">
              <h3 className="text-sm font-medium">{item.t}</h3>
              <p className="mt-2 text-sm text-muted">{item.d}</p>
            </article>
          ))}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-subtle">Packet path</p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-5">
            {["Client", "OIDC", "Control plane", "QEMU/KVM", "TinyCore"].map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ol>
          <pre className="mt-8 overflow-x-auto font-mono text-xs leading-relaxed text-muted">
            {`Client ── HTTPS/WSS ── Control plane ── /kasm/ws/:id?ticket=
                              │
                              ├─ Postgres   session + volume map
                              └─ Hypervisor nested KVM
                                    ├─ Persistent  qcow2 kept
                                    └─ Ephemeral   qcow2 unlinked
                              Guest NIC e1000 → 10.0.2.15 NAT → public net`}
          </pre>
        </div>
      </div>
    </section>
  );
}

function Persistence() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Dual-tier storage</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl">
          One disk that stays. One sandbox that forgets you.
        </h2>
        <div className="mt-10 grid gap-3 lg:grid-cols-2">
          <article className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
            <div className="flex items-center gap-3">
              <Monitor className="size-4 text-primary" />
              <h3 className="text-sm font-medium">Persistent studio</h3>
            </div>
            <p className="mt-4 text-sm text-muted">
              QEMU domain on an 8G qcow2. TinyCore boots from kernel+initrd with CDE on the ISO. The attached disk
              survives reconnect; you can install to it from the live desktop.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-xs text-muted">
              <li>host-passthrough CPU · 1 vCPU / 512 MiB</li>
              <li>IDE disk · qcow2 · kept on the node</li>
              <li>kernel boot · skips isolinux timeout</li>
            </ul>
          </article>
          <article className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
            <div className="flex items-center gap-3">
              <Shield className="size-4 text-primary" />
              <h3 className="text-sm font-medium">Ephemeral guest</h3>
            </div>
            <p className="mt-4 text-sm text-muted">
              Same KVM path, 2G scratch disk. Session end kills QEMU and unlinks the qcow2. No leftover volume.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-xs text-muted">
              <li>384 MiB · same TinyCore GUI</li>
              <li>disk unlinked on qemu exit</li>
              <li>same e1000 NAT as persistent</li>
            </ul>
          </article>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Cpu, t: "Nested virt", d: "kvm nested=Y. Guests run a real kernel with host CPU passthrough." },
            { icon: Globe, t: "Guest NAT", d: "e1000 on 10.0.2.0/24 user NAT. Outbound internet, no tunnel." },
            { icon: Shield, t: "SSO mapped volumes", d: "Google or X identity binds to a private qcow2. No shared disks." },
          ].map((item) => (
            <article key={item.t} className="rounded-lg bg-card p-5 shadow-[var(--shadow-border)]">
              <item.icon className="size-4 text-primary" />
              <h3 className="mt-3 text-sm font-medium">{item.t}</h3>
              <p className="mt-2 text-sm text-muted">{item.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Acceptance</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight sm:text-4xl">
          Five proofs. One live console.
        </h2>
        <ol className="mt-10 divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
          {[
            ["01", "Hypervisor", "/dev/kvm present. nested=Y. qemu-system-x86_64 with KVM accel."],
            ["02", "Identity", "OIDC handshake. Volume mapped to the verified user id."],
            ["03", "Guest NAT", "e1000 slirp. 10.0.2.15. Outbound internet, no tunnel."],
            ["04", "Teardown", "Ephemeral qcow2 unlinked. Persistent disk kept."],
            ["05", "Stream", "WebSocket 101. RFB 003.008. TinyCore desktop in the canvas."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-4 px-5 py-4 sm:gap-8 sm:px-8">
              <span className="font-mono text-xs text-subtle">{n}</span>
              <div>
                <p className="text-sm font-medium">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Helix · nested cloud desktops</span>
        <span className="font-mono text-xs">local nested KVM</span>
      </div>
    </footer>
  );
}
