import { NavLink } from "react-router-dom";
import { X } from "lucide-react";

import { primaryNav } from "@/app/route-config";
import { UserAvatar } from "@/components/common/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { cn } from "cn";

export interface AppSidebarProps {
  isDrawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
}

function BrandMark() {
  return (
    <div className="flex h-9 w-fit items-center rounded-lg bg-white px-3">
      <img
        src="/premium-logo-white.png"
        alt="Premium Trust Bank"
        className="h-6 w-auto"
      />
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="px-3">
      <p className="px-3 pb-2 font-mono text-[0.625rem] tracking-[0.08em] text-white/35 uppercase">
        Governance
      </p>

      <ul className="flex flex-col gap-0.5">
        {primaryNav.map(({ label, to, icon: Icon, comingSoon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-[0.8125rem] transition-colors",
                  "text-white/60 hover:bg-white/6 hover:text-white",
                  isActive && "bg-white/8 font-medium text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-white/50",
                      isActive ? "text-brand" : "group-hover:text-white/80",
                    )}
                  />
                  <span className="truncate">{label}</span>

                  {comingSoon ? (
                    <Badge
                      variant="ghost"
                      className="ml-auto h-4 border border-white/15 px-1 font-mono text-[0.5625rem] text-white/40"
                    >
                      Soon
                    </Badge>
                  ) : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function UserBlock() {
  const { user, role } = useAuth();

  return (
    <div className="flex items-center gap-3 p-4">
      <UserAvatar name={user?.userName ?? "User"} size="sm" />

      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-white">
          {user?.userName ?? "Not signed in"}
        </p>
        <p className="truncate text-[0.6875rem] text-white/45">{role}</p>
      </div>
    </div>
  );
}

function SidebarBody({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-start gap-3 p-6 pb-5">
        <BrandMark />

        {onClose ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="ml-auto text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden="true" />
            <span className="sr-only">Close navigation</span>
          </Button>
        ) : null}
      </div>

      <div className="px-6 pb-5">
        <p className="font-mono text-[0.6875rem] text-white/65">
          Premium PLM
          <Badge
            variant="ghost"
            className="ml-2 h-4 border border-white/20 px-1 font-mono text-[0.5625rem] text-white/65"
          >
            v1.0
          </Badge>
        </p>
      </div>

      <Separator className="bg-sidebar-border" />

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-6">
          <NavLinks onNavigate={onNavigate} />
        </div>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      <UserBlock />
    </div>
  );
}

export function AppSidebar({
  isDrawerOpen,
  onDrawerOpenChange,
}: AppSidebarProps) {
  return (
    <>
      <aside className="hidden w-55 shrink-0 lg:block">
        <div className="sticky top-0 h-dvh">
          <SidebarBody />
        </div>
      </aside>

      <Sheet open={isDrawerOpen} onOpenChange={onDrawerOpenChange}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-70 max-w-[85vw] gap-0 border-0 p-0"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>

          <SidebarBody
            onClose={() => onDrawerOpenChange(false)}
            onNavigate={() => onDrawerOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
