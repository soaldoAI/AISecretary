import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh flex bg-app text-app overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden pb-14 sm:pb-0">
        {children}
      </div>
    </div>
  );
}
