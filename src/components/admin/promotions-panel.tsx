import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { PanelShell, bento } from "@/components/console-layout";
import { Modal, Labeled } from "@/components/modal";
import { baht, db, fetchPromotions, type Promotion } from "@/lib/restaurant";
import { cn } from "@/lib/utils";

const EMPTY: Omit<Promotion, "id"> = {
  title: "",
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 10,
  min_spend: 0,
  start_date: null,
  end_date: null,
  banner_url: "",
  status: "active",
};

export function PromotionsPanel() {
  const qc = useQueryClient();
  const { data: promos = [] } = useQuery({ queryKey: ["promotions"], queryFn: fetchPromotions });
  const [draft, setDraft] = useState<(Omit<Promotion, "id"> & { id?: string }) | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["promotions"] });

  const toggle = async (p: Promotion) => {
    const status = p.status === "active" ? "inactive" : "active";
    try {
      const { error } = await db.from("promotions").update({ status }).eq("id", p.id);
      if (error) throw error;
      toast.success(`${p.title}: ${status === "active" ? "เปิดใช้งาน" : "ปิดใช้งาน"}`);
      refresh();
    } catch {
      toast.error("อัปเดตไม่สำเร็จ");
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("กรุณากรอกชื่อโปรโมชั่น");
      return;
    }
    const { id, ...payload } = draft;
    try {
      const q = id
        ? db.from("promotions").update(payload).eq("id", id)
        : db.from("promotions").insert({ ...payload, code: payload.code || `PR${Date.now() % 100000}` });
      const { error } = await q;
      if (error) throw error;
      toast.success(id ? "บันทึกโปรโมชั่นแล้ว" : "สร้างโปรโมชั่นใหม่แล้ว");
      setDraft(null);
      refresh();
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <PanelShell
      title="โปรโมชั่น"
      actions={
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> เพิ่มโปรโมชั่น
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {promos.map((p) => (
          <article key={p.id} className={cn(bento, "space-y-3 p-4")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{p.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
              </div>
              <button
                onClick={() => toggle(p)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                  p.status === "active"
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {p.status === "active" ? "เปิดใช้งาน" : "ปิดใช้งาน"}
              </button>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
            <div className="flex items-end justify-between gap-2">
              <span className="text-2xl font-bold text-primary">
                {p.discount_type === "percentage"
                  ? `${p.discount_value}%`
                  : baht(p.discount_value)}
              </span>
              <span className="text-xs text-muted-foreground">
                ขั้นต่ำ {baht(p.min_spend)}
                <br />
                {p.start_date ?? "-"} → {p.end_date ?? "-"}
              </span>
            </div>
            <button
              onClick={() => setDraft({ ...p })}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/40"
            >
              <Pencil className="h-3.5 w-3.5" /> แก้ไข
            </button>
          </article>
        ))}
      </div>

      {draft && (
        <Modal
          title={draft.id ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่น"}
          onClose={() => setDraft(null)}
          wide
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="ชื่อโปรโมชั่น">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="โค้ดส่วนลด">
              <div className="flex gap-2">
                <input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  className="input-base"
                />
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      code: `PROMO${Math.floor(1000 + Math.random() * 9000)}`,
                    })
                  }
                  aria-label="สุ่มโค้ด"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border hover:border-primary/40"
                >
                  <Wand2 className="h-4 w-4" />
                </button>
              </div>
            </Labeled>
            <Labeled label="ประเภทส่วนลด">
              <select
                value={draft.discount_type}
                onChange={(e) => setDraft({ ...draft, discount_type: e.target.value as never })}
                className="input-base"
              >
                <option value="percentage">เปอร์เซ็นต์ (%)</option>
                <option value="fixed_amount">จำนวนเงิน (฿)</option>
              </select>
            </Labeled>
            <Labeled label="มูลค่าส่วนลด">
              <input
                type="number"
                value={draft.discount_value}
                onChange={(e) => setDraft({ ...draft, discount_value: Number(e.target.value) })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="ยอดขั้นต่ำ">
              <input
                type="number"
                value={draft.min_spend}
                onChange={(e) => setDraft({ ...draft, min_spend: Number(e.target.value) })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="สถานะ">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as never })}
                className="input-base"
              >
                <option value="active">เปิดใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </select>
            </Labeled>
            <Labeled label="วันเริ่ม">
              <input
                type="date"
                value={draft.start_date ?? ""}
                onChange={(e) => setDraft({ ...draft, start_date: e.target.value || null })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="วันสิ้นสุด">
              <input
                type="date"
                value={draft.end_date ?? ""}
                onChange={(e) => setDraft({ ...draft, end_date: e.target.value || null })}
                className="input-base"
              />
            </Labeled>
            <div className="sm:col-span-2">
              <Labeled label="คำอธิบาย">
                <textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="input-base h-auto py-2"
                />
              </Labeled>
            </div>
            <div className="sm:col-span-2">
              <Labeled label="URL แบนเนอร์">
                <input
                  value={draft.banner_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, banner_url: e.target.value })}
                  className="input-base"
                />
              </Labeled>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={save}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow"
              >
                บันทึกโปรโมชั่น
              </button>
            </div>
          </div>
        </Modal>
      )}
    </PanelShell>
  );
}
