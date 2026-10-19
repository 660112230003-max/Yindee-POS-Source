import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Utensils,
  ReceiptText,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  ChefHat,
  Bell,
  Clock,
  Printer,
  Calendar,
  History,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

import { ConsoleLayout, bento } from "@/components/console-layout";
import { Modal } from "@/components/modal";
import { ManagerOverrideModal } from "@/components/manager-override-modal";
import { PromptPayBillingSection } from "@/components/promptpay-billing-section";
import { ReceiptPrintArea, type ReceiptData } from "@/components/receipt-print-area";
import {
  baht,
  db,
  fetchOrders,
  fetchTables,
  fetchKitchenTickets,
  fetchServiceCalls,
  fetchCategories,
  fetchMenu,
  isDrinkCategory,
  isDrinkMenuItem,
  resolveServiceCall,
  type Order,
  type RestaurantTable,
  type OrderStatus,
} from "@/lib/restaurant";
import { playNotificationSound } from "@/lib/notification-sound";
import {
  StaffGuard,
  lockStaffSession,
  useStaffAuth,
} from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/order-status")({
  head: () => ({
    meta: [
      { title: "แคชเชียร์ & ตรวจบิล · Restaurant OS" },
      { name: "description", content: "ระบบแคชเชียร์ ตรวจสอบบิลโต๊ะที่กำลังใช้งาน และรับชำระเงิน" },
      { property: "og:title", content: "แคชเชียร์ & ตรวจบิล · Restaurant OS" },
      { property: "og:description", content: "ระบบแคชเชียร์ ตรวจสอบบิลโต๊ะที่กำลังใช้งาน และรับชำระเงิน" },
    ],
  }),
  component: CashierPage,
});

function CashierPage() {
  return (
    <StaffGuard pageTitle="แคชเชียร์">
      <CashierContent />
    </StaffGuard>
  );
}

type ActiveBill = {
  key: string;
  tableId: string | null;
  title: string;
  code: string;
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  totalItemsCount: number;
  openedTime: string;
  hasBillCall: boolean;
  orders: Order[];
  items: Array<{
    id: string;
    menu_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
};

function CashierContent() {
  const qc = useQueryClient();

  // Queries
  const { data: tables = [], refetch: refetchTables } = useQuery({
    queryKey: ["tables"],
    queryFn: fetchTables,
  });
  const { data: orders = [], refetch: refetchOrders, isFetching } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });
  const { data: tickets = [], refetch: refetchTickets } = useQuery({
    queryKey: ["kitchen-tickets"],
    queryFn: fetchKitchenTickets,
  });
  const { data: calls = [], refetch: refetchCalls } = useQuery({
    queryKey: ["service-calls"],
    queryFn: fetchServiceCalls,
    refetchInterval: 3000,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { data: menu = [] } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu,
  });

  // UI state
  const [selectedBill, setSelectedBill] = useState<ActiveBill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [viewTab, setViewTab] = useState<"active" | "takeaway" | "orders" | "history">("active");

  const isDrink = (menuId: string | null | undefined, menuName: string) => {
    const item = menu.find((m) => (menuId && m.id === menuId) || m.name === menuName);
    return isDrinkMenuItem(item || { name: menuName, category_id: null }, categories);
  };

  // Track notified call IDs to prevent duplicate toasts & sounds
  const notifiedCallIdsRef = useRef<Set<string>>(new Set());
  const initialLoadedRef = useRef(false);

  const triggerServiceCallAlert = (callData: any) => {
    qc.invalidateQueries({ queryKey: ["service-calls"] });
    playNotificationSound();
    const msg = callData?.message ?? "";
    const tableId = callData?.table_id;
    const tableCode = callData?.table_code;
    const targetTable = tables.find((t) => t.id === tableId || t.code === tableCode);
    const tableName = targetTable ? `โต๊ะ ${targetTable.code}` : (tableCode ? `โต๊ะ ${tableCode}` : "มีลูกค้า");

    if (msg === "เรียกเช็คบิล" || msg.includes("เช็คบิล")) {
      toast.warning(`🧾 ${tableName} เรียกเช็คบิล!`, {
        description: "ลูกค้ากดเรียกเช็คบิล กรุณาตรวจบิลและคิดเงิน",
        duration: 9000,
      });
    } else {
      toast.info(`🔔 ${tableName} เรียกพนักงาน`, {
        description: msg || "ลูกค้ากดเรียกพนักงาน",
        duration: 6000,
      });
    }
  };

  // Detect newly fetched calls via polling as a guaranteed fallback
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      const now = Date.now();
      calls.forEach((c) => {
        const ageMs = c.created_at ? now - new Date(c.created_at).getTime() : 999999;
        if (!c.resolved && ageMs < 60000) {
          notifiedCallIdsRef.current.add(c.id);
          triggerServiceCallAlert(c);
        } else {
          notifiedCallIdsRef.current.add(c.id);
        }
      });
      return;
    }

    calls.forEach((c) => {
      if (!c.resolved && !notifiedCallIdsRef.current.has(c.id)) {
        notifiedCallIdsRef.current.add(c.id);
        triggerServiceCallAlert(c);
      }
    });
  }, [calls, tables]);

  // Real-time subscriptions
  useEffect(() => {
    const channel = db
      .channel("staff-serving-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        qc.invalidateQueries({ queryKey: ["tables"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "service_calls" }, (payload: any) => {
        if (payload?.new?.id) {
          if (notifiedCallIdsRef.current.has(payload.new.id)) return;
          notifiedCallIdsRef.current.add(payload.new.id);
        }
        triggerServiceCallAlert(payload?.new);
      })
      .on("broadcast", { event: "service_call_alert" }, (payload: any) => {
        const item = payload?.payload?.new || payload?.new;
        if (item?.id) {
          if (notifiedCallIdsRef.current.has(item.id)) return;
          notifiedCallIdsRef.current.add(item.id);
        }
        triggerServiceCallAlert(item);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "service_calls" }, () => {
        qc.invalidateQueries({ queryKey: ["service-calls"] });
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [qc, tables]);

  // Derived data
  const today = new Date().toISOString().slice(0, 10);
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.status !== "completed"),
    [orders]
  );

  const billCalls = useMemo(
    () => calls.filter((c) => c.message === "เรียกเช็คบิล" || c.message.includes("เช็คบิล")),
    [calls]
  );

  // Top Stats (Screenshot 2)
  const occupiedTablesCount = useMemo(
    () => tables.filter((t) => t.status === "occupied").length,
    [tables]
  );
  const newOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.created_at.slice(0, 10) === today &&
          (o.status === "waiting" || o.status === "in_kitchen")
      ).length,
    [orders, today]
  );
  const cookingCount = useMemo(
    () => activeOrders.filter((o) => o.status === "in_kitchen").length,
    [activeOrders]
  );
  const readyToServeCount = useMemo(
    () =>
      tickets.filter(
        (t) => t.status === "done" && t.done_at && t.done_at.slice(0, 10) === today
      ).length,
    [tickets, today]
  );

  // 1. Table Bills List (Dine-in tables with active orders or occupied)
  const tableBillsList = useMemo(() => {
    const list: ActiveBill[] = [];

    tables.forEach((t) => {
      const tableOrders = activeOrders.filter((o) => o.table_id === t.id);
      if (t.status === "occupied" || tableOrders.length > 0) {
        const items = tableOrders.flatMap((o) => o.order_items || []);
        const totalItemsCount = items.reduce((s, it) => s + it.quantity, 0);
        const totalAmount = tableOrders.reduce(
          (s, o) => s + Number(o.final_amount || 0),
          0
        );
        const subtotalAmount = tableOrders.reduce(
          (s, o) => s + Number(o.total_amount || 0),
          0
        );
        const discountAmount = tableOrders.reduce(
          (s, o) => s + Number(o.discount_amount || 0),
          0
        );

        const earliestOrder = tableOrders[tableOrders.length - 1];
        const openedTime = earliestOrder
          ? new Date(earliestOrder.created_at).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";

        const hasBillCall = billCalls.some((c) => c.table_id === t.id);

        list.push({
          key: `table-${t.id}`,
          tableId: t.id,
          title: `โต๊ะ: ${t.code}`,
          code: t.code,
          totalAmount,
          subtotalAmount,
          discountAmount,
          totalItemsCount,
          openedTime,
          hasBillCall,
          orders: tableOrders,
          items,
        });
      }
    });

    return list.sort((a, b) => {
      if (a.hasBillCall && !b.hasBillCall) return -1;
      if (!a.hasBillCall && b.hasBillCall) return 1;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
  }, [tables, activeOrders, billCalls]);

  // 2. Takeaway Bills List (Orders specifically marked as takeaway or without table_id)
  const takeawayBillsList = useMemo(() => {
    const takeawayOrders = activeOrders.filter(
      (o) => o.order_type === "takeaway" || !o.table_id
    );
    const list: ActiveBill[] = [];

    takeawayOrders.forEach((o) => {
      const items = o.order_items || [];
      const totalItemsCount = items.reduce((s, it) => s + it.quantity, 0);
      const openedTime = new Date(o.created_at).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });

      list.push({
        key: `takeaway-${o.id}`,
        tableId: null,
        title: `กลับบ้าน (${o.customer_name || o.order_number.slice(-6)})`,
        code: "Takeaway",
        totalAmount: Number(o.final_amount || 0),
        subtotalAmount: Number(o.total_amount || 0),
        discountAmount: Number(o.discount_amount || 0),
        totalItemsCount,
        openedTime,
        hasBillCall: false,
        orders: [o],
        items,
      });
    });

    return list.sort((a, b) => {
      const dateA = a.orders[0]?.created_at || "";
      const dateB = b.orders[0]?.created_at || "";
      return dateB.localeCompare(dateA);
    });
  }, [activeOrders]);

  // 3. Combined Active Bills (for quick lookup & backward compatibility)
  const activeBillsList = useMemo(
    () => [...tableBillsList, ...takeawayBillsList],
    [tableBillsList, takeawayBillsList]
  );

  // Paid orders today (history)
  const paidOrdersToday = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "completed" && o.created_at.slice(0, 10) === today
      ),
    [orders, today]
  );

  // Open billing modal for a specific bill
  const handleOpenBilling = (bill: ActiveBill) => {
    setSelectedBill(bill);
    setPaymentMethod("");
    setPaymentNote("");
  };

  // Process checkout and table reset (Screenshot 3 & 4)
  const handleCheckoutAndResetTable = async (
    overrideMethod?: string,
    autoPrintReceipt: boolean = true
  ) => {
    if (!selectedBill) return;

    // Check if called directly from click event (ignore event object)
    const finalMethod =
      typeof overrideMethod === "string" && overrideMethod
        ? overrideMethod
        : typeof paymentMethod === "string" && paymentMethod
        ? paymentMethod
        : "";

    if (!finalMethod) {
      toast.error("กรุณาเลือกวิธีชำระเงินก่อนดำเนินการ");
      return;
    }

    if (selectedBill.orders.length === 0 && selectedBill.tableId) {
      // If table is occupied but has no orders, just reset table
      try {
        await db.from("tables").update({ status: "available" }).eq("id", selectedBill.tableId);
        const relatedCalls = calls.filter((c) => c.table_id === selectedBill.tableId);
        for (const c of relatedCalls) await resolveServiceCall(c.id);
        toast.success(`รีเซ็ต ${selectedBill.title} กลับเป็นโต๊ะว่างเรียบร้อยแล้ว`);
        setSelectedBill(null);
        qc.invalidateQueries({ queryKey: ["tables"] });
        qc.invalidateQueries({ queryKey: ["service-calls"] });
      } catch {
        toast.error("รีเซ็ตโต๊ะไม่สำเร็จ");
      }
      return;
    }

    setIsCheckingOut(true);
    try {
      // Prepare receipt data before updating orders & clearing state
      const now = new Date();
      const formattedPaidAt = now.toLocaleString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const receipt: ReceiptData = {
        title: String(selectedBill.title || "บิล"),
        code: String(selectedBill.code || "T01"),
        totalAmount: Number(selectedBill.totalAmount || 0),
        subtotalAmount: Number(selectedBill.subtotalAmount || 0),
        discountAmount: Number(selectedBill.discountAmount || 0),
        paymentMethod: finalMethod,
        paymentNote: paymentNote ? String(paymentNote) : (finalMethod === "transfer" ? "PromptPay Dynamic QR" : undefined),
        items: Array.isArray(selectedBill.items) ? selectedBill.items : [],
        paidAt: formattedPaidAt,
      };
      setReceiptData(receipt);

      // Map to PostgreSQL enum 'cash' | 'transfer' | 'card'
      const dbPaymentMethod: "cash" | "transfer" | "card" =
        finalMethod === "card" ? "card" : finalMethod === "transfer" ? "transfer" : "cash";

      // 1. Mark orders as completed
      for (const order of selectedBill.orders) {
        let updateRes = await db
          .from("orders")
          .update({
            status: "completed" as OrderStatus,
            paid_at: now.toISOString(),
            payment_method: dbPaymentMethod,
          })
          .eq("id", order.id);

        // Graceful fallback if database schema does not have paid_at/payment_method
        if (updateRes.error) {
          console.warn("orders update with payment fields failed, retrying with status only:", updateRes.error);
          updateRes = await db
            .from("orders")
            .update({
              status: "completed" as OrderStatus,
            })
            .eq("id", order.id);
          if (updateRes.error) throw updateRes.error;
        }

        // Record in payments table (best-effort)
        try {
          await db.from("payments").insert({
            order_id: order.id,
            method: dbPaymentMethod,
            amount_due: Number(order.final_amount || 0),
            amount_received: Number(order.final_amount || 0),
            change_amount: 0,
            note: paymentNote ? `[${finalMethod}] ${paymentNote}` : finalMethod,
          });
        } catch (pErr) {
          console.warn("Payment table insertion skipped or optional:", pErr);
        }
      }

      // 2. Reset table to available if it's a table
      if (selectedBill.tableId) {
        await db
          .from("tables")
          .update({ status: "available" })
          .eq("id", selectedBill.tableId);

        // 3. Resolve any active service calls for this table
        const relatedCalls = calls.filter((c) => c.table_id === selectedBill.tableId);
        for (const c of relatedCalls) {
          await resolveServiceCall(c.id);
        }
      }

      toast.success(
        `รับชำระเงิน ${selectedBill.title} สำเร็จ (${baht(selectedBill.totalAmount)}) โต๊ะว่างพร้อมรับลูกค้าใหม่แล้ว`
      );
      setSelectedBill(null);
      setPaymentMethod("");
      setPaymentNote("");

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["service-calls"] });
      qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });

      // Automatically trigger receipt printing safely
      if (autoPrintReceipt) {
        setTimeout(() => {
          try {
            window.print();
          } catch (pErr) {
            console.warn("window.print failed or blocked by browser:", pErr);
          }
        }, 350);
      }
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการบันทึกการชำระเงิน");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const { hasPermission } = useStaffAuth();
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [overrideActionName, setOverrideActionName] = useState("");

  const requirePermission = (permission: string, actionName: string, action: () => void) => {
    if (hasPermission(permission)) {
      action();
    } else {
      setPendingAction(() => action);
      setOverrideActionName(actionName);
      setShowOverrideModal(true);
    }
  };

  const handleVoidBill = async () => {
    if (!selectedBill) return;
    try {
      // 1. Mark orders as cancelled
      for (const order of selectedBill.orders) {
        const { error: orderError } = await db
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", order.id);

        if (orderError) throw orderError;
      }

      // 2. Reset table to available
      if (selectedBill.tableId) {
        await db
          .from("tables")
          .update({ status: "available" })
          .eq("id", selectedBill.tableId);

        // 3. Resolve any active service calls
        const relatedCalls = calls.filter((c) => c.table_id === selectedBill.tableId);
        for (const c of relatedCalls) {
          await resolveServiceCall(c.id);
        }
      }

      toast.success(`ยกเลิกบิล ${selectedBill.title} สำเร็จ`);
      setSelectedBill(null);

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
      qc.invalidateQueries({ queryKey: ["service-calls"] });
      qc.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการยกเลิกบิล");
    }
  };

  return (
    <ConsoleLayout title="แคชเชียร์">
      <div className="space-y-6">
        {/* Top Header matching Screenshot 2 */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <p className="text-xs font-bold tracking-widest text-primary uppercase">
              BILLING &amp; CHECKOUT
            </p>
            <h1 className="text-3xl font-black tracking-tight">แคชเชียร์</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/pos"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-95"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>สั่งออเดอร์ (POS)</span>
            </Link>
            <button
              onClick={() => {
                refetchOrders();
                refetchTables();
                refetchCalls();
                refetchTickets();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:border-primary/40 transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              รีเฟรช
            </button>
            <Link
              to="/admin"
              className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:border-primary/40 transition-colors"
            >
              ผู้ดูแลระบบ
            </Link>
            <button
              onClick={() => lockStaffSession()}
              className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* 4 Stats Cards matching Screenshot 2 */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className={cn(bento, "p-4 flex flex-col justify-between")}>
            <span className="text-xs font-semibold text-muted-foreground">
              โต๊ะที่มีแขกอยู่
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black">{occupiedTablesCount}</span>
              <Utensils className="h-4 w-4 text-muted-foreground opacity-40" />
            </div>
          </div>
          <div className={cn(bento, "p-4 flex flex-col justify-between")}>
            <span className="text-xs font-semibold text-muted-foreground">
              ออเดอร์ใหม่
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black">{newOrdersCount}</span>
              <Bell className="h-4 w-4 text-warning opacity-70" />
            </div>
          </div>
          <div className={cn(bento, "p-4 flex flex-col justify-between")}>
            <span className="text-xs font-semibold text-muted-foreground">
              กำลังทำ
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black">{cookingCount}</span>
              <ChefHat className="h-4 w-4 text-info opacity-70" />
            </div>
          </div>
          <div className={cn(bento, "p-4 flex flex-col justify-between")}>
            <span className="text-xs font-semibold text-muted-foreground">
              พร้อมเสิร์ฟ
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black">{readyToServeCount}</span>
              <CheckCircle2 className="h-4 w-4 text-success opacity-70" />
            </div>
          </div>
        </section>

        {/* Urgent Bill Requests Banner (If any table calls for bill) */}
        {billCalls.length > 0 && (
          <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm animate-bounce">
                <ReceiptText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-emerald-950 dark:text-emerald-100 text-base">
                  ⚡ มีโต๊ะเรียกเช็คบิล {billCalls.length} โต๊ะ!
                </h3>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300">
                  {billCalls
                    .map((c) => {
                      const t = tables.find((tb) => tb.id === c.table_id);
                      return `โต๊ะ ${t?.code ?? "-"}`;
                    })
                    .join(", ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {billCalls.map((c) => {
                const b = activeBillsList.find((item) => item.tableId === c.table_id);
                const t = tables.find((tb) => tb.id === c.table_id);
                if (!b) return null;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleOpenBilling(b)}
                    className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    ตรวจบิล โต๊ะ {t?.code ?? "-"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* View Switcher: Active Tables vs Takeaway vs Orders List vs Paid History */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wider text-primary uppercase">
              {viewTab === "active"
                ? "ACTIVE TABLES"
                : viewTab === "takeaway"
                ? "TAKEAWAY ORDERS"
                : viewTab === "orders"
                ? "ORDER LIST"
                : "COMPLETED BILLS"}
            </p>
            <h2 className="text-xl font-bold tracking-tight">
              {viewTab === "active"
                ? "โต๊ะที่กำลังใช้งาน (ทานที่ร้าน)"
                : viewTab === "takeaway"
                ? "รายการสั่งกลับบ้าน (Takeaway)"
                : viewTab === "orders"
                ? "รายการออเดอร์ทั้งหมด"
                : "ประวัติการชำระเงินวันนี้"}
            </h2>
          </div>

          <div className="flex flex-wrap rounded-xl border border-border bg-card p-1 text-xs font-semibold gap-0.5">
            <button
              onClick={() => setViewTab("active")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-colors",
                viewTab === "active"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              โต๊ะที่กำลังใช้งาน ({tableBillsList.length})
            </button>
            <button
              onClick={() => setViewTab("takeaway")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5",
                viewTab === "takeaway"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>สั่งกลับบ้าน ({takeawayBillsList.length})</span>
            </button>
            <button
              onClick={() => setViewTab("orders")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-colors",
                viewTab === "orders"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              รายการออเดอร์ ({activeOrders.length})
            </button>
            <button
              onClick={() => setViewTab("history")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-colors",
                viewTab === "history"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              ชำระเงินแล้ว ({paidOrdersToday.length})
            </button>
          </div>
        </div>

        {/* SECTION A: ACTIVE DINE-IN TABLES */}
        {viewTab === "active" && (
          tableBillsList.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tableBillsList.map((bill) => (
                <div
                  key={bill.key}
                  className={cn(
                    bento,
                    "p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-bento-lg",
                    bill.hasBillCall &&
                      "border-2 border-emerald-500/50 shadow-emerald-500/10 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        bill.hasBillCall
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 animate-pulse font-bold"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      )}
                    >
                      {bill.hasBillCall ? "เรียกเช็คบิล" : "กำลังรับประทาน"}
                    </span>
                    <span className="text-xl font-black tracking-tight text-foreground">
                      {baht(bill.totalAmount)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black tracking-tight">{bill.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bill.totalItemsCount} รายการ · เปิด {bill.openedTime}
                    </p>
                  </div>

                  {/* Items Preview */}
                  {bill.items.length > 0 && (
                    <div className="space-y-1 py-1 text-xs border-t border-border/40 pt-2 max-h-28 overflow-y-auto">
                      {bill.items.map((it, idx) => {
                        const drink = isDrink(it.id, it.menu_name);
                        return (
                          <div key={idx} className="flex justify-between items-center text-muted-foreground">
                            <span className="truncate flex items-center gap-1">
                              {drink ? "🥤 " : "• "}
                              {it.menu_name}
                              {drink && <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">(เครื่องดื่ม)</span>}
                            </span>
                            <span className="font-semibold ml-2 text-foreground">x{it.quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenBilling(bill)}
                    className={cn(
                      "w-full rounded-xl py-2.5 text-sm font-bold shadow-xs transition-all active:scale-[0.99]",
                      bill.hasBillCall
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 font-black"
                        : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    ตรวจบิล
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn(bento, "p-12 text-center text-muted-foreground")}>
              <Utensils className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-base">ไม่มีโต๊ะที่กำลังใช้งานในขณะนี้</p>
              <p className="text-xs opacity-70 mt-1">
                เมื่อมีลูกค้าสแกนสั่งอาหารหรือเปิดโต๊ะ จะปรากฏที่นี่ทันทีเพื่อรอตรวจบิล
              </p>
            </div>
          )
        )}

        {/* SECTION A.2: TAKEAWAY ORDERS GRID (เฉพาะสั่งกลับบ้าน) */}
        {viewTab === "takeaway" && (
          takeawayBillsList.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {takeawayBillsList.map((bill) => {
                const order = bill.orders[0];
                return (
                  <div
                    key={bill.key}
                    className={cn(
                      bento,
                      "p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-bento-lg border-primary/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-bold flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" />
                        <span>สั่งกลับบ้าน</span>
                      </span>
                      <span className="text-xl font-black tracking-tight text-foreground">
                        {baht(bill.totalAmount)}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-black tracking-tight">
                        {order?.customer_name || "ลูกค้ากลับบ้าน"}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        #{order?.order_number ?? bill.key} · สั่ง {bill.openedTime} น.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        จำนวน {bill.totalItemsCount} รายการ
                      </p>
                    </div>

                    {/* Items Preview */}
                    {bill.items.length > 0 && (
                      <div className="space-y-1 py-1 text-xs border-t border-border/40 pt-2 max-h-28 overflow-y-auto">
                        {bill.items.map((it, idx) => {
                          const drink = isDrink(it.id, it.menu_name);
                          return (
                            <div key={idx} className="flex justify-between items-center text-muted-foreground">
                              <span className="truncate flex items-center gap-1">
                                {drink ? "🥤 " : "• "}
                                {it.menu_name}
                                {drink && (
                                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">
                                    (เครื่องดื่ม)
                                  </span>
                                )}
                              </span>
                              <span className="font-semibold ml-2 text-foreground">x{it.quantity}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {order?.note && (
                      <p className="text-xs text-warning bg-warning/10 p-2 rounded-lg">
                        หมายเหตุ: {order.note}
                      </p>
                    )}

                    <button
                      onClick={() => handleOpenBilling(bill)}
                      className="w-full rounded-xl py-2.5 text-sm font-bold bg-primary text-primary-foreground shadow-glow hover:bg-primary/90 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      <ReceiptText className="h-4 w-4" />
                      <span>ตรวจบิล &amp; คิดเงิน</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={cn(bento, "p-12 text-center text-muted-foreground")}>
              <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
              <p className="font-semibold text-base">ไม่มีรายการสั่งกลับบ้านที่รอชำระเงินในขณะนี้</p>
              <p className="text-xs opacity-70 mt-1">
                เมื่อมีออเดอร์ประเภทกลับบ้านจากหน้า POS จะปรากฏที่นี่ทันทีเพื่อรอคิดเงิน
              </p>
              <div className="mt-4">
                <Link
                  to="/pos"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow hover:bg-primary/90 transition-all"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>เปิดออเดอร์กลับบ้านใหม่ (POS)</span>
                </Link>
              </div>
            </div>
          )
        )}

        {/* SECTION B: ORDER LIST (Individual orders with drink badges) */}
        {viewTab === "orders" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{activeOrders.length} ออเดอร์ที่กำลังดำเนินการ</span>
            </div>
            {activeOrders.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeOrders.map((o) => {
                  const t = tables.find((tb) => tb.id === o.table_id);
                  const isWaiting = o.status === "waiting";
                  const isInKitchen = o.status === "in_kitchen";
                  return (
                    <div key={o.id} className={cn(bento, "p-4 space-y-3 flex flex-col justify-between")}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-base">{o.order_type === "takeaway" ? "กลับบ้าน" : `ทานที่ร้าน · โต๊ะ ${t?.code ?? "-"}`}</p>
                          <p className="text-xs text-muted-foreground font-mono">{o.order_number}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(o.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น. · {o.customer_name || "ลูกค้าทั่วไป"} · {o.customer_count || 1} ท่าน
                          </p>
                        </div>
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-bold",
                          isWaiting ? "bg-warning/15 text-warning border border-warning/30" :
                          isInKitchen ? "bg-info/15 text-info border border-info/30" :
                          "bg-success/15 text-success border border-success/30"
                        )}>
                          {isWaiting ? "รอดำเนินการ" : isInKitchen ? "อยู่ในครัว" : "เสิร์ฟแล้ว"}
                        </span>
                      </div>

                      <div className="space-y-2 border-y border-border/50 py-2 text-xs">
                        {o.order_items?.map((it) => {
                          const drink = isDrink(it.menu_id, it.menu_name);
                          return (
                            <div key={it.id} className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                                  <span>{it.menu_name} × {it.quantity}</span>
                                  {drink && (
                                    <span className="rounded-md bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-bold">
                                      🥤 เครื่องดื่ม (เสิร์ฟได้เลย)
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span className="font-semibold text-foreground shrink-0">{baht(it.subtotal)}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between items-baseline pt-1 text-sm font-bold">
                        <span className="text-muted-foreground">ยอดสุทธิ</span>
                        <span className="text-primary text-base">{baht(o.final_amount)}</span>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            const b = activeBillsList.find((bill) => bill.tableId === o.table_id) || {
                              key: `order-${o.id}`,
                              tableId: o.table_id,
                              title: o.order_type === "takeaway" ? "กลับบ้าน" : `โต๊ะ: ${t?.code ?? "-"}`,
                              code: t?.code ?? "Takeaway",
                              totalAmount: Number(o.final_amount || 0),
                              subtotalAmount: Number(o.total_amount || 0),
                              discountAmount: Number(o.discount_amount || 0),
                              totalItemsCount: o.order_items?.length || 0,
                              openedTime: new Date(o.created_at).toLocaleTimeString("th-TH"),
                              hasBillCall: false,
                              orders: [o],
                              items: o.order_items || [],
                            };
                            handleOpenBilling(b);
                          }}
                          className="w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-95"
                        >
                          ตรวจบิล / เช็คบิล
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={cn(bento, "p-8 text-center text-muted-foreground")}>
                <p className="text-sm">ไม่มีออเดอร์ในขณะนี้</p>
              </div>
            )}
          </div>
        )}

        {/* SECTION C: PAID HISTORY */}
        {viewTab === "history" && (
          <div className="space-y-3">
            {paidOrdersToday.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {paidOrdersToday.map((o) => {
                  const t = tables.find((tb) => tb.id === o.table_id);
                  return (
                    <div key={o.id} className={cn(bento, "p-4 space-y-2")}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">
                            {o.order_type === "takeaway" ? "กลับบ้าน" : `โต๊ะ: ${t?.code ?? "-"}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{o.order_number}</p>
                        </div>
                        <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-bold">
                          ชำระแล้ว
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.order_items?.length} รายการ · เวลา{" "}
                        {new Date(o.created_at).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="flex justify-between items-baseline pt-2 border-t border-border/50 text-sm font-bold">
                        <span>ยอดชำระ</span>
                        <span className="text-primary">{baht(o.final_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={cn(bento, "p-8 text-center text-muted-foreground")}>
                <ReceiptText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ยังไม่มีรายการชำระเงินในวันนี้</p>
              </div>
            )}
          </div>
        )}

        {/* Footer Credit */}
        <p className="pt-8 text-center text-[11px] text-muted-foreground/60">
          Created by CodingPhuc Creativities - alphepbiuct.ch@gmail.com
        </p>
      </div>

      {/* BILLING MODAL (Screenshots 3 & 4) */}
      {selectedBill && (
        <Modal
          title={
            <div>
              <p className="text-[11px] font-bold tracking-widest text-primary uppercase">
                BILLING
              </p>
              <p className="text-xl font-black">{selectedBill.title}</p>
            </div>
          }
          onClose={() => setSelectedBill(null)}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Ordered Items List (Screenshot 3) */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
              {selectedBill.items.length > 0 ? (
                selectedBill.items.map((it, idx) => (
                  <div
                    key={`${it.id}-${idx}`}
                    className="flex justify-between items-start gap-3 border-b border-border/40 pb-2.5 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                        <span>{it.menu_name} × {it.quantity}</span>
                        {isDrink(null, it.menu_name) && (
                          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                            🥤 เครื่องดื่ม
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {baht(it.unit_price)} ต่อรายการ
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary shrink-0">
                      {baht(it.subtotal)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  ไม่มีรายการอาหารค้างชำระ
                </div>
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2 border-y border-border/60 py-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>ยอดก่อนส่วนลด</span>
                <span className="font-medium text-foreground">
                  {baht(selectedBill.subtotalAmount)}
                </span>
              </div>
              {selectedBill.discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <span>ส่วนลด</span>
                  <span className="font-medium">-{baht(selectedBill.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 text-base font-black">
                <span>ยอดรวมทั้งหมด</span>
                <span className="text-2xl font-black text-primary">
                  {baht(selectedBill.totalAmount)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector (Screenshot 4) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">วิธีชำระเงิน</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">เลือกวิธีชำระ</option>
                <option value="cash">เงินสด</option>
                <option value="transfer">โอนเงิน</option>
                <option value="card">บัตร</option>
                <option value="other">อื่น ๆ</option>
              </select>
            </div>

            {/* Dynamic PromptPay QR Code Section (Triggered on "โอนเงิน") */}
            {paymentMethod === "transfer" && (
              <PromptPayBillingSection
                amount={selectedBill.totalAmount}
                table={selectedBill.code}
                isProcessingCheckout={isCheckingOut}
                onPaymentSuccess={async (mode) => {
                  if (mode === "auto") {
                    toast.success("ตรวจพบการชำระเงินผ่าน PromptPay เรียบร้อยแล้ว!");
                  }
                  await handleCheckoutAndResetTable("transfer", true);
                }}
              />
            )}

            {/* Reference Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">เลขอ้างอิง (ถ้ามี)</label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="ระบุเลขอ้างอิงสลิป / รหัสธุรกรรม..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Bottom Action Button (Screenshot 3 & 4) */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => requirePermission("void_bill", "ยกเลิกบิล", handleVoidBill)}
                disabled={isCheckingOut}
                className="w-1/3 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3.5 text-sm font-bold text-rose-600 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
              >
                ยกเลิกบิล
              </button>
              <button
                onClick={() => handleCheckoutAndResetTable()}
                disabled={isCheckingOut}
                className="w-2/3 rounded-xl bg-primary px-4 py-3.5 text-base font-bold text-primary-foreground shadow-glow hover:bg-primary/95 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isCheckingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...
                  </span>
                ) : (
                  "รับชำระเงิน"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manager Override Modal */}
      <ManagerOverrideModal
        isOpen={showOverrideModal}
        onClose={() => {
          setShowOverrideModal(false);
          setPendingAction(null);
        }}
        actionName={overrideActionName}
        onSuccess={() => {
          if (pendingAction) {
            pendingAction();
          }
        }}
      />

      {/* Hidden Thermal Slip Print Area (Activated on window.print()) */}
      <ReceiptPrintArea data={receiptData} />
    </ConsoleLayout>
  );
}
