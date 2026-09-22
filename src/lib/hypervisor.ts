import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { WorkspaceKind } from "@/lib/workspace-types";

const HYPER = process.env.HELIX_HYPERVISOR_URL ?? "http://127.0.0.1:8090";

export type HypervisorCapabilities = {
  hostname: string;
  kvm: boolean;
  nested: string;
  qemu: boolean;
  qemuVersion: string | null;
  iso: boolean;
  kernel: boolean;
  guests: number;
  node: string;
  region: string;
  guestNet: string;
  guestIp: string;
  nic: string;
  guestOs: string;
};

export type HypervisorDomain = {
  id: string;
  kind: string;
  status: "booting" | "running" | "stopped" | string;
  vncPort: number;
  ticket: string;
  logs: string[];
  startedAt: string | null;
  memoryMb: number;
  vcpus: number;
  diskGb: number;
  guestIp: string;
  streamPath: string;
};

const OFFLINE_CAPS: HypervisorCapabilities & { error?: string } = {
  hostname: "offline",
  kvm: false,
  nested: "n/a",
  qemu: false,
  qemuVersion: null,
  iso: false,
  kernel: false,
  guests: 0,
  node: "hypervisor-node-local",
  region: "unreachable",
  guestNet: "10.0.2.0/24",
  guestIp: "10.0.2.15",
  nic: "e1000 user-nat",
  guestOs: "TinyCorePure64-15.0",
};

async function hyper<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HYPER}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = { error: `hypervisor ${res.status}` };
  }
  if (!res.ok) {
    const err = body as { error?: string };
    throw new Error(err.error || `hypervisor ${res.status}`);
  }
  return body as T;
}

export async function fetchCapabilities(): Promise<HypervisorCapabilities & { error?: string }> {
  try {
    return await hyper<HypervisorCapabilities>("/capabilities");
  } catch (e) {
    return {
      ...OFFLINE_CAPS,
      error: e instanceof Error ? e.message : "hypervisor unreachable",
    };
  }
}

export const getHypervisorStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => fetchCapabilities());

export const listDomains = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    try {
      return await hyper<HypervisorDomain[]>("/domains");
    } catch {
      return [] as HypervisorDomain[];
    }
  });

export const startDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string; kind: WorkspaceKind }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from workspaces where id = ${data.id} and user_id = ${context.userId} limit 1
    `;
    if (!owned[0]) throw new Error("Domain not found");
    const domain = await hyper<HypervisorDomain>("/domains", {
      method: "POST",
      body: JSON.stringify({ id: data.id, kind: data.kind }),
    });
    await sql`
      update workspaces
      set status = 'running',
          last_boot_at = now(),
          session_count = session_count + 1,
          stream_ticket = ${domain.ticket},
          vnc_port = ${domain.vncPort},
          ipv4 = ${domain.guestIp}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    await sql`
      insert into workspace_events (workspace_id, user_id, kind, detail)
      values (${data.id}, ${context.userId}, 'boot', ${`KVM RFB ${domain.vncPort} NAT ${domain.guestIp}`})
    `;
    return domain;
  });

export const getDomain = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from workspaces where id = ${data.id} and user_id = ${context.userId} limit 1
    `;
    if (!owned[0]) return null;
    try {
      return await hyper<HypervisorDomain>(`/domains/${data.id}`);
    } catch {
      return null;
    }
  });

export const stopDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string; kind: string }>`
      select id, kind from workspaces where id = ${data.id} and user_id = ${context.userId} limit 1
    `;
    if (!owned[0]) return { ok: false as const };
    try {
      await hyper(`/domains/${data.id}`, { method: "DELETE" });
    } catch {
      /* domain already gone */
    }
    await sql`
      update workspaces set status = 'stopped'
      where id = ${data.id} and user_id = ${context.userId}
    `;
    await sql`
      insert into workspace_events (workspace_id, user_id, kind, detail)
      values (${data.id}, ${context.userId}, 'stop', 'Session ended')
    `;
    return { ok: true as const, kind: owned[0].kind };
  });
