import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  ShoppingBag,
  Store,
  BellRing,
  ChefHat,
  ReceiptText,
  LayoutDashboard,
  ShieldCheck,
  ArrowLeftRight,
} from "lucide-react";
import type { ReactNode } from "react";

import { fetchSettings } from "@/lib/restaurant";
import {
  lockStaffSession,
  useStaffAuth,
  ROLES_CONFIG,
  type StaffRole,
} from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  sub: string;
  icon: typeof LayoutDashboard;
  roles: StaffRole[];
}

const ALL_NAV: NavItem[] = [
  {
    to: "/all-in-one",
    label: "Front Ops",
    sub: "รวมงานหน้าร้าน",
    icon: LayoutDashboard,
    roles: ["overview", "admin"],
  },
  {
    to: "/pos",
    label: "Order",
    sub: "รับออเดอร์ (POS)",
    icon: ShoppingBag,
    roles: ["cashier", "overview", "admin"],
  },
  {
    to: "/order-status",
    label: "Cashier",
    sub: "แคชเชียร์ & ตรวจบิล",
    icon: ReceiptText,
    roles: ["cashier", "overview", "admin"],
  },
  {
    to: "/staff",
    label: "Staff",
    sub: "พนักงานเสิร์ฟ",
    icon: BellRing,
    roles: ["staff", "overview", "admin"],
  },
  {
    to: "/kitchen",
    label: "Kitchen",
    sub: "จอครัว / ใบสั่งครัว",
    icon: ChefHat,
    roles: ["kitchen", "overview", "admin"],
  },
  {
    to: "/admin",
    label: "Admin Panel",
    sub: "Dashboard ผู้บริหาร",
    icon: Store,
    roles: ["admin"],
  },
];

export function PanelShell({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="truncate text-lg font-bold tracking-tight">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function ConsoleLayout({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const { role } = useStaffAuth();

  // Filter navigation items strictly based on role
  const navItems = ALL_NAV.filter((item) => item.roles.includes(role));
  const currentRoleMeta = ROLES_CONFIG[role] ?? ROLES_CONFIG.admin;

  const RoleIcon =
    role === "kitchen"
      ? ChefHat
      : role === "staff"
        ? BellRing
        : role === "cashier"
          ? ReceiptText
          : role === "overview"
            ? LayoutDashboard
            : ShieldCheck;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        {/* Brand header */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow overflow-hidden">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <RoleIcon className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight">
              {settings?.store_name || settings?.system_name || "Restaurant OS"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">{currentRoleMeta.title}</p>
          </div>
        </div>

        {/* Dynamic navigation filtered by role */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-primary/15 font-semibold text-primary-foreground shadow-[inset_3px_0_0_0_var(--primary)]"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon
                  className={cn("h-4.5 w-4.5 shrink-0", active ? "text-primary" : "opacity-80")}
                />
                <span className="min-w-0">
                  <span className="block truncate leading-tight">{item.label}</span>
                  <span className="block truncate text-[11px] text-sidebar-foreground/45">
                    {item.sub}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar role footer with Switch Role and Logout */}
        <div className="border-t border-sidebar-border p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-sidebar-accent px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                <RoleIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{currentRoleMeta.title}</p>
                <p className="truncate text-[11px] text-sidebar-foreground/60">{currentRoleMeta.sub}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/"
                aria-label="สลับบทบาท"
                title="สลับบทบาทผู้ใช้งาน"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-primary/20 hover:text-primary"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                aria-label="ออกจากระบบ"
                title="ออกจากระบบ / ล็อกหน้าจอ"
                onClick={() => lockStaffSession()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
              <span className="hidden rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary sm:inline-block">
                {currentRoleMeta.title}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {settings?.store_name ?? "Restaurant OS"} · {settings?.tagline ?? ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
              title="สลับบทบาท"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">สลับบทบาท</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6">{children}</div>

        {/* Mobile bottom navigation */}
        <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border bg-sidebar px-2 py-2 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[10px]",
                pathname === item.to
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-sidebar-foreground/70",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          <Link
            to="/"
            className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] text-sidebar-foreground/70 hover:text-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" />
            สลับบทบาท
          </Link>
        </nav>
      </div>
    </div>
  );
}


export const bento = "rounded-2xl border border-border bg-card shadow-bento";
