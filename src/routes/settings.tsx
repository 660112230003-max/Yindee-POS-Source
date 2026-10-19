import { createFileRoute, Navigate } from "@tanstack/react-router";
import { StaffGuard } from "@/lib/staff-auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบร้าน · Restaurant OS" },
      { name: "description", content: "ตั้งค่าข้อมูลร้านและระบบจัดการ" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <StaffGuard pageTitle="ตั้งค่าระบบร้าน (Store Config)">
      <Navigate to="/admin" search={{ tab: "settings" }} replace />
    </StaffGuard>
  );
}
