import { useState } from "react";
import { Outlet } from "react-router-dom";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";


export function AppShell() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar
        isDrawerOpen={isNavOpen}
        onDrawerOpenChange={setIsNavOpen}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar onOpenNav={() => setIsNavOpen(true)} />

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
