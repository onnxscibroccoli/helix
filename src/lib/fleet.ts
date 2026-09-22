export type HypervisorNode = {
  id: string;
  name: string;
  shape: string;
  ocpus: number;
  memoryGb: number;
  nested: boolean;
  region: string;
  state: "RUNNING";
  kvm: "Y";
  guests: number;
  cpuPct: number;
  memPct: number;
};

export const FLEET: HypervisorNode[] = [
  {
    id: "node-01",
    name: "hypervisor-node-01",
    shape: "VM.Standard3.Flex",
    ocpus: 8,
    memoryGb: 64,
    nested: true,
    region: "us-ashburn-1",
    state: "RUNNING",
    kvm: "Y",
    guests: 3,
    cpuPct: 41,
    memPct: 58,
  },
  {
    id: "node-02",
    name: "hypervisor-node-02",
    shape: "VM.Standard3.Flex",
    ocpus: 8,
    memoryGb: 64,
    nested: true,
    region: "us-ashburn-1",
    state: "RUNNING",
    kvm: "Y",
    guests: 2,
    cpuPct: 27,
    memPct: 44,
  },
];

export const NETWORK = {
  publicCidr: "10.0.1.0/24",
  computeCidr: "10.0.2.0/24",
  bridgeCidr: "192.168.122.0/24",
  gateway: "192.168.122.1",
};
