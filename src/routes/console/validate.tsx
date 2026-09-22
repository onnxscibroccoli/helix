import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { runValidation } from "@/lib/workspaces";
import type { ValidationResult } from "@/lib/workspace-types";

export const Route = createFileRoute("/console/validate")({ component: ValidatePage });

function ValidatePage() {
  const [results, setResults] = useState<ValidationResult[] | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    setRunning(true);
    try {
      const rows = await runValidation();
      setResults(rows);
    } catch {
      setResults([]);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-sm text-muted">
          The validation agent asserts nested KVM, the OIDC handshake, kernel swap with canary integrity, ephemeral
          teardown, and the browser stream.
        </p>
        <Button variant="outline" disabled={running} onClick={() => void load()}>
          {running ? "Running…" : "Re-run proofs"}
        </Button>
      </div>
      <ol className="grid gap-3">
        {results === null
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          : results.map((r, i) => (
              <Card key={r.id} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</p>
                    <h2 className="mt-1 text-sm font-medium">{r.title}</h2>
                  </div>
                  <Badge tone={r.status === "pass" ? "ok" : r.status === "ready" ? "live" : "warn"}>
                    {r.status === "pass" ? "pass" : r.status === "ready" ? "ready" : "open"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted">{r.objective}</p>
                <p className="mt-3 font-mono text-xs text-foreground">{r.proof}</p>
                <p className="mt-2 text-sm text-muted">{r.detail}</p>
              </Card>
            ))}
      </ol>
    </div>
  );
}
