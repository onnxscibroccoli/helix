import { useEffect, useState } from "react";

const LINKS = [
  "SessionEnding received",
  "virsh destroy guest domain",
  "virsh undefine --nvram",
  "umount /mnt/ephemeral/$GUEST",
  "rm -rf /mnt/ephemeral/$GUEST",
  "ip link delete tap-$GUEST",
  "scratch unlinked · zero residual",
];

export function TeardownSequence({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (count >= LINKS.length) {
      const t = window.setTimeout(onDone, 500);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setCount((c) => c + 1), 160);
    return () => window.clearTimeout(t);
  }, [count, onDone]);

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-8 font-mono text-sm text-primary sm:px-10">
      <p className="text-xs uppercase tracking-widest text-muted">Ephemeral teardown</p>
      <pre className="mt-6 whitespace-pre-wrap leading-relaxed">
        {LINKS.slice(0, count).join("\n")}
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
      </pre>
    </div>
  );
}
