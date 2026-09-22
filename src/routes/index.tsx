import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, HardDrive, Shield, Terminal } from "lucide-react";
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
        A Linux machine that survives the kernel.
      </h1>
      <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
        Nested KVM. Kasm WebSocket stream. Google or X OIDC. A real QEMU guest on this node — RFB over WSS, not a
        painted window manager.
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
          ["Volume", "200 GB durable"],
          ["Stream", "Kasm / RFB / WSS"],
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
            { t: "Ingress", d: "TLS 1.3 terminator. Authenticated WebSocket to the orchestrator." },
            { t: "Control plane", d: "Session lock, volume map, RBAC from the verified identity." },
            { t: "Hypervisor", d: "Ubuntu 24.04 with nested=Y. libvirt domains, OVMF, virtio." },
            { t: "Guest", d: "Persistent QEMU VM or tmpfs sandbox. Isolated TAP, no host path." },
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
            {["Client", "OIDC", "Orchestrator", "libvirt", "Guest VM"].map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm">{step}</span>
              </li>
            ))}
          </ol>
          <pre className="mt-8 overflow-x-auto font-mono text-xs leading-relaxed text-muted">
            {`Client ── HTTPS/WSS ── Ingress ── Kasm control plane
                              │
                              ├─ PostgreSQL  session + volume map
                              └─ Hypervisor  nested KVM
                                    ├─ Persistent  /dev/vda  OCI block
                                    └─ Ephemeral   tmpfs     destroyed on logout`}
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
          One volume that keeps your kernel. One sandbox that forgets you.
        </h2>
        <div className="mt-10 grid gap-3 lg:grid-cols-2">
          <article className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
            <div className="flex items-center gap-3">
              <HardDrive className="size-4 text-primary" />
              <h3 className="text-sm font-medium">Persistent studio</h3>
            </div>
            <p className="mt-4 text-sm text-muted">
              Full QEMU domain on a 200 GB high-performance block volume. Compile a custom kernel, rewrite GRUB, reboot.
              Home directory and canary hash survive.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-xs text-muted">
              <li>host-passthrough CPU · 4 vCPU / 8 GiB</li>
              <li>virtio disk · cache=none · io=native</li>
              <li>OVMF UEFI · independent uname -r</li>
            </ul>
          </article>
          <article className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
            <div className="flex items-center gap-3">
              <Shield className="size-4 text-primary" />
              <h3 className="text-sm font-medium">Ephemeral guest</h3>
            </div>
            <p className="mt-4 text-sm text-muted">
              Memory-backed domain. No host block devices, no guest-to-guest bridge, no leftover TAP. Session end
              destroys the domain, unmounts scratch, unlinks the path.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-xs text-muted">
              <li>tmpfs / local NVMe scratch</li>
              <li>ebtables FORWARD tap+ → DROP</li>
              <li>virsh undefine --nvram on teardown</li>
            </ul>
          </article>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Cpu, t: "Nested virt", d: "kvm_intel nested=1. Guests run their own kernels without touching the host." },
            { icon: Terminal, t: "In-guest control", d: "Swap kernels from the studio terminal. The canary file is the proof." },
            { icon: Shield, t: "SSO mapped volumes", d: "Google or X identity binds to a private namespace. No shared disks." },
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
            ["01", "Hypervisor", "Nested KVM enabled, /dev/kvm present, OVMF loaded."],
            ["02", "Identity", "OIDC handshake, scoped JWT, volume mapped to the email claim."],
            ["03", "Kernel swap", "New uname -r after reboot. Canary SHA-256 unchanged."],
            ["04", "Teardown", "Ephemeral domain gone. TAP deleted. Scratch unlinked."],
            ["05", "Stream", "WebSocket 101. Desktop frame pipeline attached in the browser."],
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
        <span className="font-mono text-xs">us-ashburn-1</span>
      </div>
    </footer>
  );
}
