import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import {
  QrCode,
  Pencil,
  Download,
  RefreshCw,
  Printer,
  Copy,
  ExternalLink,
  Wifi,
  Globe,
  Check,
  Sparkles,
  Smartphone,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { PanelShell, bento } from "@/components/console-layout";
import { Modal, Labeled } from "@/components/modal";
import {
  db,
  fetchSettings,
  fetchTables,
  type RestaurantTable,
  type TableStatus,
} from "@/lib/restaurant";
import { cn } from "@/lib/utils";

// QR generator with high scan contrast and error correction
const makeQr = (link: string, width = 512, darkColor = "#000000") =>
  QRCode.toDataURL(link, {
    width,
    margin: 3,
    errorCorrectionLevel: "M",
    color: {
      dark: darkColor,
      light: "#ffffff",
    },
  });

const STATUS: Record<TableStatus, { label: string; cls: string }> = {
  available: { label: "ว่าง", cls: "bg-success/15 text-success" },
  occupied: { label: "มีลูกค้า", cls: "bg-primary/10 text-primary" },
  disabled: { label: "ปิดใช้งาน", cls: "bg-muted text-muted-foreground" },
};

const DETECTED_LAN_IP = "http://10.31.2.54:8080";

export function TablesPanel() {
  const qc = useQueryClient();
  const { data: tables = [] } = useQuery({ queryKey: ["tables"], queryFn: fetchTables });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  const primaryColor = settings?.primary_color || "#F97316";
  const secondaryColor = settings?.secondary_color || "#10B981";

  // Base URL configuration for QR codes
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pos_table_qr_base_url");
      if (saved) return saved;
      if (window.location.origin && !window.location.origin.includes("localhost") && !window.location.origin.includes("127.0.0.1")) {
        return window.location.origin;
      }
    }
    return "https://yindee-moo-krob-pos.vercel.app";
  });

  const [customUrlInput, setCustomUrlInput] = useState(baseUrl);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals state
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [printTable, setPrintTable] = useState<RestaurantTable | null>(null);
  const [printAllOpen, setPrintAllOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [generating, setGenerating] = useState(false);

  // Add table modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ code: "", name: "", zone: "indoor" as "indoor" | "terrace" });
  const [addSaving, setAddSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  // Pre-rendered QR code cache for each table
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const cleanBaseUrl = useMemo(() => baseUrl.trim().replace(/\/+$/, ""), [baseUrl]);

  const qrLink = (code: string) => `${cleanBaseUrl}/table/${code}`;

  const handleUpdateBaseUrl = (newUrl: string) => {
    const trimmed = newUrl.trim().replace(/\/+$/, "");
    setBaseUrl(trimmed);
    setCustomUrlInput(trimmed);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_table_qr_base_url", trimmed);
    }
    toast.success(`เปลี่ยน Base URL เป็น ${trimmed} แล้ว`);
  };

  // Re-generate QR codes for all tables whenever tables, cleanBaseUrl or primaryColor changes
  useEffect(() => {
    let alive = true;
    const renderAll = async () => {
      const nextMap: Record<string, string> = {};
      for (const t of tables) {
        try {
          const url = await makeQr(qrLink(t.code), 360, primaryColor);
          nextMap[t.id] = url;
        } catch {
          // ignore
        }
      }
      if (alive) setQrMap(nextMap);
    };

    if (tables.length > 0) {
      renderAll();
    }

    return () => {
      alive = false;
    };
  }, [tables, cleanBaseUrl, primaryColor]);

  // ── Real-time: auto-refresh when any table row changes ────────────────
  useEffect(() => {
    const channel = db
      .channel("tables-panel-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        qc.invalidateQueries({ queryKey: ["tables"] });
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [qc]);

  const copyToClipboard = (text: string, code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(code);
      toast.success(`คัดลอกลิงก์ ${code} แล้ว`);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const save = async (t: RestaurantTable) => {
    try {
      const { error } = await db
        .from("tables")
        .update({ name: t.name, zone: t.zone, status: t.status })
        .eq("id", t.id);
      if (error) throw error;
      toast.success(`บันทึก ${t.code} แล้ว`);
      qc.invalidateQueries({ queryKey: ["tables"] });
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
    setEditing(null);
  };

  const addTable = async () => {
    const code = addForm.code.trim().toUpperCase();
    const name = addForm.name.trim() || `โต๊ะ ${code}`;
    if (!code) {
      toast.error("กรุณากรอกรหัสโต๊ะ");
      return;
    }
    // Check duplicate
    if (tables.some((t) => t.code === code)) {
      toast.error(`รหัสโต๊ะ ${code} มีอยู่แล้ว`);
      return;
    }
    setAddSaving(true);
    try {
      const { error } = await db.from("tables").insert({
        code,
        name,
        zone: addForm.zone,
        status: "available",
      });
      if (error) throw error;
      toast.success(`เพิ่มโต๊ะ ${code} เรียบร้อยแล้ว`);
      setAddForm({ code: "", name: "", zone: "indoor" });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["tables"] });
    } catch {
      toast.error("เพิ่มโต๊ะไม่สำเร็จ");
    } finally {
      setAddSaving(false);
    }
  };

  const deleteTable = async (t: RestaurantTable) => {
    setDeleteConfirming(true);
    try {
      const { error } = await db.from("tables").delete().eq("id", t.id);
      if (error) throw error;
      toast.success(`ลบโต๊ะ ${t.code} แล้ว`);
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["tables"] });
    } catch {
      toast.error("ลบโต๊ะไม่สำเร็จ");
    } finally {
      setDeleteConfirming(false);
    }
  };

  const syncAllQrToDb = async () => {
    setGenerating(true);
    try {
      for (const t of tables) {
        const dataUrl = await makeQr(qrLink(t.code), 512);
        const { error } = await db.from("tables").update({ qr_code_url: dataUrl }).eq("id", t.id);
        if (error) throw error;
      }
      toast.success(`บันทึก QR ทุกโต๊ะ (${tables.length} โต๊ะ) ลงระบบแล้ว`);
      qc.invalidateQueries({ queryKey: ["tables"] });
    } catch {
      toast.error("บันทึก QR ลงระบบไม่สำเร็จ");
    }
    setGenerating(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <PanelShell
      title="โต๊ะและ QR Code สำหรับลูกค้า"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setAddForm({ code: "", name: "", zone: "indoor" });
              setAddOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> เพิ่มโต๊ะ
          </button>
          <button
            onClick={() => setPrintAllOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:border-primary/50 transition-colors"
          >
            <Printer className="h-4 w-4 text-primary" /> พิมพ์ป้ายทุกโต๊ะ
          </button>
          <button
            onClick={syncAllQrToDb}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:brightness-110 disabled:opacity-60 transition-all"
          >
            <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
            {generating ? "กำลังบันทึก..." : "บันทึก QR ลงฐานข้อมูล"}
          </button>
        </div>
      }
    >
      {/* Tables Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((t) => {
          const tableQr = qrMap[t.id];
          const fullLink = qrLink(t.code);

          return (
            <article
              key={t.id}
              className={cn(
                bento,
                "flex flex-col justify-between p-4 transition-all hover:shadow-bento-lg hover:border-primary/30",
              )}
            >
              {/* Header */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-foreground">{t.code}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.name}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      STATUS[t.status].cls,
                    )}
                  >
                    {STATUS[t.status].label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
                    {t.zone === "indoor" ? "โซนห้องแอร์" : "โซนระเบียง"}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    ID: {t.id.slice(0, 8)}
                  </span>
                </div>

                {/* Scannable QR Preview */}
                <div
                  onClick={() => setQrTable(t)}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-white p-3 text-center transition-all hover:border-primary/60 hover:shadow-sm"
                  title="คลิกเพื่อดู QR ขนาดใหญ่หรือพิมพ์"
                >
                  {tableQr ? (
                    <img
                      src={tableQr}
                      alt={`QR สำหรับ ${t.code}`}
                      className="mx-auto h-40 w-40 object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-40 w-40 place-items-center bg-muted text-xs text-muted-foreground">
                      กำลังสร้าง QR...
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary">
                    <QrCode className="h-3 w-3" />
                    <span>สแกนสั่งอาหาร {t.code}</span>
                  </div>
                </div>

                {/* Link Preview & Copy */}
                <div className="flex items-center gap-1 rounded-xl bg-muted/60 px-2 py-1.5 text-[11px]">
                  <span className="truncate font-mono text-muted-foreground flex-1">
                    {fullLink}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fullLink, t.code)}
                    title="คัดลอกลิงก์"
                    className="grid h-6 w-6 place-items-center rounded-lg hover:bg-card hover:text-primary text-muted-foreground transition-colors"
                  >
                    {copiedCode === t.code ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <a
                    href={`/table/${t.code}`}
                    target="_blank"
                    rel="noreferrer"
                    title="เปิดหน้าเมนูลูกค้า"
                    className="grid h-6 w-6 place-items-center rounded-lg hover:bg-card hover:text-primary text-muted-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-border/70 mt-3">
                <button
                  type="button"
                  onClick={() => setQrTable(t)}
                  className="flex items-center justify-center gap-1 rounded-xl bg-primary/10 px-2 py-2 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>ดู QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintTable(t)}
                  className="flex items-center justify-center gap-1 rounded-xl border border-border px-2 py-2 text-[11px] font-semibold text-foreground hover:border-primary/50 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5 text-primary" />
                  <span>พิมพ์ป้าย</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="flex items-center justify-center gap-1 rounded-xl border border-border px-2 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>แก้ไข</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(t)}
                  className="flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-[11px] font-semibold text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>ลบ</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal: Single QR View */}
      {qrTable && (
        <Modal title={`QR Code สำหรับโต๊ะ ${qrTable.code}`} onClose={() => setQrTable(null)}>
          <div className="space-y-4 text-center">
            <div className="mx-auto w-fit rounded-3xl border border-border bg-white p-6 shadow-sm text-foreground">
              <p className="text-base font-bold" style={{ color: primaryColor }}>
                {settings?.store_name ?? "Restaurant OS"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{settings?.tagline}</p>

              {qrMap[qrTable.id] ? (
                <img
                  src={qrMap[qrTable.id]}
                  alt={`QR code สำหรับ ${qrTable.code}`}
                  className="mx-auto my-3 h-[260px] w-[260px] rounded-xl object-contain"
                  width={260}
                  height={260}
                />
              ) : (
                <div className="mx-auto my-3 grid h-[260px] w-[260px] place-items-center rounded-xl bg-muted text-xs text-muted-foreground">
                  กำลังสร้าง QR...
                </div>
              )}

              <div className="rounded-xl bg-muted/60 p-2.5">
                <p className="text-base font-bold text-foreground">
                  {qrTable.code} · {qrTable.name}
                </p>
                <p className="text-xs font-medium mt-0.5" style={{ color: primaryColor }}>
                  สแกนเพื่อสั่งอาหารทันที (ไม่ต้องล็อกอิน)
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 break-all text-xs font-mono text-muted-foreground bg-muted p-2 rounded-xl">
              <span>{qrLink(qrTable.code)}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(qrLink(qrTable.code), qrTable.code)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-card shadow-sm hover:text-primary"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <a
                href={qrMap[qrTable.id] || undefined}
                download={`QR-${qrTable.code}.png`}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold hover:border-primary/40"
              >
                <Download className="h-4 w-4 text-primary" /> ดาวน์โหลด
              </a>
              <button
                type="button"
                onClick={() => {
                  setPrintTable(qrTable);
                  setQrTable(null);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold hover:border-primary/40"
              >
                <Printer className="h-4 w-4 text-primary" /> พิมพ์ป้ายตั้งโต๊ะ
              </button>
              <a
                href={`/table/${qrTable.code}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-glow"
              >
                <span>เปิดหน้าลูกค้า</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Print Single Table Tent Card */}
      {printTable && (
        <Modal
          title={`พิมพ์ป้ายตั้งโต๊ะ · ${printTable.code}`}
          onClose={() => setPrintTable(null)}
        >
          <div className="space-y-4">
            <div className="print-area mx-auto max-w-sm rounded-3xl border-2 border-dashed border-border bg-white p-6 text-center text-slate-900 shadow-md">
              <div className="border-b border-slate-200 pb-3">
                <p className="text-lg font-extrabold" style={{ color: primaryColor }}>
                  {settings?.store_name ?? "ร้านยินดีหมูกรอบ"}
                </p>
                <p className="text-xs text-slate-500">{settings?.tagline ?? "อร่อยทุกคำ อบอุ่นทุกจาน"}</p>
              </div>

              <div className="my-4">
                <div
                  className="inline-block rounded-2xl border px-4 py-1.5 mb-2"
                  style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}35` }}
                >
                  <span className="text-lg font-black" style={{ color: primaryColor }}>
                    {printTable.name} ({printTable.code})
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  สแกน QR Code สั่งอาหารได้เลย
                </p>
              </div>

              {qrMap[printTable.id] ? (
                <img
                  src={qrMap[printTable.id]}
                  alt={`QR code สำหรับ ${printTable.code}`}
                  className="mx-auto h-56 w-56 object-contain rounded-xl border border-slate-200 p-2 shadow-sm"
                  width={224}
                  height={224}
                />
              ) : (
                <div className="mx-auto h-56 w-56 grid place-items-center bg-slate-100 rounded-xl text-slate-400 text-xs">
                  กำลังสร้าง QR...
                </div>
              )}

              <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-3 text-left text-xs text-slate-700 border border-slate-200">
                <p className="font-bold text-slate-900">ขั้นตอนการสั่งอาหาร:</p>
                <div className="flex items-center gap-2">
                  <span className="grid h-4.5 w-4.5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: primaryColor }}>1</span>
                  <span>เปิดกล้องมือถือแล้วสแกน QR Code</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid h-4.5 w-4.5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: primaryColor }}>2</span>
                  <span>เลือกเมนูอาหารและกดยืนยันคำสั่งซื้อ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid h-4.5 w-4.5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: primaryColor }}>3</span>
                  <span>อาหารจะปรุงสดใหม่และมาเสิร์ฟที่โต๊ะของคุณ</span>
                </div>
              </div>

              <p className="mt-3 text-[11px] font-semibold" style={{ color: secondaryColor }}>
                ✓ สั่งได้ทันที ไม่ต้องโหลดแอป ไม่ต้องล็อกอิน
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold shadow-glow cursor-pointer"
              >
                <Printer className="h-4 w-4" /> พิมพ์ป้ายโต๊ะนี้ (Print)
              </button>
              <button
                type="button"
                onClick={() => setPrintTable(null)}
                className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Print All Table Tent Cards */}
      {printAllOpen && (
        <Modal title="พิมพ์ป้ายตั้งโต๊ะครบทุกโต๊ะ" onClose={() => setPrintAllOpen(false)}>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <p className="text-sm font-bold">ป้ายตั้งโต๊ะทั้งหมด ({tables.length} โต๊ะ)</p>
                <p className="text-xs text-muted-foreground">พร้อมพิมพ์เพื่อนำไปวางประจำโต๊ะอาหาร</p>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-glow cursor-pointer"
              >
                <Printer className="h-4 w-4" /> พิมพ์ทั้งหมด
              </button>
            </div>

            <div className="print-area grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 text-center text-slate-900 break-inside-avoid shadow-sm"
                >
                  <p className="text-sm font-extrabold" style={{ color: primaryColor }}>
                    {settings?.store_name ?? "ร้านยินดีหมูกรอบ"}
                  </p>
                  <p className="text-[10px] text-slate-500 mb-2">{settings?.tagline}</p>

                  <div
                    className="inline-block rounded-xl border px-3 py-1 mb-2"
                    style={{ backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}35` }}
                  >
                    <span className="text-base font-black" style={{ color: primaryColor }}>
                      {t.name} ({t.code})
                    </span>
                  </div>

                  {qrMap[t.id] && (
                    <img
                      src={qrMap[t.id]}
                      alt={`QR ${t.code}`}
                      className="mx-auto h-44 w-44 object-contain rounded-lg border border-slate-200 p-1"
                    />
                  )}

                  <p className="mt-2 text-xs font-bold text-slate-800">
                    สแกน QR เพื่อสั่งอาหาร
                  </p>
                  <p className="text-[10px] font-medium" style={{ color: secondaryColor }}>
                    ● ไม่ต้องดาวน์โหลดแอป · สั่งได้ทันที
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add New Table */}
      {addOpen && (
        <Modal title="เพิ่มโต๊ะใหม่" onClose={() => setAddOpen(false)}>
          <div className="space-y-3">
            <Labeled label="รหัสโต๊ะ (เช่น T05, A01)">
              <input
                id="add-table-code"
                value={addForm.code}
                onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase() })}
                placeholder="T05"
                className="input-base"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") addTable(); }}
              />
            </Labeled>
            <Labeled label="ชื่อโต๊ะ (ไม่บังคับ)">
              <input
                id="add-table-name"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder={`โต๊ะ ${addForm.code || "..."}`}
                className="input-base"
                onKeyDown={(e) => { if (e.key === "Enter") addTable(); }}
              />
            </Labeled>
            <Labeled label="โซน">
              <select
                id="add-table-zone"
                value={addForm.zone}
                onChange={(e) => setAddForm({ ...addForm, zone: e.target.value as "indoor" | "terrace" })}
                className="input-base"
              >
                <option value="indoor">🏠 โซนห้องแอร์ / ด้านใน</option>
                <option value="terrace">🌿 โซนระเบียง / ด้านนอก</option>
              </select>
            </Labeled>
            <div className="flex gap-2 pt-1">
              <button
                id="add-table-submit"
                onClick={addTable}
                disabled={addSaving || !addForm.code.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60"
              >
                {addSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...</>
                ) : (
                  <><Plus className="h-4 w-4" /> เพิ่มโต๊ะ</>
                )}
              </button>
              <button
                onClick={() => setAddOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteTarget && (
        <Modal title={`ยืนยันการลบโต๊ะ ${deleteTarget.code}`} onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center">
              <p className="text-base font-bold text-red-700">⚠️ ลบ {deleteTarget.code} · {deleteTarget.name}?</p>
              <p className="mt-1 text-sm text-red-600">การลบโต๊ะนี้จะทำให้ QR Code สำหรับโต๊ะนี้ใช้งานไม่ได้</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => deleteTable(deleteTarget)}
                disabled={deleteConfirming}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteConfirming ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> กำลังลบ...</>
                ) : (
                  <><Trash2 className="h-4 w-4" /> ยืนยันลบ</>
                )}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Edit Table Info */}
      {editing && (
        <Modal title={`แก้ไขข้อมูล ${editing.code}`} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <Labeled label="รหัสโต๊ะ">
              <input
                value={editing.code}
                disabled
                className="input-base bg-muted text-muted-foreground cursor-not-allowed"
              />
            </Labeled>
            <Labeled label="ชื่อโต๊ะ">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="input-base"
              />
            </Labeled>
            <Labeled label="โซน">
              <select
                value={editing.zone}
                onChange={(e) => setEditing({ ...editing, zone: e.target.value as never })}
                className="input-base"
              >
                <option value="indoor">โซนห้องแอร์ / ด้านใน</option>
                <option value="terrace">โซนระเบียง / ด้านนอก</option>
              </select>
            </Labeled>
            <Labeled label="สถานะ">
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as never })}
                className="input-base"
              >
                <option value="available">ว่าง</option>
                <option value="occupied">มีลูกค้า</option>
                <option value="disabled">ปิดใช้งาน</option>
              </select>
            </Labeled>
            <button
              onClick={() => save(editing)}
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow"
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </Modal>
      )}
    </PanelShell>
  );
}


