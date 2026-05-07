import { useEffect, useState } from "react";
import { Search, Menu, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { usePageHeaderState } from "@/contexts/PageHeaderContext";
import { cn } from "@/lib/utils";

interface Props {
  onToggleSidebar?: () => void;
}

export const TopHeader = ({ onToggleSidebar }: Props) => {
  const { user, roles } = useAuth();
  const { header } = usePageHeaderState();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const main = document.getElementById("app-main");
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 4);
    main.addEventListener("scroll", onScroll);
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const primaryRole = roles[0] ?? "user";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex min-h-[56px] flex-wrap items-center gap-2 border-b border-border/60 glass px-3 py-2 transition-shadow md:min-h-[72px] md:gap-3 md:px-6 md:py-2.5",
        scrolled && "shadow-soft",
      )}
    >
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="min-w-0 flex-1">
        {header.title && (
          <h1 className="truncate text-base font-bold leading-tight tracking-tight md:text-2xl text-gradient-primary">
            {header.title}
          </h1>
        )}
      </div>

      {/* Desktop search */}
      <div className="relative hidden lg:block w-full max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search anything…"
          className="h-10 rounded-full border-border/60 bg-muted/60 pl-9 pr-14 text-sm focus-visible:bg-card"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
          ⌘K
        </kbd>
      </div>

      {/* Mobile search toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 lg:hidden"
        onClick={() => setSearchOpen((v) => !v)}
        aria-label="Toggle search"
      >
        {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
      </Button>

      <NotificationBell />

      <div className="ml-1 flex items-center gap-2 border-l border-border/60 pl-2 sm:pl-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white shadow-soft">
          {(user?.email ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="max-w-[160px] truncate text-sm font-medium">{user?.email}</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium capitalize bg-accent text-accent-foreground">
            {primaryRole}
          </Badge>
        </div>
      </div>

      {searchOpen && (
        <div className="relative w-full lg:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search anything…"
            className="h-10 rounded-full border-border/60 bg-muted/60 pl-9 pr-3 text-sm focus-visible:bg-card"
          />
        </div>
      )}
    </header>
  );
};
