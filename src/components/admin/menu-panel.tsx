import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Upload,
  Star,
  Trash2,
  AlertTriangle,
  Search,
  CheckCircle2,
  XCircle,
  LayoutList,
  Table as TableIcon,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { PanelShell, bento } from "@/components/console-layout";
import { Modal, Labeled } from "@/components/modal";
import { baht, db, fetchCategories, fetchMenu, type MenuItem } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

const EMPTY: Omit<MenuItem, "id"> = {
  code: "",
  name: "",
  category_id: null,
  price: 0,
  description: "",
  image_url: "",
  is_popular: false,
  display_order: 99,
  status: "available",
};

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

/**
 * ── StockToggle (ปุ่มสวิตช์สถานะ มีของ / หมด) ──
 * สวิตช์เลื่อนแบบเปิด-ปิด (Toggle Pill) สไตล์ Restaurant OS:
 * - "มีของ": พื้นหลังเขียว ปุ่มกลมเลื่อนขวา ตัวอักษรสีขาว "มีของ" ทางซ้าย
 * - "หมด": พื้นหลังเทา ปุ่มกลมเลื่อนซ้าย ตัวอักษรสีแดง "หมด" ทางขวา
 */
export function StockToggle({
  status,
  onToggle,
  disabled,
  size = "md",
}: {
  status: "available" | "out_of_stock";
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const isAvailable = status === "available";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isAvailable}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={isAvailable ? "สถานะ: มีของ (คลิกเพื่อเปลี่ยนเป็น 'หมด')" : "สถานะ: หมด (คลิกเพื่อเปลี่ยนเป็น 'มีของ')"}
      className={cn(
        "group relative inline-flex items-center rounded-full p-1 transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-95 shadow-sm select-none shrink-0 cursor-pointer",
        size === "lg" ? "h-9 w-[100px]" : "h-8 w-[92px]",
        isAvailable
          ? "bg-emerald-600 hover:bg-emerald-500 border border-emerald-700/20"
          : "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400/80 dark:hover:bg-slate-600 border border-slate-400/30",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {/* Label text */}
      <span
        className={cn(
          "absolute font-bold tracking-tight transition-all duration-200 pointer-events-none select-none",
          size === "lg" ? "text-xs" : "text-[11px]",
          isAvailable
            ? "left-2.5 text-white drop-shadow-sm"
            : "right-3 text-rose-600 dark:text-rose-400 font-bold"
        )}
      >
        {isAvailable ? "มีของ" : "หมด"}
      </span>

      {/* Sliding Circle Knob */}
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.25)] ring-0 transition-transform duration-300 ease-in-out",
          size === "lg" ? "h-7 w-7" : "h-6 w-6",
          isAvailable
            ? size === "lg"
              ? "translate-x-[64px]"
              : "translate-x-[60px]"
            : "translate-x-0"
        )}
      />
    </button>
  );
}

export function MenuPanel() {
  const qc = useQueryClient();
  const { data: menu = [] } = useQuery({ queryKey: ["menu"], queryFn: fetchMenu });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [draft, setDraft] = useState<(Omit<MenuItem, "id"> & { id?: string }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters and views
  const [viewMode, setViewMode] = useState<"table" | "quick-stock">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "out_of_stock">("all");
  const [selectedCatId, setSelectedCatId] = useState<string | "all">("all");

  const refresh = () => qc.invalidateQueries({ queryKey: ["menu"] });

  /* ---- Instant Optimistic Toggle for Stock Status ---- */
  const toggleStatus = async (item: MenuItem) => {
    const nextStatus = item.status === "available" ? "out_of_stock" : "available";
    // 0ms Optimistic UI update
    qc.setQueryData<MenuItem[]>(["menu"], (old = []) =>
      old.map((m) => (m.id === item.id ? { ...m, status: nextStatus } : m))
    );
    try {
      const { error } = await db.from("menu_items").update({ status: nextStatus }).eq("id", item.id);
      if (error) throw error;
      toast.success(
        nextStatus === "available"
          ? `🟢 ${item.name}: มีของ (พร้อมขาย)`
          : `⚪ ${item.name}: ของหมด (ปิดรับออเดอร์)`
      );
      refresh();
    } catch {
      toast.error("อัปเดตสถานะไม่สำเร็จ");
      refresh();
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("กรุณากรอกชื่อเมนู");
      return;
    }
    const { id, ...payload } = draft;
    try {
      const query = id
        ? db.from("menu_items").update(payload).eq("id", id)
        : db.from("menu_items").insert({ ...payload, code: payload.code || `M${Date.now() % 10000}` });
      const { error } = await query;
      if (error) throw error;
      toast.success(id ? "บันทึกเมนูแล้ว" : "เพิ่มเมนูใหม่แล้ว");
      setDraft(null);
      refresh();
    } catch {
      toast.error("บันทึกเมนูไม่สำเร็จ");
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await db.from("menu_items").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success(`ลบ ${deleteTarget.name} แล้ว`);
      setDeleteTarget(null);
      refresh();
    } catch {
      toast.error("ลบเมนูไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file || !draft) return;
    if (file.size > 7 * 1024 * 1024) {
      toast.error("ไฟล์ต้องมีขนาดน้อยกว่า 7MB");
      return;
    }
    try {
      setDraft({ ...draft, image_url: await compressImage(file) });
      toast.success("อัปโหลดและย่อขนาดรูปแล้ว");
    } catch {
      toast.error("อ่านไฟล์รูปไม่สำเร็จ");
    }
  };

  // Stats
  const totalCount = menu.length;
  const availableCount = menu.filter((m) => m.status === "available").length;
  const outOfStockCount = menu.filter((m) => m.status === "out_of_stock").length;

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return menu.filter((m) => {
      if (statusFilter === "available" && m.status !== "available") return false;
      if (statusFilter === "out_of_stock" && m.status !== "out_of_stock") return false;
      if (selectedCatId !== "all" && m.category_id !== selectedCatId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchCode = m.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [menu, statusFilter, selectedCatId, searchQuery]);

  // Grouped by category for Quick Stock view
  const categorizedMenu = useMemo(() => {
    const list = categories.map((cat) => ({
      category: cat,
      items: filteredMenu.filter((m) => m.category_id === cat.id),
    })).filter((group) => group.items.length > 0);

    const uncategorized = filteredMenu.filter(
      (m) => !m.category_id || !categories.some((c) => c.id === m.category_id)
    );
    if (uncategorized.length > 0) {
      list.push({
        category: { id: "other", name: "เมนูอื่นๆ", display_order: 999 },
        items: uncategorized,
      });
    }
    return list;
  }, [categories, filteredMenu]);

  return (
    <PanelShell
      title="จัดการเมนูอาหาร"
      actions={
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border/80">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                viewMode === "table"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>ตาราง</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("quick-stock")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                viewMode === "quick-stock"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>สถานะของมี-ของหมด</span>
            </button>
          </div>

          <button
            onClick={() => setDraft({ ...EMPTY })}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> เพิ่มเมนู
          </button>
        </div>
      }
    >
      {/* ── Status Stats & Filter Bar ── */}
      <div className={cn(bento, "mb-4 p-4 space-y-3")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-all border",
                statusFilter === "all"
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40"
              )}
            >
              ทั้งหมด ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("available")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border",
                statusFilter === "available"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>มีของพร้อมขาย ({availableCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("out_of_stock")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all border",
                statusFilter === "out_of_stock"
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20"
              )}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>ของหมด ({outOfStockCount})</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อเมนู หรือรหัส..."
              className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-1.5 text-xs font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Categories selector */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
          <span className="text-[11px] font-bold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> หมวดหมู่:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCatId("all")}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              selectedCatId === "all"
                ? "bg-primary/15 text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ทุกหมวดหมู่
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCatId(c.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                selectedCatId === c.id
                  ? "bg-primary/15 text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              #{c.display_order} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── VIEW 1: QUICK STOCK STATUS VIEW (สไตล์ Restaurant OS เหมือนในภาพตัวอย่าง) ── */}
      {viewMode === "quick-stock" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                จัดการสถานะเมนู (ของหมด/มีของ)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                แตะปุ่มสวิตช์เพื่อเปิด-ปิดสถานะของเมนูได้ทันที ระบบจะอัปเดตแบบเรียลไทม์ไปที่หน้ารับออเดอร์ QR และ POS
              </p>
            </div>
          </div>

          {categorizedMenu.length === 0 ? (
            <div className={cn(bento, "p-8 text-center text-muted-foreground")}>
              ไม่พบรายการเมนูที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : (
            categorizedMenu.map((group) => (
              <div key={group.category.id} className="space-y-2">
                <h3 className="text-lg font-black tracking-tight text-foreground px-1 flex items-center gap-2">
                  <span>{group.category.name}</span>
                  <span className="text-xs font-bold text-muted-foreground">
                    ({group.items.length} เมนู)
                  </span>
                </h3>

                <div className={cn(bento, "divide-y divide-border/60 overflow-hidden")}>
                  {group.items.map((item) => {
                    const isAvailable = item.status === "available";
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between gap-4 p-3.5 sm:p-4 transition-colors hover:bg-muted/40",
                          !isAvailable && "bg-muted/20"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className={cn(
                                "h-11 w-11 shrink-0 rounded-xl object-cover border border-border/80",
                                !isAvailable && "grayscale opacity-60"
                              )}
                            />
                          ) : (
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground text-xs font-bold">
                              {item.code}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className={cn(
                                  "font-bold text-base leading-tight truncate",
                                  isAvailable ? "text-foreground" : "text-muted-foreground line-through decoration-rose-500/60"
                                )}
                              >
                                {item.name}
                              </p>
                              {item.is_popular && (
                                <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              รหัส: <span className="font-mono">{item.code}</span> · ราคา:{" "}
                              <span className="font-bold text-foreground">{baht(item.price)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Stock Toggle Switch Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <StockToggle
                            status={item.status}
                            onToggle={() => toggleStatus(item)}
                            size="lg"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── VIEW 2: STANDARD TABLE VIEW (พร้อมปุ่มสวิตช์ มีของ/หมด ในคอลัมน์สถานะ) ── */}
      {viewMode === "table" && (
        <div className={cn(bento, "overflow-x-auto")}>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">รหัส</th>
                <th className="p-3">ชื่อเมนู</th>
                <th className="p-3">หมวดหมู่</th>
                <th className="p-3">ราคา</th>
                <th className="p-3">สถานะ (ของมี-หมด)</th>
                <th className="p-3 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredMenu.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    ไม่พบรายการเมนูที่ค้นหา
                  </td>
                </tr>
              ) : (
                filteredMenu.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground">{m.code}</td>
                    <td className="p-3">
                      <span className="flex items-center gap-1.5 font-bold text-foreground">
                        {m.name}
                        {m.is_popular && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {categories.find((c) => c.id === m.category_id)?.name ?? "-"}
                    </td>
                    <td className="p-3 font-bold text-primary">{baht(m.price)}</td>
                    <td className="p-3">
                      {/* Stock Toggle Switch (มีของ / หมด) */}
                      <StockToggle
                        status={m.status}
                        onToggle={() => toggleStatus(m)}
                        size="md"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDraft({ ...m })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:border-primary/40 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" /> แก้ไข
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal title="ยืนยันการลบเมนู" onClose={() => !deleting && setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-primary mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  ต้องการลบเมนู <span className="text-primary">&ldquo;{deleteTarget.name}&rdquo;</span> ใช่ไหม?
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  รหัสเมนู: {deleteTarget.code} · ราคา: {baht(deleteTarget.price)}<br />
                  การลบนี้จะไม่สามารถกู้คืนได้ ออเดอร์ที่เคยสั่งเมนูนี้จะยังคงอยู่ในระบบ
                </p>
              </div>
            </div>

            {deleteTarget.image_url && (
              <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                <img
                  src={deleteTarget.image_url}
                  alt={deleteTarget.name}
                  className="h-14 w-14 rounded-xl object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{deleteTarget.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {categories.find((c) => c.id === deleteTarget.category_id)?.name ?? "ไม่มีหมวดหมู่"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={deleteItem}
                disabled={deleting}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "กำลังลบ..." : "ยืนยัน ลบเมนูนี้"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {draft && (
        <Modal title={draft.id ? "แก้ไขเมนู" : "เพิ่มเมนูใหม่"} onClose={() => setDraft(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="ชื่อเมนู">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="รหัสเมนู">
              <input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="หมวดหมู่">
              <select
                value={draft.category_id ?? ""}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value || null })}
                className="input-base"
              >
                <option value="">- เลือกหมวดหมู่ -</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="ราคา (บาท)">
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="ลำดับการแสดง">
              <input
                type="number"
                value={draft.display_order}
                onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="สถานะสินค้า (ของมี-หมด)">
              <div className="flex items-center gap-3 pt-1">
                <StockToggle
                  status={draft.status}
                  onToggle={() =>
                    setDraft({
                      ...draft,
                      status: draft.status === "available" ? "out_of_stock" : "available",
                    })
                  }
                  size="lg"
                />
                <span className="text-sm font-bold text-foreground">
                  {draft.status === "available" ? "มีของ (เปิดขาย)" : "หมด (ปิดรับออเดอร์)"}
                </span>
              </div>
            </Labeled>
            <div className="sm:col-span-2">
              <Labeled label="คำอธิบาย">
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  className="input-base h-auto py-2"
                />
              </Labeled>
            </div>
            <div className="sm:col-span-2">
              <Labeled label="URL รูปภาพ">
                <input
                  value={draft.image_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  className="input-base"
                />
              </Labeled>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/50">
              <Upload className="h-4 w-4" /> อัปโหลดรูป (ย่ออัตโนมัติ &lt; 7MB)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.is_popular}
                onChange={(e) => setDraft({ ...draft, is_popular: e.target.checked })}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              เมนูยอดนิยม
            </label>
            <div className="sm:col-span-2">
              <button
                onClick={save}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow"
              >
                บันทึกเมนู
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PanelShell>
  );
}
