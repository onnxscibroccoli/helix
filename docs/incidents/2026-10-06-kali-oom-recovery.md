# Incident: Kali host OOM storm and guest recovery

Date: 2026-10-06 UTC / 2026-10-07 UTC
Host: EC2 i-03b6a82d46271d9cd (helix-chatgpt-remote-desktop)
Instance type: c7i-flex.large
Severity: SEV-1 workstation availability

## Impact

The Helix host exhausted physical memory and swap. The Linux OOM killer repeatedly terminated QEMU processes, including the persistent `helix-omnikali` Kali guest. Desktop Commander also became unreliable while the host was under pressure.

## Evidence

At recovery time the host had 3.7 GiB RAM and 2 GiB swap. Swap was fully consumed. The kernel recorded repeated global OOM events.

The OOM log explicitly shows QEMU processes being killed:

- 2026-10-06 17:39 UTC: QEMU for the first Helix machine was killed.
- 2026-10-07 01:06 UTC: Android QEMU processes were killed repeatedly.
- 2026-10-07 01:07 UTC: another QEMU/vCPU process was killed.
- 2026-10-07 01:23 UTC: QEMU for `helix-omnikali` was killed again.

The host was simultaneously running three Cloud Android QEMU processes:

- `omnikali-cloud-android`
- `omnikali-adb-control`
- `omnikali-adb-e1000`

Each was configured with 1 GiB guest memory. The Kali libvirt guest was configured for 2 GiB.

This exceeded the safe memory envelope of a 4 GiB KVM host once QEMU RSS and host services were included.

## Root cause

Primary root cause: **resource overcommit on a 4 GiB KVM host**.

The immediate trigger was running multiple Android QEMU workers concurrently with the persistent Kali QEMU guest. The OOM killer then terminated guest processes. The resulting guest/service recovery behavior made the failure appear as a reboot/restart loop.

This was not primarily a Kali guest filesystem or libvirt corruption problem.

## Recovery

1. Verified SSM remained available even while Desktop Commander timed out.
2. Collected kernel OOM evidence, memory, swap, disk, process and libvirt state through SSM.
3. Confirmed `helix-omnikali` was shut off after the OOM kills.
4. Terminated the two non-primary duplicate Android QEMU workers:
   - `omnikali-adb-control`
   - `omnikali-adb-e1000`
5. Preserved the primary `omnikali-cloud-android` QEMU process.
6. Started `helix-omnikali` with libvirt.
7. Confirmed the Kali guest returned to `running`.
8. Installed and enabled the `omnikali-memory-guard.timer` systemd timer. It evaluates host memory every 30 seconds and terminates only the two known non-primary Android workers during memory pressure. It never targets the primary Android worker or Kali QEMU.
9. Confirmed the host remained up after recovery.

## Preventive controls

The host now has a memory-pressure guard:

`/usr/local/sbin/omnikali-memory-guard`

with systemd units:

- `omnikali-memory-guard.service`
- `omnikali-memory-guard.timer`

Guard policy:

- Detect pressure at less than 700 MiB MemAvailable or less than 300 MiB SwapFree.
- Remove known duplicate Android QEMU workers before allowing an OOM storm to develop.
- Never kill `omnikali-cloud-android`.
- Never kill `helix-omnikali`.
- Automatically start Kali only when it is stopped and at least 1.2 GiB host memory is available.

## Capacity decision

The current 4 GiB host is below the safe architectural envelope for simultaneous persistent Kali plus multiple Cloud Android VMs.

The preferred long-term fix is to move the host to a larger memory class. AWS documents `c7i-flex.large` as 4 GiB and `c7i-flex.xlarge` as 8 GiB. The resize requires an EC2 stop/start, so it should be scheduled separately rather than performed during recovery.

Until that migration, the system must treat the primary Cloud Android VM plus Kali as the supported concurrent workload and reject/stop additional Android QEMU workers when memory pressure develops.

## Follow-up

- Keep the memory guard enabled.
- Add host memory/Swap alarms to production observability.
- Add a launch-time admission check to Cloud Android worker creation so a second/third QEMU cannot be started blindly.
- Migrate the host to at least 8 GiB RAM during a planned maintenance window.
- Preserve this incident as the reference for future OOM/reboot-loop diagnosis.
