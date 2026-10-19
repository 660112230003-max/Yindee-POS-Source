import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Compass,
  Flame,
  BellRing,
  ClipboardList,
  ShieldCheck,
  QrCode,
  ArrowRight,
  ShoppingBag,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { fetchSettings } from "@/lib/restaurant";
import {
  isStaffUnlocked,
  loginWithUserAndPin,
  fetchAllStaffProfiles,
  type StaffRole,
  type StaffProfile,
} from "@/lib/staff-auth";
import { cn } from "@/lib/utils";

type IndexSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): IndexSearch => {
    return {
      redirect: search.redirect as string,
    };
  },
  head: () => ({
    meta: [
      { title: "ยินดีหมูกรอบ POS · เลือกบทบาท" },
      { name: "description", content: "เลือกบทบาทพนักงานเพื่อเข้าใช้งานระบบ" },
    ],
  }),
  component: LandingPage,
});

/* ------------------------------------------------------------------ */
/*  Role cards config                                                 */
/* ------------------------------------------------------------------ */
const ROLES = [
  {
    key: "overview",
    icon: Compass,
    label: "รวมงานหน้าร้าน",
    sub: "ครัว พนักงาน และแคชเชียร์ในหน้าเดียว (สำหรับ Tablet)",
    to: "/all-in-one",
    accent: "bg-primary/10 text-primary border-primary/20",
    iconBg: "bg-primary/15 text-primary",
    featured: true,
  },
  {
    key: "pos",
    icon: ShoppingBag,
    label: "หน้าสั่งออเดอร์ (POS)",
    sub: "คีย์รายการอาหารและเครื่องดื่ม ส่งเข้าครัว",
    to: "/pos",
    accent: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  },
  {
    key: "cashier",
    icon: ClipboardList,
    label: "หน้าแคชเชียร์ (ตรวจบิล)",
    sub: "ตรวจสอบบิล รับชำระเงิน และรีเซ็ตโต๊ะ",
    to: "/order-status",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  {
    key: "kitchen",
    icon: Flame,
    label: "หน้าห้องครัว (Kitchen KDS)",
    sub: "ดูคิวทำอาหาร และอัปเดตสถานะการปรุง",
    to: "/kitchen",
    accent: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40",
    iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  },
  {
    key: "staff",
    icon: BellRing,
    label: "หน้าพนักงานเสิร์ฟ (Staff Queue)",
    sub: "เสิร์ฟอาหาร เครื่องดื่ม ดูแลลูกค้า และดูบิลเก็บเงิน",
    to: "/staff",
    accent: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40",
    iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
  },
  {
    key: "admin",
    icon: ShieldCheck,
    label: "หน้าผู้ดูแล (Admin Panel)",
    sub: "จัดการโต๊ะ เมนู สรุปยอดขาย และเห็นแท็บทั้งหมด",
    to: "/admin",
    accent: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
    iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Landing Page component                                            */
/* ------------------------------------------------------------------ */
function LandingPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  // Modal State for User / Password Login
  const [pendingDest, setPendingDest] = useState<string | null>(null);
  const [pendingRoleKey, setPendingRoleKey] = useState<StaffRole | null>(null);
  const [pendingRoleLabel, setPendingRoleLabel] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);

  // Fetch staff list for quick selection chips
  useEffect(() => {
    void fetchAllStaffProfiles().then((profiles) => {
      setStaffProfiles(profiles);
    });
  }, []);

  // Reset or initialize fields when modal opens
  useEffect(() => {
    if (!pendingDest) {
      setUsername("");
      setPassword("");
      setShowPassword(false);
      setErrorMsg(null);
      setIsVerifying(false);
      setShake(false);
      setPendingRoleKey(null);
    }
  }, [pendingDest]);

  const storeName = settings?.store_name ?? "ร้านยินดีหมูกรอบ";
  const tagline = settings?.tagline ?? "ระบบจัดการร้านอาหารครบวงจร";

  /* ---- Role card click handler ---- */
  function handleRoleClick(dest: string, roleKey: StaffRole, label: string) {
    if (isStaffUnlocked()) {
      void navigate({ to: dest as "/" });
    } else {
      setPendingDest(dest);
      setPendingRoleKey(roleKey);
      setPendingRoleLabel(label);
      setErrorMsg(null);
      setPassword("");
      setShowPassword(false);

      // Try prefilling matching staff username
      const matchingStaff = staffProfiles.find((p) => p.role === roleKey);
      if (matchingStaff) {
        setUsername(matchingStaff.username || matchingStaff.name);
      } else {
        const defaultUser =
          roleKey === "admin"
            ? "admin"
            : roleKey === "cashier"
            ? "cashier1"
            : roleKey === "kitchen"
            ? "kitchen"
            : roleKey === "staff"
            ? "staff1"
            : "admin";
        setUsername(defaultUser);
      }
    }
  }

  /* ---- Submit User + Password Login ---- */
  async function handleLoginSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setErrorMsg("กรุณากรอกชื่อผู้ใช้งาน (Username)");
      return;
    }
    if (!password.trim()) {
      setErrorMsg("กรุณากรอกรหัสผ่าน (Password / PIN)");
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    const res = await loginWithUserAndPin(username, password, pendingRoleKey || undefined);
    setIsVerifying(false);

    if (res.success) {
      toast.success(`ยินดีต้อนรับคุณ ${res.name || username}`);
      const dest = pendingDest ?? search.redirect ?? "/pos";
      setPendingDest(null);
      void navigate({ to: dest as "/" });
    } else {
      setShake(true);
      setErrorMsg(res.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      {/* ── Branding ── */}
      <div className="mb-8 text-center max-w-sm">
        {settings?.logo_url ? (
          <img
            src={settings.logo_url}
            alt={storeName}
            className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-bento-lg"
          />
        ) : (
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-glow">
            {storeName.charAt(0).toUpperCase()}
          </div>
        )}
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">
          {tagline}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{storeName}</h1>
      </div>

      {/* ── Role cards (Clean list of roles) ── */}
      <div className="w-full max-w-md space-y-2">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <button
              key={role.key}
              id={`role-${role.key}`}
              type="button"
              onClick={() => handleRoleClick(role.to, role.key, role.label)}
              className={cn(
                "group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-bento-lg active:scale-[0.98]",
                role.accent,
                "featured" in role && role.featured && "ring-2 ring-primary/30"
              )}
            >
              <div
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg transition-transform group-hover:scale-110",
                  role.iconBg
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{role.label}</p>
                <p className="mt-0.5 text-xs opacity-70">{role.sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-1" />
            </button>
          );
        })}
      </div>

      {/* ── Footer note ── */}
      <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
        <QrCode className="h-3.5 w-3.5" />
        หน้าลูกค้าต้องเปิดผ่าน QR ประจำโต๊ะ
      </p>

      {/* ── USER LOGIN Modal (Username + Password) ── */}
      {pendingDest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingDest(null);
          }}
        >
          <div
            className={cn(
              "relative my-auto w-full max-w-[560px] rounded-[2.75rem] bg-card p-8 sm:p-10 shadow-[0_25px_80px_-15px_rgba(0,0,0,0.35)] border border-border/90 transition-all",
              shake && "animate-[shake_0.4s_ease-in-out]"
            )}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPendingDest(null)}
              className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="ปิด"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Header */}
            <div className="text-center mb-7">
              <div className="mx-auto mb-3.5 grid h-18 w-18 place-items-center rounded-3xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent text-primary shadow-glow border border-primary/25">
                <ShieldCheck className="h-9 w-9" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                เข้าสู่ระบบผู้ใช้งาน
              </h2>
              <div className="mt-2 text-base text-muted-foreground flex items-center justify-center gap-2">
                <span>สำหรับ:</span>
                <span className="inline-block rounded-xl bg-primary/10 px-3.5 py-1 font-extrabold text-primary text-sm sm:text-base border border-primary/20">
                  {pendingRoleLabel}
                </span>
              </div>
            </div>

            {/* Staff Quick-Pick Chips */}
            {staffProfiles.length > 0 && (
              <div className="mb-6">
                <p className="mb-2.5 text-sm font-bold text-muted-foreground">
                  เลือกบัญชีพนักงานด่วน:
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {staffProfiles.slice(0, 8).map((p) => {
                    const isSelected =
                      username.toLowerCase() === (p.username || p.name).toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setUsername(p.username || p.name);
                          setErrorMsg(null);
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground shadow-md scale-105 ring-2 ring-primary/30"
                            : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                        )}
                      >
                        <User className="h-4 w-4 opacity-80" />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* Username Field */}
              <div className="space-y-2 text-left">
                <label
                  htmlFor="login-username"
                  className="block text-base font-bold text-foreground/90"
                >
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                  <input
                    id="login-username"
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="เช่น admin, cashier1 หรือ ชื่อพนักงาน"
                    className="w-full rounded-2xl border border-input bg-muted/20 pl-14 pr-4 py-3.5 sm:py-4 text-base sm:text-lg font-medium text-foreground placeholder:text-muted-foreground/50 transition-all focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/15 outline-none"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2 text-left">
                <label
                  htmlFor="login-password"
                  className="block text-base font-bold text-foreground/90"
                >
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="กรอกรหัสผ่าน"
                    className="w-full rounded-2xl border border-input bg-muted/20 pl-14 pr-14 py-3.5 sm:py-4 text-base sm:text-lg font-medium text-foreground placeholder:text-muted-foreground/50 transition-all focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/15 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5"
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="flex items-center gap-2.5 rounded-2xl bg-destructive/10 border border-destructive/25 p-3.5 text-sm sm:text-base font-medium text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-primary text-primary-foreground py-4 text-lg sm:text-xl font-black shadow-lg hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>กำลังตรวจสอบ...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-6 w-6" />
                      <span>เข้าสู่ระบบ (LOGIN)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingDest(null)}
                  className="w-full rounded-2xl border border-border/80 bg-background/60 py-3.5 text-base font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          70% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

