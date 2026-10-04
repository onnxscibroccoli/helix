# Production CPU Exhaustion Recovery 2026-10-04

Status: RECOVERED

## Incident

The production Helix host `i-03b6a82d46271d9cd` became unreachable through CloudFront while EC2 remained running.

AWS CloudWatch showed sustained CPU utilization of approximately 99.7%. SSM subsequently reported `ConnectionLost`.

The instance was not replaced. The existing Elastic IP and persistent EBS volumes were preserved.

## Recovery

1. EC2 reboot was attempted first.
2. Reboot did not clear the condition. CPU remained approximately 99.7% and SSM remained disconnected.
3. The existing instance was force-stopped, then started again.
4. SSM returned online after boot.
5. A live host process and memory snapshot was collected before changing application workloads.
6. Paperclip was identified as a non-primary CPU and memory consumer and was stopped.
7. Paperclip was disabled so it would not automatically return on the next reboot.
8. Helix gateway, nginx, libvirt, VNC, noVNC, the EBS volume agent, and the Kali VM remained running.
9. Public validation from the OCI workstation returned HTTP 200 for:
   - `/health`
   - `/auth/login`
   - `/novnc/vnc.html`

## Evidence

Immediately after recovery:

- Host memory: 3.7 GiB total
- Host memory available: approximately 2.2 GiB before Paperclip shutdown
- Swap: 2 GiB, essentially unused
- QEMU for `helix-omnikali`: approximately 93% CPU immediately after boot
- Paperclip: approximately 38% CPU and 412 MiB RSS
- Paperclip service cgroup: approximately 550 MiB
- QEMU RSS: approximately 1.7 GiB
- Kali guest processes were not runaway: the guest process sample showed XFCE and supporting processes generally below 1% CPU.
- After Paperclip shutdown, QEMU settled to approximately 23.5% CPU in the observed sample.
- Host load settled to approximately 1.91 on the 2-thread instance.
- Available memory was approximately 990 MiB.
- All primary Helix services checked active.
- `helix-omnikali` remained in `running` state.

## Root cause assessment

The immediate availability failure was host resource exhaustion. The strongest confirmed contributor was the combination of:

1. A very small production host with only one physical core / two threads.
2. A 2-vCPU Kali QEMU guest consuming substantial host CPU and approximately 2 GiB of assigned guest memory.
3. Paperclip starting concurrently and consuming substantial CPU and memory.

The evidence does not support blaming a runaway process inside Kali. The guest process snapshot was normal while QEMU itself was consuming the host CPU.

This incident also confirms that Paperclip is not safe to co-reside with the primary remote-desktop workload on this host at its current resource size.

## Temporary containment

Paperclip is intentionally stopped and disabled:

```
systemctl stop paperclip.service
systemctl disable paperclip.service
```

This is a containment action, not a permanent architectural decision.

Do not re-enable Paperclip on this production host until CPU and memory isolation or a larger host has been implemented and verified.

## Follow-up

- Keep the existing Kali VM and persistent workspace intact.
- Measure the production host continuously during normal desktop use.
- Evaluate moving the production desktop to the canonical larger Helix instance class rather than continuing to run the nested KVM desktop on a one-core host.
- Keep prototype/control-plane workloads such as Paperclip off the production desktop host.
- Continue the OCI workstation as the development/control substrate.
- Keep Cloud Android on an x86 nested-virtualization worker rather than attempting to place the x86 Android VM on the OCI ARM A1 workstation.

## Evidence boundary

This document records the live recovery performed on 2026-10-04. It does not claim that the long-term capacity architecture is solved. The primary public service is recovered, while host sizing and workload isolation remain follow-up work.
