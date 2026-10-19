import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Lock,
  TrendingUp,
  Wallet,
  ShoppingBag,
  UtensilsCrossed,
  BarChart3,
  Armchair,
  Tags,
  Settings as SettingsIcon,
  CalendarDays,
} from "lucide-react";

import { ConsoleLayout, bento } from "@/components/console-layout";
import { TablesPanel } from "@/components/admin/tables-panel";
import { MenuPanel } from "@/components/admin/menu-panel";
import { PromotionsPanel } from "@/components/admin/promotions-panel";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { StaffPanel } from "@/components/admin/staff-panel";
import { ExportReportModal } from "@/components/admin/export-report-modal";
import { baht, fetchMenu, fetchOrders, fetchTables, fetchSettings } from "@/lib/restaurant";
import { StaffGuard } from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

type AdminSearch = {
  tab?: "overview" | "tables" | "menu" | "promotions" | "staff" | "settings";
};

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    tab: (search["tab"] as AdminSearch["tab"]) || "overview",
  }),
  head: () => ({
    meta: [
      { title: "Admin Dashboard · Restaurant OS" },
      { name: "description", content: "แดชบอร์ดผู้บริหาร: ยอดขายรวม จำนวนออเดอร์ เมนูขายดี และรายงานตามประเภทออเดอร์" },
      { property: "og:title", content: "Admin Dashboard · Restaurant OS" },
      { property: "og:description", content: "แดชบอร์ดผู้บริหาร: ยอดขายรวม จำนวนออเดอร์ เมนูขายดี และรายงานตามประเภทออเดอร์" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const search = Route.useSearch();
  return (
    <StaffGuard pageTitle="Admin Dashboard · Restaurant OS">
      <AdminConsole initialTab={search.tab ?? "overview"} />
    </StaffGuard>
  );
}

const TABS = [
  { key: "overview", label: "Overview & Sales", sub: "สรุปยอดขาย", icon: BarChart3 },
  { key: "tables", label: "จัดการโต๊ะ & QR", sub: "Table & QR", icon: Armchair },
  { key: "menu", label: "จัดการเมนู", sub: "Menu & Category", icon: UtensilsCrossed },
  { key: "promotions", label: "โปรโมชั่น", sub: "Promotions", icon: Tags },
  { key: "staff", label: "พนักงาน", sub: "บัญชีพนักงาน", icon: Lock },
  { key: "settings", label: "ตั้งค่าร้าน", sub: "Store Config", icon: SettingsIcon },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function AdminConsole({ initialTab = "overview" }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  return (
    <ConsoleLayout title="Admin Panel">
      <div className={cn(bento, "mb-5 flex gap-1 overflow-x-auto p-1.5")}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-all",
                active
                  ? "bg-primary font-semibold text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "overview" && <Dashboard />}
      {tab === "tables" && <TablesPanel />}
      {tab === "menu" && <MenuPanel />}
      {tab === "promotions" && <PromotionsPanel />}
      {tab === "staff" && <StaffPanel />}
      {tab === "settings" && <SettingsPanel />}
    </ConsoleLayout>
  );
}

function Dashboard() {
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  const paid = orders.filter((o) => o.status !== "cancelled");
  const revenue = paid.reduce((s, o) => s + Number(o.final_amount), 0);
  const dineIn = paid
    .filter((o) => o.order_type === "dine_in")
    .reduce((s, o) => s + Number(o.final_amount), 0);
  const takeaway = revenue - dineIn;

  const bestSellers = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    paid.forEach((o) =>
      (o.order_items ?? []).forEach((it) => {
        const baseName = (it.menu_name || "").split("(")[0]?.trim() || it.menu_name;
        const prev = map.get(baseName) ?? { name: baseName, qty: 0, revenue: 0 };
        map.set(baseName, {
          name: baseName,
          qty: prev.qty + it.quantity,
          revenue: prev.revenue + Number(it.subtotal),
        });
      }),
    );
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [paid]);

  const pct = (v: number) => (revenue > 0 ? Math.round((v / revenue) * 100) : 0);

  return (
    <div>
      {/* 1-Week Sales Header & Export Report */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">ภาพรวมยอดขายย้อนหลัง 1 สัปดาห์</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground">สรุปยอดขาย ออเดอร์ และเมนูยอดนิยมของร้านยินดีหมูกรอบ</p>
          </div>
        </div>

        <ExportReportModal
          orders={orders}
          tables={tables}
          storeName={settings?.store_name || "ยินดีหมูกรอบ"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          icon={Wallet}
          label="ยอดขายรวม"
          value={baht(revenue)}
          tone="primary"
          hint={`${paid.length} บิล`}
        />
        <Metric
          icon={ShoppingBag}
          label="จำนวนออเดอร์"
          value={String(orders.length)}
          tone="info"
          hint={`ยกเลิก ${orders.length - paid.length} รายการ`}
        />
        <Metric
          icon={UtensilsCrossed}
          label="เมนูพร้อมขาย"
          value={String(menu.filter((m) => m.status === "available").length)}
          tone="success"
          hint={`ทั้งหมด ${menu.length} เมนู`}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className={cn(bento, "overflow-x-auto p-5")}>
          <h2 className="mb-3 text-base font-bold">เมนูขายดี</h2>
          <table className="w-full min-w-[420px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">อันดับ</th>
                <th className="p-2">เมนู</th>
                <th className="p-2 text-right">จำนวน</th>
                <th className="p-2 text-right">ยอดขาย</th>
              </tr>
            </thead>
            <tbody>
              {bestSellers.map((b, i) => (
                <tr key={b.name} className="border-b border-border/60 last:border-0">
                  <td className="p-2 font-bold text-primary">#{i + 1}</td>
                  <td className="p-2">{b.name}</td>
                  <td className="p-2 text-right">{b.qty}</td>
                  <td className="p-2 text-right font-semibold">{baht(b.revenue)}</td>
                </tr>
              ))}
              {bestSellers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    ยังไม่มีข้อมูลการขาย
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className={cn(bento, "space-y-4 p-5")}>
          <h2 className="text-base font-bold">รายงานตามประเภทออเดอร์</h2>
          <Bar label="ทานที่ร้าน" value={baht(dineIn)} percent={pct(dineIn)} tone="primary" />
          <Bar label="กลับบ้าน" value={baht(takeaway)} percent={pct(takeaway)} tone="success" />
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  tone: "primary" | "info" | "success";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <article className={cn(bento, "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5")}>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-2xl font-bold">{value}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <TrendingUp className="h-3 w-3" /> {hint}
        </p>
      </div>
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", toneCls)}>
        <Icon className="h-5 w-5" />
      </div>
    </article>
  );
}

function Bar({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: string;
  percent: number;
  tone: "primary" | "success";
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">
          {value} ({percent}%)
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-success")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
