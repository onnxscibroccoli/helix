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

export type WorkspaceFile = {
  id: number;
  workspaceId: string;
  path: string;
  content: string;
  isDir: boolean;
  updatedAt: string;
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

export const DEFAULT_KERNEL = "6.8.0-47-generic";

export const AVAILABLE_KERNELS = [
  {
    id: "6.8.0-47-generic",
    label: "Ubuntu 24.04 LTS",
    note: "Stock generic kernel shipped with the image.",
  },
  {
    id: "6.11.0-9-generic",
    label: "HWE 24.04",
    note: "Hardware enablement stack. Newer drivers, same userspace.",
  },
  {
    id: "6.6.52-helix-custom",
    label: "Helix custom",
    note: "In-guest compiled kernel with nested virt and virtio baked in.",
  },
] as const;
