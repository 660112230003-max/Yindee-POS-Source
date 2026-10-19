import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  Search,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  QrCode,
  ChefHat,
  CheckCircle2,
  Loader2,
  Tag,
  LogOut,
  ClipboardList,
  ReceiptText,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { StaffGuard } from "@/lib/staff-auth";

import { Modal } from "@/components/modal";
import { FoodItemDetailModal, type FoodItemSelection, isKabKhaoItem } from "@/components/food-item-detail-modal";
import { playNotificationSound } from "@/lib/notification-sound";
import {
  baht,
  createOrder,
  db,
  fetchCategories,
  fetchMenu,
  fetchTables,
  fetchServiceCalls,
  fetchSettings,
  type MenuItem,
  type CartLine,
} from "@/lib/restaurant";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Yindee Moo Krob POS · รับออเดอร์" },
      {
        name: "description",
        content: "หน้าจอรับออเดอร์สำหรับร้านอาหาร พร้อมเมนูและส่งรายการเข้าครัว",
      },
      { property: "og:title", content: "Yindee Moo Krob POS · รับออเดอร์" },
      {
        property: "og:description",
        content: "หน้าจอรับออเดอร์สำหรับร้านอาหาร พร้อมเมนูและส่งรายการเข้าครัว",
      },
    ],
  }),
  component: PosRoute,
});

function PosRoute() {
  return (
    <StaffGuard pageTitle="Yindee Moo Krob POS · รับออเดอร์">
      <PosPage />
    </StaffGuard>
  );
}

/* ─── Category emoji map ──────────────────────────────────────────── */
const CAT_EMOJI: Record<string, string> = {
  all: "🍽️",
  popular: "⭐",
  CAT_RICE: "🍲",
  CAT_DISH: "🍲",
  CAT_DRINK: "🥤",
  CAT_DESSERT: "🥗",
  CAT_SIDE: "🥗",
};

const DISCOUNTS = [
  { label: "ไม่มีส่วนลด", value: 0 },
  { label: "ส่วนลด 10%", value: 10 },
  { label: "โปรวันเกิด 15%", value: 15 },
  { label: "ลดพิเศษ 20%", value: 20 },
];

/* ─── Image placeholder gradient ─────────────────────────────────── */
const PLACEHOLDER_GRADIENTS = [
  "from-rose-200 to-orange-200",
  "from-amber-200 to-yellow-200",
  "from-orange-200 to-red-200",
  "from-red-200 to-rose-300",
  "from-yellow-200 to-amber-300",
];
function getPlaceholderGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_GRADIENTS[h % PLACEHOLDER_GRADIENTS.length];
}

/* ─── Main Page ───────────────────────────────────────────────────── */
function PosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const { data: calls = [] } = useQuery({
    queryKey: ["service-calls"],
    queryFn: fetchServiceCalls,
    refetchInterval: 3000,
  });

  const billCalls = useMemo(
    () => calls.filter((c) => !c.resolved && (c.message === "เรียกเช็คบิล" || c.message.includes("เช็คบิล"))),
    [calls]
  );

  // Track notified call IDs to prevent duplicate alerts
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
        description: "ลูกค้ากดเรียกเช็คบิลจากมือถือ กรุณาตรวจบิลและคิดเงิน",
        duration: 9000,
        action: {
          label: "ไปหน้าตรวจบิล",
          onClick: () => navigate({ to: "/order-status" }),
        },
      });
    } else {
      toast.info(`🔔 ${tableName} เรียกพนักงาน`, {
        description: msg || "ลูกค้ากดเรียกพนักงาน",
        duration: 6000,
      });
    }
  };

  // Detect newly fetched calls via 3s polling fallback
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

  // Realtime subscription for service calls
  useEffect(() => {
    const channel = db
      .channel("staff-serving-live")
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

  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customer, setCustomer] = useState("");
  const [tableId, setTableId] = useState("");
  const [count, setCount] = useState(1);
  const [discountPct, setDiscountPct] = useState(0);
  const [saving, setSaving] = useState(false);
  const [qrModalTable, setQrModalTable] = useState<{ id: string; code: string; name: string } | null>(null);
  const [qrModalImg, setQrModalImg] = useState<string>("");
  const [cartOpen, setCartOpen] = useState(false); // mobile drawer
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);

  // ── Single Dish category detection ──────────────────────────────
  const singleDishCategory = useMemo(() => {
    return categories.find(
      (c) =>
        c.name.includes("อาหารจานเดียว") ||
        c.name.includes("จานเดียว") ||
        c.code === "CAT_RICE" ||
        c.id === "c2",
    );
  }, [categories]);

  const isSingleDishItem = (item: MenuItem) => {
    if (singleDishCategory && item.category_id === singleDishCategory.id) return true;
    if (item.category_id === "c2") return true;
    const cat = categories.find((c) => c.id === item.category_id);
    if (
      cat &&
      (cat.name.includes("อาหารจานเดียว") ||
        cat.name.includes("จานเดียว") ||
        cat.code === "CAT_RICE")
    ) {
      return true;
    }
    if (activeCat === singleDishCategory?.id || (singleDishCategory && activeCat === "c2")) {
      return true;
    }
    return false;
  };

  const isKabKhaoCategoryItem = (item: MenuItem | null) => {
    if (!item) return false;
    if (isKabKhaoItem(item)) return true;
    const cat = categories.find((c) => c.id === item.category_id);
    if (
      cat &&
      (cat.name.includes("กับข้าว") ||
        cat.code === "CAT_DISH" ||
        cat.id === "c3" ||
        cat.id === "99fbb89e-e8f7-49ca-b622-542b30b3627a")
    ) {
      return true;
    }
    return false;
  };

  const isNoteOnlyItem = (item: MenuItem | null) => {
    if (!item) return false;
    // อาหารจานเดียว และ กับข้าว ไม่ใช่ note-only (มีตัวเลือกเพิ่มความอร่อย)
    if (isSingleDishItem(item) || isKabKhaoCategoryItem(item)) {
      return false;
    }
    return true;
  };

  // ── Real-time: table status updates ──────────────────────────────
  useEffect(() => {
    if (!qc) return;
    const channel = db
      .channel("pos-realtime-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tables" }, () => {
        qc.invalidateQueries({ queryKey: ["tables"] });
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [qc]);

  const filtered = useMemo(
    () =>
      menu.filter(
        (m) =>
          (activeCat === "all" ||
            (activeCat === "popular" ? m.is_popular : m.category_id === activeCat)) &&
          (search.trim() === "" ||
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.code.toLowerCase().includes(search.toLowerCase())),
      ),
    [menu, activeCat, search],
  );

  const lines = useMemo(
    () => Object.values(cart).filter((l) => l.qty > 0),
    [cart],
  );

  const totalItems = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + (l.unitPrice ?? l.item.price) * l.qty, 0);
  const discount = (subtotal * discountPct) / 100;
  const total = subtotal - discount;

  const getItemTotalQty = (itemId: string) => {
    return Object.values(cart)
      .filter((l) => l.item.id === itemId)
      .reduce((sum, l) => sum + l.qty, 0);
  };

  const handleAddToCartSelection = (selection: FoodItemSelection) => {
    if (!selection.itemId) return;
    const targetItem = menu.find((m) => m.id === selection.itemId);
    if (!targetItem) return;

    const lineKey = [
      targetItem.id,
      selection.selectedPortion?.id || "portion-regular",
      selection.selectedSpice?.id || "default",
      (selection.selectedAddOns || []).map((a) => a.id).sort().join(","),
      (selection.note || "").trim(),
    ].join("::");

    setCart((prev) => {
      const existing = prev[lineKey];
      const newQty = (existing?.qty ?? 0) + selection.quantity;
      return {
        ...prev,
        [lineKey]: {
          id: lineKey,
          item: targetItem,
          qty: newQty,
          unitPrice: selection.unitPrice,
          selectedPortion: selection.selectedPortion,
          selectedSpice: selection.selectedSpice,
          selectedAddOns: selection.selectedAddOns,
          note: selection.note,
          summaryText: selection.summaryText,
        },
      };
    });

    toast.success(`เพิ่ม ${targetItem.name} ลงตะกร้าแล้ว`);
  };

  const setRegularItemQty = (item: MenuItem, delta: number) => {
    if (item.status === "out_of_stock") {
      toast.error(`${item.name} หมดแล้ว`);
      return;
    }
    const lineKey = item.id;
    setCart((prev) => {
      const existing = prev[lineKey];
      const nextQty = Math.max(0, (existing?.qty ?? 0) + delta);
      const copy = { ...prev };
      if (nextQty === 0) {
        delete copy[lineKey];
      } else {
        copy[lineKey] = {
          id: lineKey,
          item,
          qty: nextQty,
          unitPrice: item.price,
        };
      }
      return copy;
    });
    if (delta > 0) toast.success(`เพิ่ม ${item.name} ลงตะกร้า`);
  };

  const updateCartLineQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[lineId];
      if (!existing) return prev;
      const nextQty = Math.max(0, existing.qty + delta);
      const copy = { ...prev };
      if (nextQty === 0) {
        delete copy[lineId];
      } else {
        copy[lineId] = { ...existing, qty: nextQty };
      }
      return copy;
    });
  };

  const handleCardMinus = (item: MenuItem) => {
    const matchedLines = Object.values(cart).filter((l) => l.item.id === item.id);
    if (matchedLines.length === 0) return;
    const targetLine = matchedLines[matchedLines.length - 1];
    if (targetLine && targetLine.id) {
      updateCartLineQty(targetLine.id, -1);
    }
  };

  const confirm = async () => {
    if (lines.length === 0) {
      toast.error("ยังไม่มีรายการในตะกร้า");
      return;
    }
    setSaving(true);
    try {
      const order = await createOrder({
        lines,
        tableId: tableId || null,
        orderType: tableId ? "dine_in" : "takeaway",
        customerName: customer,
        customerCount: count,
        discountAmount: discount,
      });
      toast.success(`ส่งรายการเข้าครัวเรียบร้อยแล้ว · ${order.order_number}`);
      setCart({});
      setCustomer("");
      setTableId("");
      setCount(1);
      setDiscountPct(0);
      setCartOpen(false);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["tables"] });
    } catch {
      toast.error("บันทึกคำสั่งซื้อไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* ── Top header bar ─────────────────────────────────────────── */}
      <header className="z-20 shrink-0 border-b border-border bg-card px-4 py-3 shadow-bento sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow overflow-hidden">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ChefHat className="h-4.5 w-4.5" />
              )}
            </div>
            <div className="hidden sm:block">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {settings?.store_name || "Yindee Moo Krob"}
              </p>
              <p className="text-xs text-muted-foreground">
                {settings?.system_name ? `${settings.system_name} POS` : "POS System"}
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="pos-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเมนูอาหาร..."
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_oklch(0.57_0.22_28_/_0.12)]"
            />
          </div>

          {/* Table picker */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              id="pos-table-select"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">🥡 Take Away</option>
              {tables
                .filter((t) => t.status !== "disabled")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    🪑 {t.code}
                    {t.status === "occupied" ? " · มีลูกค้า" : " · ว่าง"}
                  </option>
                ))}
            </select>
            {tableId && (
              <button
                type="button"
                id="pos-qr-btn"
                onClick={async () => {
                  const target = tables.find((t) => t.id === tableId);
                  if (!target) return;
                  const savedBase = typeof window !== "undefined" ? localStorage.getItem("pos_table_qr_base_url") : null;
                  const base = savedBase || (typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://yindee-moo-krob-pos.vercel.app");
                  const link = `${base.replace(/\/+$/, "")}/table/${target.code}`;
                  const url = await QRCode.toDataURL(link, {
                    width: 440,
                    margin: 3,
                    errorCorrectionLevel: "M",
                  });
                  setQrModalImg(url);
                }}
                title="แสดง QR Code โต๊ะนี้"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-primary/8 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <QrCode className="h-4.5 w-4.5" />
              </button>
            )}
          </div>

          {/* Customer name */}
          <input
            id="pos-customer-name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="ชื่อลูกค้า..."
            className="hidden h-10 w-32 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary xl:block"
          />

          {/* Cashier / Billing link */}
          <Link
            to="/order-status"
            id="pos-order-status-btn"
            className={cn(
              "relative flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition-all shadow-xs shrink-0",
              billCalls.length > 0
                ? "border-amber-500 bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/50 hover:bg-amber-500/30"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white"
            )}
            title="ไปหน้าแคชเชียร์ & ตรวจบิล"
          >
            <ReceiptText className={cn("h-4.5 w-4.5", billCalls.length > 0 ? "text-amber-600 animate-bounce" : "text-emerald-600 dark:text-emerald-400")} />
            <span className="hidden md:inline">
              {billCalls.length > 0 ? `เช็คบิล (${billCalls.length} โต๊ะ!)` : "แคชเชียร์ (ตรวจบิล)"}
            </span>
            {billCalls.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-black text-white shadow-sm animate-pulse">
                {billCalls.length}
              </span>
            )}
          </Link>

          {/* Logout / Back to Admin */}

          <Link
            to='/'
            className='hidden xl:flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary/40 hover:text-primary transition-colors'
          >
            <LogOut className='h-4 w-4' /> กลับหน้าหลัก
          </Link>
          <Link
            to='/'
            className='flex xl:hidden items-center justify-center rounded-xl border border-border bg-card h-10 w-10 shrink-0 text-foreground transition-colors hover:bg-primary/10'
            aria-label='กลับหน้าหลัก'
          >
            <LogOut className='h-5 w-5' />
          </Link>

          {/* Mobile cart toggle */}
          <button
            id="pos-cart-toggle"
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-primary/10 lg:hidden"
            aria-label="เปิดตะกร้า"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span
                key={totalItems}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                style={{ animation: "cart-badge-pop 300ms ease-out" }}
              >
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Active Bill Calls Notification Banner ─────────────────────── */}
      {billCalls.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100 shadow-inner">
          <div className="flex items-center gap-2 font-medium flex-wrap">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <span className="font-bold text-amber-900 dark:text-amber-200">มีลูกค้าเรียกเช็คบิล:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {billCalls.map((c) => {
                const target = tables.find((t) => t.id === c.table_id);
                return (
                  <span
                    key={c.id}
                    className="inline-flex items-center rounded-lg bg-card/80 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-200 border border-amber-500/40 shadow-xs"
                  >
                    🧾 {target ? `โต๊ะ ${target.code}` : "มีลูกค้า"}
                  </span>
                );
              })}
            </div>
          </div>
          <Link
            to="/order-status"
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1 text-xs font-bold text-white shadow-xs transition-all"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            ตรวจบิล & ชำระเงิน →
          </Link>
        </div>
      )}

      {/* ── Body: menu + cart ─────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Left: category pills + menu grid ───────────────────── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Category pills */}
          <div className="shrink-0 overflow-x-auto border-b border-border bg-card/60 px-4 py-3">
            <div className="flex gap-2 pb-0.5">
              <CategoryPill
                id="cat-all"
                active={activeCat === "all"}
                emoji="🍽️"
                onClick={() => setActiveCat("all")}
              >
                ทั้งหมด
              </CategoryPill>
              <CategoryPill
                id="cat-popular"
                active={activeCat === "popular"}
                emoji="⭐"
                onClick={() => setActiveCat("popular")}
              >
                แนะนำพิเศษ
              </CategoryPill>
              {categories
                .filter((c) => c.code !== "CAT_POPULAR" && !c.name.includes("ยอดนิยม"))
                .map((c) => (
                  <CategoryPill
                    key={c.id}
                    id={`cat-${c.id}`}
                    active={activeCat === c.id}
                    emoji={CAT_EMOJI[c.code] ?? "🍜"}
                    onClick={() => setActiveCat(c.id)}
                  >
                    {c.name}
                  </CategoryPill>
                ))}
            </div>
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto p-4 pos-scrollbar">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((item, idx) => {
                const isSingle = isSingleDishItem(item);
                const totalQty = getItemTotalQty(item.id);
                return (
                  <MenuCard
                    key={item.id}
                    item={item}
                    qty={totalQty}
                    isSingleDish={isSingle}
                    onCardClick={() => {
                      setModalItem(item);
                    }}
                    onAdd={() => {
                      setModalItem(item);
                    }}
                    onMinus={() => handleCardMinus(item)}
                    animIdx={idx}
                  />
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                  <Search className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">ไม่พบเมนูที่ค้นหา</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── Right: sticky cart panel (desktop) ─────────────────── */}
        <aside className="hidden w-[380px] shrink-0 flex-col border-l border-border bg-card lg:flex">
          <CartPanel
            lines={lines}
            totalItems={totalItems}
            subtotal={subtotal}
            discount={discount}
            discountPct={discountPct}
            total={total}
            customer={customer}
            onCustomerChange={setCustomer}
            count={count}
            onCountChange={setCount}
            tableId={tableId}
            onSetLineQty={updateCartLineQty}
            onSetDiscountPct={setDiscountPct}
            onConfirm={confirm}
            saving={saving}
          />
        </aside>
      </div>

      {/* ── Mobile cart drawer ─────────────────────────────────────── */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setCartOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 flex max-h-[90vh] flex-col rounded-t-3xl bg-card shadow-bento-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "fade-up 260ms ease-out" }}
          >
            {/* Drawer handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>
            <CartPanel
              lines={lines}
              totalItems={totalItems}
              subtotal={subtotal}
              discount={discount}
              discountPct={discountPct}
              total={total}
              customer={customer}
              onCustomerChange={setCustomer}
              count={count}
              onCountChange={setCount}
              tableId={tableId}
              onSetLineQty={updateCartLineQty}
              onSetDiscountPct={setDiscountPct}
              onConfirm={async () => {
                await confirm();
              }}
              saving={saving}
              isMobile
            />
          </div>
        </div>
      )}

      {/* ── QR Modal ──────────────────────────────────────────────── */}
      {qrModalTable && (
        <Modal
          title={`QR Code สั่งอาหาร · โต๊ะ ${qrModalTable.code}`}
          onClose={() => setQrModalTable(null)}
        >
          <div className="space-y-4 text-center">
            <div className="mx-auto w-fit rounded-3xl border border-border bg-white p-5 shadow-sm">
              {qrModalImg ? (
                <img
                  src={qrModalImg}
                  alt={`QR code สำหรับ ${qrModalTable.code}`}
                  className="mx-auto h-60 w-60 rounded-xl object-contain"
                  width={240}
                  height={240}
                />
              ) : (
                <div className="mx-auto grid h-60 w-60 place-items-center rounded-xl bg-muted text-xs text-muted-foreground">
                  กำลังสร้าง QR...
                </div>
              )}
              <div className="mt-2 rounded-xl bg-slate-100 p-2 text-slate-900">
                <p className="text-base font-bold">
                  {qrModalTable.code} · {qrModalTable.name}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-primary">
                  ให้ลูกค้าใช้กล้องมือถือสแกนเพื่อสั่งอาหารทันที
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`/table/${qrModalTable.code}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-glow"
              >
                เปิดหน้าเมนูลูกค้า
              </a>
              <button
                type="button"
                onClick={() => setQrModalTable(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-muted"
              >
                ปิด
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Food Item Detail Modal (อาหารจานเดียว หรือ กับข้าว/น้ำ มีแค่หมายเหตุ) ────────── */}
      <FoodItemDetailModal
        isOpen={Boolean(modalItem)}
        onClose={() => setModalItem(null)}
        item={modalItem}
        isNoteOnly={modalItem ? isNoteOnlyItem(modalItem) : false}
        onAddToCart={handleAddToCartSelection}
      />
    </div>
  );
}

/* ─── MenuCard ───────────────────────────────────────────────────── */
function MenuCard({
  item,
  qty,
  isSingleDish = false,
  onCardClick,
  onAdd,
  onMinus,
  animIdx,
}: {
  item: MenuItem;
  qty: number;
  isSingleDish?: boolean;
  onCardClick: () => void;
  onAdd: () => void;
  onMinus: () => void;
  animIdx: number;
}) {
  const isOOS = item.status === "out_of_stock";
  const gradient = getPlaceholderGradient(item.id);

  return (
    <article
      id={`menu-item-${item.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200",
        !isOOS && "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover",
        isOOS && "opacity-70",
      )}
      style={{
        animation: `pop-in 260ms ease-out ${Math.min(animIdx * 30, 300)}ms both`,
      }}
      onClick={() => {
        if (!isOOS) onCardClick();
      }}
    >
      {/* ── Image area ─────────────────────────────── */}
      <div className="relative h-44 overflow-hidden shrink-0">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
              isOOS && "grayscale",
            )}
          />
        ) : (
          <div
            className={cn(
              "h-full w-full bg-gradient-to-br flex items-center justify-center text-5xl",
              gradient,
            )}
          >
            🍖
          </div>
        )}
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Code badge */}
        <span className="absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          {item.code}
        </span>

        {/* OOS overlay */}
        {isOOS && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <span className="rounded-xl bg-black/70 px-4 py-1.5 text-sm font-bold text-white">หมด</span>
          </div>
        )}

        {/* Price badge on image bottom */}
        <span className="absolute bottom-2 left-2 rounded-xl bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground shadow-glow">
          {baht(item.price)}
        </span>
      </div>

      {/* ── Info + stepper ─────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex-1">
          <h3 className="text-sm font-bold leading-snug text-foreground">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
          )}
        </div>

        {/* Stepper / Action Button */}
        {!isOOS && (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            {isSingleDish ? (
              qty === 0 ? (
                <button
                  id={`add-${item.id}`}
                  aria-label={`เลือก ${item.name}`}
                  onClick={onAdd}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow transition-all hover:bg-primary-dark active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  เพิ่ม
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary">
                    ในตะกร้า {qty}
                  </span>
                  <button
                    id={`add-custom-${item.id}`}
                    aria-label={`ปรับแต่งหรือเพิ่ม ${item.name}`}
                    onClick={onAdd}
                    className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-glow transition-all hover:bg-primary-dark active:scale-95 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    เพิ่มอีก
                  </button>
                </div>
              )
            ) : qty === 0 ? (
              <button
                id={`add-${item.id}`}
                aria-label={`เพิ่ม ${item.name}`}
                onClick={onAdd}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-glow transition-all hover:bg-primary-dark active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                เพิ่ม
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-1">
                <button
                  id={`minus-${item.id}`}
                  aria-label="ลด"
                  onClick={onMinus}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-card text-foreground shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95 cursor-pointer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[2rem] text-center text-base font-bold text-primary">{qty}</span>
                <button
                  id={`plus-${item.id}`}
                  aria-label="เพิ่ม"
                  onClick={onAdd}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow transition-colors hover:bg-primary-dark active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ─── CartPanel (shared between desktop sidebar + mobile drawer) ─── */
function CartPanel({
  lines,
  totalItems,
  subtotal,
  discount,
  discountPct,
  total,
  customer,
  onCustomerChange,
  count,
  onCountChange,
  tableId,
  onSetLineQty,
  onSetDiscountPct,
  onConfirm,
  saving,
  isMobile = false,
}: {
  lines: CartLine[];
  totalItems: number;
  subtotal: number;
  discount: number;
  discountPct: number;
  total: number;
  customer: string;
  onCustomerChange: (v: string) => void;
  count: number;
  onCountChange: (v: number) => void;
  tableId: string;
  onSetLineQty: (lineId: string, delta: number) => void;
  onSetDiscountPct: (v: number) => void;
  onConfirm: () => void;
  saving: boolean;
  isMobile?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", isMobile ? "max-h-[85vh]" : "h-full")}>
      {/* Header */}
      <div className="shrink-0 border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4.5 w-4.5 text-primary" />
            <h2 className="text-base font-bold">รายการสั่ง</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {tableId ? "🪑 ทานที่ร้าน" : "🥡 กลับบ้าน"}
            </span>
            {totalItems > 0 && (
              <span
                key={totalItems}
                className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                style={{ animation: "cart-badge-pop 280ms ease-out" }}
              >
                {totalItems}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Customer + count (inside cart) */}
      <div className="shrink-0 grid grid-cols-2 gap-2 border-b border-border px-4 py-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ชื่อลูกค้า
          </label>
          <input
            id="cart-customer-name"
            value={customer}
            onChange={(e) => onCustomerChange(e.target.value)}
            placeholder="ชื่อ / พนักงาน"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            จำนวนลูกค้า
          </label>
          <input
            id="cart-customer-count"
            type="number"
            min={1}
            value={count}
            onChange={(e) => onCountChange(Number(e.target.value) || 1)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Cart line items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pos-scrollbar">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 opacity-20" />
            <p className="text-sm">ยังไม่มีรายการ</p>
            <p className="text-xs opacity-60">แตะเมนูเพื่อเพิ่มรายการ</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lines.map((l, i) => {
              const lineKey = l.id || `${l.item.id}-${i}`;
              return (
                <CartLine
                  key={lineKey}
                  line={l}
                  onMinus={() => onSetLineQty(lineKey, -1)}
                  onPlus={() => onSetLineQty(lineKey, 1)}
                  onDelete={() => onSetLineQty(lineKey, -l.qty)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Discount chips */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ส่วนลด</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {DISCOUNTS.map((d) => (
            <button
              key={d.value}
              id={`discount-${d.value}`}
              onClick={() => onSetDiscountPct(d.value)}
              className={cn(
                "rounded-xl border py-2 text-xs font-semibold transition-all",
                discountPct === d.value
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Totals + Charge button */}
      <div className="shrink-0 border-t border-border px-4 pb-5 pt-3">
        <div className="mb-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>ราคาก่อนลด</span>
            <span className="font-semibold text-foreground">{baht(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>ส่วนลด ({discountPct}%)</span>
              <span className="font-semibold text-primary">-{baht(discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold">
            <span>ยอดสุทธิ</span>
            <span className="text-xl text-primary">{baht(total)}</span>
          </div>
        </div>

        <button
          id="pos-charge-btn"
          onClick={onConfirm}
          disabled={saving || lines.length === 0}
          className={cn(
            "relative w-full overflow-hidden rounded-2xl py-4 text-base font-bold text-white transition-all duration-200",
            lines.length > 0 && !saving
              ? "bg-gradient-to-r from-primary to-orange-500 shadow-glow hover:from-primary-dark hover:to-orange-600 active:scale-[0.98]"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          style={
            lines.length > 0 && !saving
              ? { animation: "charge-pulse 2s ease-in-out infinite" }
              : undefined
          }
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              กำลังบันทึก...
            </span>
          ) : lines.length > 0 ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              ยืนยัน · {baht(total)}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              เพิ่มรายการก่อน
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── CartLine ───────────────────────────────────────────────────── */
function CartLine({
  line,
  onMinus,
  onPlus,
  onDelete,
}: {
  line: CartLine;
  onMinus: () => void;
  onPlus: () => void;
  onDelete: () => void;
}) {
  const { item, qty, unitPrice = item.price, summaryText } = line;
  const gradient = getPlaceholderGradient(item.id);

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border bg-background p-2 transition-all"
      style={{ animation: "slide-in-right 240ms ease-out" }}
    >
      {/* Thumbnail */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br text-xl", gradient)}>
            🍖
          </div>
        )}
      </div>

      {/* Name + options + price */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        {summaryText && (
          <p className="line-clamp-1 text-[11px] text-primary/90 font-medium">{summaryText}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {baht(unitPrice)} × {qty} = <span className="font-bold text-primary">{baht(unitPrice * qty)}</span>
        </p>
      </div>

      {/* Stepper */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          id={`cart-minus-${line.id || item.id}`}
          aria-label="ลด"
          onClick={onMinus}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary active:scale-90 cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-bold">{qty}</span>
        <button
          id={`cart-plus-${line.id || item.id}`}
          aria-label="เพิ่ม"
          onClick={onPlus}
          className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-dark active:scale-90 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Delete */}
      <button
        id={`cart-delete-${line.id || item.id}`}
        aria-label={`ลบ ${item.name}`}
        onClick={onDelete}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 active:scale-90 cursor-pointer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ─── CategoryPill ───────────────────────────────────────────────── */
function CategoryPill({
  id,
  active,
  emoji,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  emoji: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-150",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <span className="text-base leading-none">{emoji}</span>
      {children}
    </button>
  );
}

/* ─── Re-exported helpers (kept for any co-located imports) ──────── */
export { CategoryPill as Pill };

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 text-xs text-muted-foreground">
      <span className="mb-1 block">{label}:</span>
      {children}
    </label>
  );
}

export function Stepper({
  qty,
  onMinus,
  onPlus,
}: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-muted p-0.5">
      <button
        aria-label="ลด"
        onClick={onMinus}
        className="grid h-7 w-7 place-items-center rounded-full bg-card text-foreground shadow-sm transition-colors hover:text-primary"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-semibold">{qty}</span>
      <button
        aria-label="เพิ่ม"
        onClick={onPlus}
        className="grid h-7 w-7 place-items-center rounded-full bg-card text-foreground shadow-sm transition-colors hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-semibold", accent && "text-primary")}>{value}</span>
    </div>
  );
}

