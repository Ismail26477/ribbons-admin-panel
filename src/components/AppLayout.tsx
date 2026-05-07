import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  PhoneCall,
  Phone,
  Users,
  Package,
  Factory,
  Receipt,
  Banknote,
  FileText,
  ClipboardList,
  Package2,
  Star,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wrench,
  ListChecks,
  Navigation,
  TrendingUp,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TopHeader } from "@/components/TopHeader";
import { PageHeaderProvider } from "@/contexts/PageHeaderContext";
import { cn } from "@/lib/utils";

type Role = "admin" | "manager" | "accountant" | "technician";
type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: readonly Role[] | null };
type NavSection = { section: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    section: "Operations",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: null },
      { to: "/complaints", label: "Complaints", icon: PhoneCall, roles: null },
      { to: "/ivrs-logs", label: "IVRS Logs", icon: Phone, roles: ["admin", "manager"] },
      { to: "/assignment-rules", label: "Assignment Rules", icon: ListChecks, roles: ["admin", "manager"] },
      { to: "/technicians", label: "Technicians", icon: Users, roles: ["admin", "manager"] },
      { to: "/tracking", label: "Live Tracking", icon: Navigation, roles: ["admin", "manager", "technician"] },
      { to: "/performance", label: "Performance", icon: TrendingUp, roles: ["admin", "manager"] },
      { to: "/amc", label: "AMC Contracts", icon: CalendarClock, roles: ["admin", "manager"] },
      { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "manager"] },
      { to: "/factories", label: "Factories", icon: Factory, roles: ["admin", "manager"] },
    ],
  },
  {
    section: "Finance",
    items: [
      { to: "/expenses", label: "Expenses", icon: Receipt, roles: ["admin", "accountant"] },
      { to: "/payroll", label: "Payroll", icon: Banknote, roles: ["admin", "accountant"] },
      { to: "/quotations", label: "Quotations", icon: ClipboardList, roles: ["admin", "manager", "accountant"] },
      { to: "/purchase-orders", label: "Purchase Orders", icon: Package2, roles: ["admin", "manager", "accountant"] },
      { to: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "manager", "accountant"] },
      { to: "/feedback", label: "Customer Feedback", icon: Star, roles: ["admin", "manager"] },
    ],
  },
  {
    section: "System",
    items: [{ to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] }],
  },
];

const RAIL_KEY = "ribbons.sidebar.rail";

const loadRail = (): boolean => {
  try {
    const raw = localStorage.getItem(RAIL_KEY);
    return raw ? JSON.parse(raw) : false;
  } catch {
    return false;
  }
};

export const AppLayout = () => {
  const { user, roles, signOut, hasRole } = useAuth();
  const location = useLocation();
  const [rail, setRail] = useState<boolean>(loadRail);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleRail = () => {
    setRail((p) => {
      try { localStorage.setItem(RAIL_KEY, JSON.stringify(!p)); } catch { /* ignore */ }
      return !p;
    });
  };

  const renderSidebarBody = (isMobile: boolean) => {
    const collapsed = !isMobile && rail;
    return (
      <>
        <div className={cn("flex items-center gap-3 border-b border-sidebar-border/60 px-5 py-[18px]", collapsed && "justify-center px-2")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-hero text-white shadow-glow ring-1 ring-white/20">
            <Wrench className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">Ribbons Infotech</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/70">Admin Panel</div>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            type="button"
            onClick={toggleRail}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3 top-7 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-soft transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            {rail ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}

        <nav className={cn("no-scrollbar flex-1 space-y-4 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
          {NAV_SECTIONS.map((sec) => {
            const visible = sec.items.filter((i) => !i.roles || hasRole(...i.roles));
            if (visible.length === 0) return null;

            if (collapsed) {
              return (
                <div key={sec.section} className="space-y-0.5">
                  {visible.map((i) => {
                    const isActive =
                      i.to === "/" ? location.pathname === "/" : location.pathname.startsWith(i.to);
                    return (
                      <Tooltip key={i.to}>
                        <TooltipTrigger asChild>
                          <NavLink
                            to={i.to}
                            end={i.to === "/"}
                            className={cn(
                              "group relative flex h-10 w-full items-center justify-center rounded-lg transition-all duration-200",
                              isActive
                                ? "gradient-primary text-white shadow-glow"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white hover:scale-105",
                            )}
                          >
                            <i.icon className="h-4 w-4" />
                          </NavLink>
                        </TooltipTrigger>
                        <TooltipContent side="right">{i.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <div className="mx-3 my-2 h-px bg-sidebar-border/60" />
                </div>
              );
            }

            return (
              <div key={sec.section}>
                <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                  {sec.section}
                </div>
                <div className="space-y-0.5">
                  {visible.map((i) => (
                    <NavLink
                      key={i.to}
                      to={i.to}
                      end={i.to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex min-h-[44px] items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "gradient-primary text-white shadow-glow"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white hover:translate-x-0.5",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/80" />
                          )}
                          <i.icon className={cn("h-4 w-4 transition-transform", !isActive && "group-hover:scale-110")} />
                          <span>{i.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={cn("border-t border-sidebar-border pb-safe", collapsed ? "p-2" : "p-3")}>
          {!collapsed && (
            <div className="mb-2 px-3 text-xs">
              <div className="truncate font-medium text-white">{user?.email}</div>
              <div className="text-sidebar-foreground">{roles.join(", ") || "no role"}</div>
            </div>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          )}
        </div>
      </>
    );
  };

  const sidebarBg = {
    backgroundImage:
      "radial-gradient(at 0% 0%, hsl(250 70% 25% / 0.6) 0px, transparent 50%), radial-gradient(at 100% 100%, hsl(330 70% 25% / 0.4) 0px, transparent 50%)",
  };

  return (
    <TooltipProvider delayDuration={150}>
      <PageHeaderProvider>
      <div className="flex h-screen w-full bg-background">
        <aside
          className={cn(
            "relative hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out md:flex",
            rail ? "w-16" : "w-64",
          )}
          style={sidebarBg}
        >
          {renderSidebarBody(false)}
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-64 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-white"
            style={sidebarBg}
          >
            <div className="relative flex h-full flex-col">
              {renderSidebarBody(true)}
            </div>
          </SheetContent>
        </Sheet>

        <main id="app-main" className="no-scrollbar flex flex-1 flex-col overflow-y-auto overflow-x-hidden gradient-mesh">
          <TopHeader onToggleSidebar={() => setMobileOpen(true)} />

          <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
      </PageHeaderProvider>
    </TooltipProvider>
  );
};
