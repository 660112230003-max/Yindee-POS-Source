import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChefHat, Flame, PackageCheck, RefreshCw, Radio, Bell, BellOff, Utensils, UtensilsCrossed, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { playNotificationSound, isSoundEnabled, toggleSound } from "@/lib/notification-sound";
import { ConsoleLayout, bento } from "@/components/console-layout";
import {
  baht,
  db,
  fetchKitchenTickets,
  fetchOrders,
  fetchTables,
  fetchCategories,
  fetchMenu,
  isDrinkCategory,
  isDrinkMenuItem,
  setKitchenTicketStatus,
  KITCHEN_STATUS_LABEL,
  type KitchenTicket,
  type KitchenTicketStatus,
} from "@/lib/restaurant";
import { StaffGuard } from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "ห้องครัว · รายการส่งครัว | Restaurant OS" },
      { name: "description", content: "จอครัวแสดงใบสั่งแบบ 3 คอลัมน์" },
    ],
  }),
  component: KitchenPage,
});

function KitchenPage() {
  return (
    <StaffGuard pageTitle="ห้องครัว · จอสั่งครัว">
      <KitchenContent />
    </StaffGuard>
  );
}

function KitchenContent() {
  const qc = useQueryClient();
  const { data: tickets = [], refetch: refetchTickets, isFetching: fetchingTickets } = useQuery({
    queryKey: ["kitchen-tickets"],
    queryFn: fetchKitchenTickets,
  });
  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: orders = [], refetch: refetchOrders, isFetching: fetchingOrders } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });

  // Sound toggle state
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  // Track previous ticket count for new-order detection
  const prevCountRef = useRef(tickets.filter((t) => t.status === "sent").length);

  // Timer: force re-render every 30s to update elapsed times
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const channels = db
      .channel("kitchen-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets" }, (payload: { eventType: string }) => {
        qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
        if (payload.eventType === "INSERT" && soundOn) {
          playNotificationSound();
          toast("🔔 ออเดอร์ใหม่เข้าครัว!", { duration: 3000 });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => {
      db.removeChannel(channels);
    };
  }, [qc, soundOn]);

  useEffect(() => {
    const sentCount = tickets.filter((t) => t.status === "sent").length;
    if (sentCount > prevCountRef.current && soundOn) {
      playNotificationSound();
    }
    prevCountRef.current = sentCount;
  }, [tickets, soundOn]);

  const advance = async (ticket: KitchenTicket, status: KitchenTicketStatus, message: string) => {
    try {
      await setKitchenTicketStatus(ticket.id, status);
      toast.success(message);
      qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    } catch {
      toast.error("อัปเดตใบสั่งครัวไม่สำเร็จ");
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  
  // Filter active tickets: exclude cancelled tickets and tickets whose orders are served/completed/cancelled
  const activeTickets = tickets.filter((t) => {
    if (t.status === "cancelled") return false;
    const order = orders.find(o => o.id === t.order_id);
    if (order && ["served", "completed", "cancelled"].includes(order.status)) return false;
    // For "done", keep only today's. 
    return t.status !== "done" || (t.sent_at && t.sent_at.slice(0, 10) === today);
  });

  const occupiedTables = tables.filter((t) => t.status === "occupied").length;
  
  const newOrders = activeTickets.filter(t => t.status === "sent" || t.status === "received");
  const cookingOrders = activeTickets.filter(t => t.status === "cooking");
  const readyOrders = activeTickets.filter(t => t.status === "done");

  const isFetching = fetchingTickets || fetchingOrders;

  return (
    <ConsoleLayout
      title="หน้าครัว (Kitchen Display System)"
      actions={
        <div className="flex gap-2">
          <button
            onClick={() => setSoundOn(toggleSound())}
            title={soundOn ? "ปิดเสียงแจ้งเตือน" : "เปิดเสียงแจ้งเตือน"}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
              soundOn
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {soundOn ? "เสียงเปิด" : "เสียงปิด"}
          </button>
          <button
            onClick={() => { refetchTickets(); refetchOrders(); }}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:border-primary/40"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> รีเฟรช
          </button>
        </div>
      }
    >
      <div className="grid gap-6">
        {/* STATS BAR */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <StatCard label="โต๊ะที่มีลูกค้า" value={occupiedTables} icon={Utensils} tone="muted" />
          <StatCard label="ออเดอร์ใหม่" value={newOrders.length} icon={Bell} tone="warning" />
          <StatCard label="กำลังทำ" value={cookingOrders.length} icon={Flame} tone="primary" />
          <StatCard label="พร้อมเสิร์ฟ" value={readyOrders.length} icon={CheckCircle2} tone="success" />
        </section>

        {/* 3 COLUMNS */}
        <div className="grid gap-4 md:grid-cols-3">
          
          {/* Column 1: New Orders */}
          <section className="space-y-3">
            <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-warning/15 text-warning flex items-center justify-between">
              <span>ออเดอร์ใหม่</span>
              <span>{newOrders.length}</span>
            </div>
            {newOrders.length === 0 ? (
              <EmptyState message="ยังไม่มีออเดอร์" />
            ) : (
              newOrders.map(t => (
                <TicketCard key={t.id} ticket={t} tables={tables} categories={categories} menu={menu} onAdvance={(status, msg) => advance(t, status, msg)} />
              ))
            )}
          </section>

          {/* Column 2: Cooking */}
          <section className="space-y-3">
            <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-primary/10 text-primary flex items-center justify-between">
              <span>กำลังทำ</span>
              <span>{cookingOrders.length}</span>
            </div>
            {cookingOrders.length === 0 ? (
              <EmptyState message="ไม่มีออเดอร์ที่กำลังทำ" />
            ) : (
              cookingOrders.map(t => (
                <TicketCard key={t.id} ticket={t} tables={tables} categories={categories} menu={menu} onAdvance={(status, msg) => advance(t, status, msg)} />
              ))
            )}
          </section>

          {/* Column 3: Ready to Serve */}
          <section className="space-y-3">
            <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-success/15 text-success flex items-center justify-between">
              <span>พร้อมเสิร์ฟ</span>
              <span>{readyOrders.length}</span>
            </div>
            {readyOrders.length === 0 ? (
              <EmptyState message="ไม่มีอาหารรอเสิร์ฟ" />
            ) : (
              readyOrders.map(t => (
                <TicketCard key={t.id} ticket={t} tables={tables} categories={categories} menu={menu} onAdvance={(status, msg) => advance(t, status, msg)} />
              ))
            )}
          </section>

        </div>
      </div>
    </ConsoleLayout>
  );
}

/* ── UI Helpers ────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, tone }: { label: string, value: number, icon: any, tone: "muted"|"warning"|"primary"|"success" }) {
  const tones = {
    muted: "text-foreground bg-muted",
    warning: "text-warning bg-warning/15",
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/15",
  };
  return (
    <div className={cn(bento, "p-4 flex flex-col gap-2")}>
      <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
         <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="flex justify-between items-end">
        <span className="text-2xl font-black">{value}</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className={cn(bento, "p-8 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-3")}>
      <CheckCircle2 className="h-8 w-8 opacity-20" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function TicketCard({
  ticket,
  tables,
  categories = [],
  menu = [],
  onAdvance,
}: {
  ticket: KitchenTicket;
  tables: any[];
  categories?: any[];
  menu?: any[];
  onAdvance: (status: KitchenTicketStatus, msg: string) => void;
}) {
  const order = ticket.orders;
  const table = tables.find((tb) => tb.id === order?.table_id);
  const isTakeaway = order?.order_type === "takeaway";

  const isDrink = (menuId: string | null | undefined, menuName: string) => {
    const item = menu.find((m) => (menuId && m.id === menuId) || m.name === menuName);
    return isDrinkMenuItem(item || { name: menuName, category_id: null }, categories);
  };

  const kitchenItems = (order?.order_items ?? []).filter(
    (it) => !isDrink(it.menu_id, it.menu_name)
  );

  return (
    <article className={cn(bento, "space-y-3 p-4", elapsedClass(ticket.sent_at))}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">
            {isTakeaway ? "กลับบ้าน" : `โต๊ะ ${table?.code ?? "-"}`}
          </p>
          <p className="text-xs text-muted-foreground">
             {order?.order_number ?? "-"} · {new Date(ticket.sent_at).toLocaleTimeString("th-TH")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {ticket.status !== "done" && <ElapsedBadge sentAt={ticket.sent_at} />}
        </div>
      </div>

      <ul className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
        {kitchenItems.map((it) => (
          <li key={it.id} className="flex gap-2">
            <span className="font-semibold text-primary">×{it.quantity}</span>
            <span className="min-w-0 truncate">{it.menu_name}</span>
          </li>
        ))}
        {kitchenItems.length === 0 && (
          <li className="text-muted-foreground">ไม่มีรายการอาหารสำหรับครัว</li>
        )}
      </ul>

      {ticket.note && <p className="text-xs text-warning bg-warning/10 p-2 rounded-lg">หมายเหตุ: {ticket.note}</p>}

      <div className="pt-2 border-t border-border/50">
        {(ticket.status === "sent" || ticket.status === "received") && (
          <button
            onClick={() => onAdvance("cooking", "เริ่มทำแล้ว")}
            className="w-full py-2.5 rounded-xl bg-warning/20 text-warning font-bold text-sm hover:bg-warning hover:text-warning-foreground transition-colors flex items-center justify-center gap-2"
          >
            <Flame className="h-4 w-4" /> เริ่มทำ (Cooking)
          </button>
        )}
        {ticket.status === "cooking" && (
          <button
            onClick={() => onAdvance("done", "อาหารพร้อมเสิร์ฟ")}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground shadow-glow font-bold text-sm hover:bg-primary/90 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <PackageCheck className="h-4 w-4" /> ปรุงเสร็จ (Done)
          </button>
        )}
        {ticket.status === "done" && (
          <div className="w-full py-2.5 rounded-xl bg-success/15 text-success font-bold text-sm text-center flex items-center justify-center gap-2">
            <Utensils className="h-4 w-4" /> รอพนักงานมารับ
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Elapsed time helpers ──────────────────────────────────── */

function getElapsedMinutes(sentAt: string): number {
  return Math.floor((Date.now() - new Date(sentAt).getTime()) / 60_000);
}

function elapsedClass(sentAt: string): string {
  const mins = getElapsedMinutes(sentAt);
  if (mins >= 20) return "ring-2 ring-primary/50 animate-pulse";
  if (mins >= 10) return "ring-2 ring-warning/50";
  return "";
}

function ElapsedBadge({ sentAt }: { sentAt: string }) {
  const mins = getElapsedMinutes(sentAt);
  const urgent = mins >= 20;
  const warning = mins >= 10;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums flex items-center gap-1",
        urgent
          ? "bg-primary/15 text-primary border border-primary/30"
          : warning
            ? "bg-warning/15 text-warning border border-warning/30"
            : "bg-muted text-muted-foreground border border-border",
      )}
    >
      <Clock className="h-3 w-3" /> {mins} นาที
    </span>
  );
}
