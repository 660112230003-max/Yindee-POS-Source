import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Save,
  Upload,
  Image as ImageIcon,
  Trash2,
  Check,
  Sparkles,
  Store,
  Palette,
  Eye,
  EyeOff,
  UtensilsCrossed,
  Loader2,
  Send,
  SendHorizontal,
  HelpCircle,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";

import { PanelShell, bento } from "@/components/console-layout";
import { Labeled } from "@/components/modal";
import { db, fetchSettings, type StoreSettings } from "@/lib/restaurant";
import { saveLocalTelegramConfig, testTelegramNotification } from "@/lib/telegram";
import { applyGlobalTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// Preset theme color swatches for fast branding
const COLOR_PRESETS = [
  { name: "แดงยินดี", color: "#E53E3E" },
  { name: "ส้มชาไทย", color: "#F97316" },
  { name: "ทองอำพัน", color: "#D97706" },
  { name: "เขียวมรกต", color: "#10B981" },
  { name: "น้ำเงินคราม", color: "#2563EB" },
  { name: "ม่วงพรีเมียม", color: "#7C3AED" },
  { name: "ชมพูกุหลาบ", color: "#E11D48" },
  { name: "น้ำตาลกาแฟ", color: "#78350F" },
  { name: "ดำชาร์โคล", color: "#1E293B" },
];

async function compressImage(file: File, maxDimension = 1200, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context failed");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function SettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data && !form) {
      setForm(data);
    }
  }, [data, form]);

  // Live preview: instantly update entire admin UI theme as color is selected or typed
  useEffect(() => {
    if (form?.primary_color) {
      applyGlobalTheme(form.primary_color, form.secondary_color);
    }
  }, [form?.primary_color, form?.secondary_color]);

  // On unmount without saving, restore original database theme settings
  useEffect(() => {
    return () => {
      if (data?.primary_color) {
        applyGlobalTheme(data.primary_color, data.secondary_color);
      }
    };
  }, [data?.primary_color, data?.secondary_color]);

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 8MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await compressImage(file, 600, 0.85);
      set("logo_url", dataUrl);
      toast.success("อัปโหลดและประมวลผลโลโก้เรียบร้อย");
    } catch (err) {
      console.error(err);
      toast.error("อ่านไฟล์รูปภาพไม่สำเร็จ");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB");
      return;
    }
    setUploadingBanner(true);
    try {
      const dataUrl = await compressImage(file, 1600, 0.8);
      set("banner_url", dataUrl);
      toast.success("อัปโหลดและประมวลผลรูปแบนเนอร์เรียบร้อย");
    } catch (err) {
      console.error(err);
      toast.error("อ่านไฟล์รูปภาพไม่สำเร็จ");
    } finally {
      setUploadingBanner(false);
    }
  };

  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingKitchenTelegram, setTestingKitchenTelegram] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);

  const handleTestTelegram = async (target: "main" | "kitchen" = "main") => {
    if (!form?.telegram_bot_token) {
      toast.error("กรุณากรอก Telegram Bot Token ก่อนทดสอบ");
      return;
    }
    const chatIdToTest = target === "main" ? form?.telegram_chat_id : form?.telegram_kitchen_chat_id;
    if (!chatIdToTest) {
      toast.error(target === "main" ? "กรุณากรอก Telegram Chat ID กลุ่มหลักก่อนทดสอบ" : "กรุณากรอก Telegram Chat ID กลุ่มครัวก่อนทดสอบ");
      return;
    }

    if (target === "main") setTestingTelegram(true);
    else setTestingKitchenTelegram(true);

    try {
      const targetLabel = target === "main" ? "กลุ่มหลัก / บริการลูกค้า" : "กลุ่มครัวพร้อมเสิร์ฟ";
      const res = await testTelegramNotification(
        form.telegram_bot_token,
        chatIdToTest,
        `${form.store_name || "ยินดีหมูกรอบ"} (${targetLabel})`
      );
      if (res.success) {
        toast.success(`✅ ส่งข้อความทดสอบไปยัง${target === "main" ? "กลุ่มหลัก" : "กลุ่มครัว"}สำเร็จ! ตรวจสอบแชทใน Telegram ได้เลย`);
      } else {
        toast.error(`❌ ส่งไม่สำเร็จ: ${res.error || "ตรวจสอบ Token/Chat ID"}`);
      }
    } catch (err: any) {
      toast.error(`❌ ข้อผิดพลาด: ${err?.message || "ไม่สามารถเชื่อมต่อได้"}`);
    } finally {
      if (target === "main") setTestingTelegram(false);
      else setTestingKitchenTelegram(false);
    }
  };

  const save = async () => {
    if (!form) return;
    setIsSaving(true);

    // Persist Telegram config to localStorage
    saveLocalTelegramConfig({
      botToken: form.telegram_bot_token || "",
      chatId: form.telegram_chat_id || "",
      kitchenChatId: form.telegram_kitchen_chat_id || "",
      enabled: form.telegram_notify_enabled ?? true,
    });

    const fullPayload = {
      store_name: form.store_name,
      system_name: form.system_name,
      tagline: form.tagline,
      logo_url: form.logo_url,
      banner_url: form.banner_url,
      hero_title: form.hero_title,
      hero_subtitle: form.hero_subtitle,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      vat_rate: form.vat_rate,
      service_charge_rate: form.service_charge_rate,
      telegram_bot_token: form.telegram_bot_token || null,
      telegram_chat_id: form.telegram_chat_id || null,
      telegram_kitchen_chat_id: form.telegram_kitchen_chat_id || null,
      telegram_notify_enabled: form.telegram_notify_enabled ?? true,
    };

    try {
      // First attempt updating with telegram columns
      const { error } = await db.from("store_settings").update(fullPayload).eq("id", form.id);
      if (error) {
        // If columns don't exist in Supabase yet, fallback to base payload
        if (
          error.message?.includes("telegram_") ||
          error.code === "PGRST204" ||
          error.message?.includes("schema cache")
        ) {
          const {
            telegram_bot_token,
            telegram_chat_id,
            telegram_kitchen_chat_id,
            telegram_notify_enabled,
            ...basePayload
          } = fullPayload;
          const { error: fallbackError } = await db
            .from("store_settings")
            .update(basePayload)
            .eq("id", form.id);
          if (fallbackError) throw fallbackError;
          toast.success("บันทึกการตั้งค่าร้านและบันทึก Telegram บนอุปกรณ์เรียบร้อยแล้ว");
        } else {
          throw error;
        }
      } else {
        toast.success("บันทึกการตั้งค่าร้านและระบบแจ้งเตือน Telegram สำเร็จ");
      }
      await qc.invalidateQueries({ queryKey: ["settings"] });
      await qc.refetchQueries({ queryKey: ["settings"] });
    } catch (err: any) {
      console.error("Supabase update error:", err);
      toast.error(`บันทึกไม่สำเร็จ: ${err?.message || "เกิดข้อผิดพลาด"}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !form) {
    return (
      <PanelShell title="ตั้งค่าร้าน">
        <div className="flex min-h-[300px] items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> กำลังโหลดข้อมูลตั้งค่าร้าน...
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="ตั้งค่าร้าน"
      actions={
        <button
          onClick={save}
          disabled={isSaving}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}</span>
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Store Details & Branding (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Section 1: ข้อมูลร้าน & โลโก้ / แบนเนอร์ */}
          <section className={cn(bento, "space-y-4 p-5")}>
            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
              <Store className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">ข้อมูลร้านและภาพลักษณ์ (Store Identity)</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Labeled label="ชื่อร้าน">
                <input
                  value={form.store_name}
                  onChange={(e) => set("store_name", e.target.value)}
                  className="input-base"
                  placeholder="เช่น ร้านยินดีหมูกรอบ"
                />
              </Labeled>
              <Labeled label="ชื่อระบบ">
                <input
                  value={form.system_name}
                  onChange={(e) => set("system_name", e.target.value)}
                  className="input-base"
                  placeholder="เช่น Restaurant OS"
                />
              </Labeled>
            </div>

            <Labeled label="สโลแกนร้าน">
              <input
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                className="input-base"
                placeholder="เช่น กรอบนอก นุ่มใน น้ำจิ้มสูตรเด็ด อร่อยทุกคำ"
              />
            </Labeled>

            {/* Logo Upload */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-primary" /> โลโก้ร้าน (Logo)
                </span>
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={() => set("logo_url", null)}
                    className="flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> นำออก
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Logo Preview */}
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-border bg-background shadow-inner overflow-hidden relative group">
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Logo Preview"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <UtensilsCrossed className="h-8 w-8 text-muted-foreground/40" />
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 grid place-items-center bg-background/80">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 min-w-[200px]">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl bg-card px-3.5 py-2 text-xs font-semibold text-foreground border border-border shadow-sm hover:bg-muted active:scale-95 transition-all cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      {form.logo_url ? "เปลี่ยนรูปโลโก้" : "เลือกไฟล์รูปโลโก้"}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    รองรับ JPG, PNG, WEBP (ย่อขนาดอัตโนมัติ ไม่เกิน 8MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Banner Upload */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> รูปแบนเนอร์ร้าน (Banner / Hero Image)
                </span>
                {form.banner_url && (
                  <button
                    type="button"
                    onClick={() => set("banner_url", null)}
                    className="flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> นำออก
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {/* Banner Preview */}
                <div className="relative h-28 w-full rounded-xl border-2 border-dashed border-border bg-background overflow-hidden shadow-inner group">
                  {form.banner_url ? (
                    <img
                      src={form.banner_url}
                      alt="Banner Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground/60 text-xs">
                      <ImageIcon className="h-6 w-6 opacity-40" />
                      <span>ยังไม่มีภาพแบนเนอร์ (ใช้ธีมสีพื้นหลังเริ่มต้น)</span>
                    </div>
                  )}
                  {uploadingBanner && (
                    <div className="absolute inset-0 grid place-items-center bg-background/80">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleBannerUpload(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={uploadingBanner}
                    onClick={() => bannerInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-card px-3.5 py-2 text-xs font-semibold text-foreground border border-border shadow-sm hover:bg-muted active:scale-95 transition-all cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    {form.banner_url ? "เปลี่ยนรูปแบนเนอร์" : "เลือกไฟล์รูปแบนเนอร์"}
                  </button>
                  <span className="text-[11px] text-muted-foreground text-right">
                    แนะนำแนวนอนอัตราส่วน 16:9 หรือ 3:1
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: สไตล์และสีแบรนด์ */}
          <section className={cn(bento, "space-y-4 p-5")}>
            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
              <Palette className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">สีและธีมแบรนด์ (Colors & Theme)</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Primary Color */}
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">สีหลัก (Primary Color)</label>
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: form.primary_color }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primary_color || "#E53E3E"}
                    onChange={(e) => set("primary_color", e.target.value)}
                    className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                  />
                  <input
                    type="text"
                    value={form.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                    className="input-base font-mono uppercase text-xs"
                    placeholder="#E53E3E"
                  />
                </div>
                {/* Preset Chips */}
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground mb-1.5">สียอดนิยม:</p>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((p) => {
                      const isSelected = form.primary_color?.toLowerCase() === p.color.toLowerCase();
                      return (
                        <button
                          key={p.color}
                          type="button"
                          onClick={() => set("primary_color", p.color)}
                          title={`${p.name} (${p.color})`}
                          className={cn(
                            "h-7 w-7 rounded-full border border-black/15 transition-all hover:scale-110 relative flex items-center justify-center cursor-pointer shadow-xs",
                            isSelected && "ring-2 ring-foreground ring-offset-2 scale-110 shadow-md",
                          )}
                          style={{ backgroundColor: p.color }}
                        >
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Secondary Color */}
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">สีรอง (Secondary Color)</label>
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm"
                    style={{ backgroundColor: form.secondary_color }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.secondary_color || "#10B981"}
                    onChange={(e) => set("secondary_color", e.target.value)}
                    className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                  />
                  <input
                    type="text"
                    value={form.secondary_color}
                    onChange={(e) => set("secondary_color", e.target.value)}
                    className="input-base font-mono uppercase text-xs"
                    placeholder="#10B981"
                  />
                </div>
                {/* Preset Chips */}
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground mb-1.5">สียอดนิยม:</p>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((p) => {
                      const isSelected = form.secondary_color?.toLowerCase() === p.color.toLowerCase();
                      return (
                        <button
                          key={p.color}
                          type="button"
                          onClick={() => set("secondary_color", p.color)}
                          title={`${p.name} (${p.color})`}
                          className={cn(
                            "h-7 w-7 rounded-full border border-black/15 transition-all hover:scale-110 relative flex items-center justify-center cursor-pointer shadow-xs",
                            isSelected && "ring-2 ring-foreground ring-offset-2 scale-110 shadow-md",
                          )}
                          style={{ backgroundColor: p.color }}
                        >
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Customer Page Preview & Financial (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Section 3: Live Preview Mockup */}
          <section className={cn(bento, "space-y-3 p-5")}>
            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
              <Eye className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">ตัวอย่างหน้าสั่งอาหาร (Customer Live Preview)</h2>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm text-left">
              {/* Mini Header Preview */}
              <div
                className="p-4 text-white relative transition-colors"
                style={{
                  backgroundColor: form.primary_color || "#E53E3E",
                  backgroundImage: form.banner_url ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.65)), url(${form.banner_url})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <UtensilsCrossed className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{form.store_name || "ชื่อร้านอาหาร"}</p>
                    <p className="text-[10px] opacity-80 truncate">{form.tagline || "สโลแกนร้าน"}</p>
                  </div>
                </div>
              </div>

              {/* Mini Content */}
              <div className="p-3 bg-muted/20 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">ตัวอย่างสีรอง (Secondary):</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: form.secondary_color || "#10B981" }}
                  >
                    ● สั่งได้ทันที
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg py-2 text-center text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: form.primary_color || "#E53E3E" }}
                  >
                    + เพิ่มลงตะกร้า (ตัวอย่างสีปุ่ม)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: ข้อความต้อนรับ & การเงิน */}
          <section className={cn(bento, "space-y-4 p-5")}>
            <h2 className="text-base font-bold text-foreground">ข้อความและภาษี</h2>
            <div className="space-y-3">
              <Labeled label="หัวข้อหน้าลูกค้า (Hero Title)">
                <input
                  value={form.hero_title}
                  onChange={(e) => set("hero_title", e.target.value)}
                  className="input-base text-sm"
                  placeholder="ยินดีต้อนรับสู่ร้าน..."
                />
              </Labeled>
              <Labeled label="ข้อความรอง (Hero Subtitle)">
                <input
                  value={form.hero_subtitle}
                  onChange={(e) => set("hero_subtitle", e.target.value)}
                  className="input-base text-sm"
                  placeholder="สแกน สั่ง อร่อย ได้เลยที่โต๊ะของคุณ"
                />
              </Labeled>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Labeled label="VAT (%)">
                  <input
                    type="number"
                    value={form.vat_rate}
                    onChange={(e) => set("vat_rate", Number(e.target.value))}
                    className="input-base text-sm"
                  />
                </Labeled>
                <Labeled label="Service Charge (%)">
                  <input
                    type="number"
                    value={form.service_charge_rate}
                    onChange={(e) => set("service_charge_rate", Number(e.target.value))}
                    className="input-base text-sm"
                  />
                </Labeled>
              </div>
            </div>
          </section>

          {/* Section 6: การแจ้งเตือน Telegram */}
          <section className={cn(bento, "space-y-4 p-5 border-sky-500/30 bg-sky-500/5")}>
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow-xs">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>แจ้งเตือน Telegram</span>
                    {form.telegram_notify_enabled ? (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        เปิดใช้งาน
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        ปิด
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    แจ้งเตือนเข้าแชท/กลุ่มทันทีเมื่อลูกค้าเรียกเด็กเสิร์ฟ, เช็คบิล หรือเมื่อครัวกดพร้อมเสิร์ฟ
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.telegram_notify_enabled ?? true}
                  onChange={(e) => set("telegram_notify_enabled", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div className="space-y-3.5">
              <Labeled label="Telegram Bot Token">
                <div className="relative">
                  <input
                    type={showTelegramToken ? "text" : "password"}
                    value={form.telegram_bot_token || ""}
                    onChange={(e) => set("telegram_bot_token", e.target.value)}
                    className="input-base text-xs font-mono pr-16"
                    placeholder="เช่น 7123456789:AAHk..._xxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTelegramToken(!showTelegramToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                    title={showTelegramToken ? "ซ่อน Token" : "แสดง Token"}
                  >
                    {showTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  รับได้ฟรีจากการสร้างบอทผ่าน <b>@BotFather</b> ในแอป Telegram
                </p>
              </Labeled>

              <Labeled label="Telegram Chat ID กลุ่มบริการลูกค้า (เรียกพนักงาน / เช็คบิล)">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.telegram_chat_id || ""}
                    onChange={(e) => set("telegram_chat_id", e.target.value)}
                    className="input-base text-xs font-mono flex-1"
                    placeholder="เช่น -1001234567890 (แชทกลุ่ม) หรือ 123456789 (ส่วนตัว)"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestTelegram("main")}
                    disabled={testingTelegram || !form.telegram_bot_token || !form.telegram_chat_id}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    {testingTelegram ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-3.5 w-3.5" />
                    )}
                    <span>{testingTelegram ? "กำลังส่ง..." : "ทดสอบส่ง"}</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  กลุ่มสำหรับเด็กเสิร์ฟ/แคชเชียร์ รับแจ้งเตือนเมื่อลูกค้าเรียกโต๊ะหรือขอเช็คบิล (มักขึ้นต้นด้วย <code>-100...</code>)
                </p>
              </Labeled>

              <Labeled label="Telegram Chat ID กลุ่มครัวพร้อมเสิร์ฟ (ตัวเลือกเสริม: หากต้องการแยกกลุ่ม)">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.telegram_kitchen_chat_id || ""}
                    onChange={(e) => set("telegram_kitchen_chat_id", e.target.value)}
                    className="input-base text-xs font-mono flex-1"
                    placeholder="เช่น -1009876543210 (หากเว้นว่าง จะแจ้งเตือนรวมในกลุ่มบริการด้านบน)"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestTelegram("kitchen")}
                    disabled={testingKitchenTelegram || !form.telegram_bot_token || !form.telegram_kitchen_chat_id}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    {testingKitchenTelegram ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-3.5 w-3.5" />
                    )}
                    <span>{testingKitchenTelegram ? "กำลังส่ง..." : "ทดสอบกลุ่มครัว"}</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  💡 <i>หากเว้นว่างไว้</i> ระบบจะส่งแจ้งเตือนอาหารเสร็จไปยังกลุ่มบริการลูกค้าด้านบนโดยอัตโนมัติ
                </p>
              </Labeled>

              {/* Guide Accordion / Box */}
              <div className="rounded-xl border border-sky-500/20 bg-sky-50/60 dark:bg-sky-950/30 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-sky-900 dark:text-sky-200">
                  <HelpCircle className="h-4 w-4 text-sky-500" />
                  <span>วิธีตั้งค่าบอท Telegram ใน 4 ขั้นตอน:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-muted-foreground pl-1 leading-relaxed">
                  <li>
                    เปิดแอป Telegram ค้นหา <b className="text-foreground">@BotFather</b> แล้วส่งข้อความ{" "}
                    <code className="bg-background px-1 py-0.5 rounded font-mono text-[10px]">/newbot</code>
                  </li>
                  <li>
                    ตั้งชื่อและ username บอท (ลงท้ายด้วย bot) จากนั้นคัดลอก <b>HTTP API Token</b> นำมาวางที่ช่อง Bot Token
                  </li>
                  <li>
                    สร้างกลุ่มสำหรับพนักงาน แล้วดึงบอทที่สร้างไว้เข้ากลุ่ม จากนั้นส่งข้อความอย่างน้อย 1 ข้อความในกลุ่ม
                  </li>
                  <li>
                    หา Chat ID โดยดึงบอท <b className="text-foreground">@RawDataBot</b> หรือ <b className="text-foreground">@userinfobot</b> เข้ากลุ่มเพื่อดูรหัส{" "}
                    <code className="bg-background px-1 py-0.5 rounded font-mono text-[10px]">chat id</code> แล้วนำมากรอกด้านบน
                  </li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Floating Save Button for Mobile / Quick Action */}
      <div className="mt-6 flex justify-end border-t border-border/60 pt-4">
        <button
          onClick={save}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-glow hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่าร้าน"}</span>
        </button>
      </div>
    </PanelShell>
  );
}
