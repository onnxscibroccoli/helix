#!/usr/bin/env bash
set -u
LOG_TAG="omnikali-memory-guard"
available_kib=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
swap_free_kib=$(awk '/SwapFree:/ {print $2}' /proc/meminfo)
log() { logger -t "$LOG_TAG" -- "$*"; printf '%s %s\n' "$LOG_TAG" "$*"; }
if [ -z "$available_kib" ] || [ -z "$swap_free_kib" ]; then log "unable to read memory state"; exit 0; fi
if [ "$available_kib" -lt 700000 ] || [ "$swap_free_kib" -lt 300000 ]; then
  log "memory pressure detected: MemAvailable=$available_kib KiB SwapFree=$swap_free_kib KiB"
  for name in omnikali-adb-control omnikali-adb-e1000; do
    while read -r pid; do
      [ -n "$pid" ] || continue
      log "stopping non-primary Android worker name=$name pid=$pid"
      kill "$pid" 2>/dev/null || true
    done < <(pgrep -f "qemu-system.*-name $name" || true)
  done
  sleep 2
  available_kib=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
  swap_free_kib=$(awk '/SwapFree:/ {print $2}' /proc/meminfo)
  log "after containment: MemAvailable=$available_kib KiB SwapFree=$swap_free_kib KiB"
fi
if virsh domstate helix-omnikali 2>/dev/null | grep -qx 'shut off'; then
  if [ "$available_kib" -ge 1200000 ]; then
    log "Kali guest is off and memory headroom is sufficient; starting helix-omnikali"
    virsh start helix-omnikali >/dev/null 2>&1 || log "Kali start failed"
  else
    log "Kali guest is off but headroom is insufficient; refusing automatic start"
  fi
fi
