import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { ConsoleLayout, bento } from "@/components/console-layout";
import { cn } from "@/lib/utils";

export const STAFF_PIN = "1234";
const STORAGE_KEY = "restaurant-os.staff-unlocked";

export function useStaffLock() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const unlock = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setUnlocked(true);
  };

  return { unlocked, ready, unlock };
}

export function StaffGate({
  title,
  description = "สำหรับพนักงานและผู้ดูแลระบบเท่านั้น",
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { unlocked, ready, unlock } = useStaffLock();
  const [pin, setPin] = useState("");

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <ConsoleLayout title={title}>
      <div className={cn(bento, "mx-auto mt-10 max-w-sm space-y-4 p-8 text-center")}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold">ต้องใส่รหัส PIN</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              pin === STAFF_PIN ? unlock() : toast.error("รหัส PIN ไม่ถูกต้อง");
            }
          }}
          placeholder="• • • •"
          className="input-base text-center text-lg tracking-[0.5em]"
        />
        <button
          onClick={() => (pin === STAFF_PIN ? unlock() : toast.error("รหัส PIN ไม่ถูกต้อง"))}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow"
        >
          ปลดล็อก
        </button>
        <p className="text-[11px] text-muted-foreground">PIN สาธิต: 1234</p>
      </div>
    </ConsoleLayout>
  );
}
