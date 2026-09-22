import { Link, Outlet } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/console", label: "Deploy", exact: true },
  { to: "/console/fleet", label: "Fleet", exact: false },
  { to: "/console/storage", label: "Storage", exact: false },
  { to: "/console/validate", label: "Proofs", exact: false },
] as const;

export function ConsoleShell() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return (
      <div className="min-h-dvh bg-background">
        <SiteNav />
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Control plane</p>
            <h1 className="mt-1 text-2xl font-medium tracking-tight">Console</h1>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.exact }}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center rounded-sm px-3 text-sm text-muted hover:text-foreground",
                )}
                activeProps={{ className: "text-foreground bg-elevated" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
