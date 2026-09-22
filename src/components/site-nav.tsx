import { Link } from "@tanstack/react-router";
import { AuthSlot } from "@/components/auth-slot";
import { HelixMark } from "@/components/helix-mark";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium tracking-tight">
          <HelixMark className="size-6" />
          Helix
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            to="/console"
            className="hidden h-11 items-center px-3 text-sm text-muted hover:text-foreground sm:inline-flex"
          >
            Console
          </Link>
          <AuthSlot />
        </nav>
      </div>
    </header>
  );
}
