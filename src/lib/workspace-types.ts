export type WorkspaceKind = "persistent" | "ephemeral";
export type WorkspaceStatus = "stopped" | "running" | "provisioning" | "rebooting";

export type Workspace = {
  id: string;
  userId: string;
  name: string;
  kind: WorkspaceKind;
  kernel: string;
  status: WorkspaceStatus;
  vcpus: number;
  memoryGb: number;
  volumeGb: number;
  hostNode: string;
  ipv4: string | null;
  canaryHash: string | null;
  createdAt: string;
  lastBootAt: string | null;
  sessionCount: number;
  streamTicket: string | null;
  vncPort: number | null;
};

export type WorkspaceEvent = {
  id: number;
  workspaceId: string;
  kind: string;
  detail: string | null;
  createdAt: string;
};

export type ValidationResult = {
  id: string;
  title: string;
  objective: string;
  status: "pass" | "ready" | "warn";
  proof: string;
  detail: string;
};

export const DEFAULT_KERNEL = "TinyCorePure64-15.0";
export const GUEST_IP = "10.0.2.15";
export const GUEST_NET = "10.0.2.0/24";
