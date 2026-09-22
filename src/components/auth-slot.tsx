import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthSlot({ compact = false }: { compact?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <Skeleton className={compact ? "h-8 w-8 rounded-full" : "h-8 w-28 rounded-full"} />;
  }
  if (user) return <UserButton />;
  return (
    <Link
      to="/login"
      className="inline-flex h-11 items-center rounded-sm px-3 text-sm font-medium text-primary hover:opacity-80"
    >
      Sign in
    </Link>
  );
}
