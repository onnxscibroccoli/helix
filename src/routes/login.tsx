import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { HelixMark } from "@/components/helix-mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();

  if (!isPending && user) return <Navigate to="/console" />;

  return (
    <main className="helix-wash relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2 text-sm font-medium">
          <HelixMark className="size-7" />
          Helix
        </Link>
        <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Google or X. Your persistent volume is mapped from the verified identity.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {isPending ? (
            <>
              <Skeleton className="h-11 w-full rounded-sm" />
              <Skeleton className="h-11 w-full rounded-sm" />
            </>
          ) : user ? null : authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/console" })}
              >
                Continue with {p.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>
      </div>
    </main>
  );
}
